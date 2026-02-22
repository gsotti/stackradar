import React, { useState, useEffect } from 'react';
import { Copy, Terminal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { Site, Environment, System } from '../types';

interface SiteSetupInstructionsProps {
  site: Site & { tenant_name?: string };
  onClose?: () => void;
  embedded?: boolean;
}

export default function SiteSetupInstructions({ site, onClose, embedded = false }: SiteSetupInstructionsProps) {
  const { t } = useTranslation(['sites', 'common']);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string>('');
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [registryOwner, setRegistryOwner] = useState('gsotti');
  const [appUrl, setAppUrl] = useState('');
  const [k8sMethod, setK8sMethod] = useState<'kubectl' | 'helm' | 'helmfile'>('kubectl');

  const resolveAppUrl = () => (appUrl || window.location.origin).replace(/\/$/, '');

  useEffect(() => {
    fetchEnvironments();
    fetchPublicSettings();
  }, [site.id]);

  useEffect(() => {
    if (selectedEnv) {
      fetchSystems(selectedEnv);
    } else {
      setSystems([]);
      setSelectedSystem('');
    }
  }, [selectedEnv]);

  const fetchEnvironments = async () => {
    try {
      const data = await api.get<Environment[]>(`/environments?site_id=${site.id}`);
      setEnvironments(data || []);
    } catch (error) {
      console.error('Error fetching environments:', error);
    }
  };

  const fetchSystems = async (envId: string) => {
    try {
      const data = await api.get<System[]>(`/systems?environment_id=${envId}`);
      setSystems(data || []);
    } catch (error) {
      console.error('Error fetching systems:', error);
    }
  };

  const fetchPublicSettings = async () => {
    try {
      const data = await api.get<Record<string, string>>('/settings/public');
      if (data && data.registry_owner) {
        setRegistryOwner(data.registry_owner);
      }
      if (data && data.app_url) {
        setAppUrl(data.app_url.trim());
      }
    } catch (error) {
      // Keep default registryOwner value on failure
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const getCopiedText = (key: string) => copied[key] ? t('common:actions.copied') : t('common:actions.copy');

  const getEnvName = () => {
    const env = environments.find(e => e.id === parseInt(selectedEnv));
    return env ? env.name : '<environment>';
  };

  const renderDockerInstructions = () => {
    const apiToken = site.api_token;
    const stackradarUrl = resolveAppUrl();
    const tenantName = site.tenant_name || 'default';
    const siteName = site.name;
    const envName = getEnvName();

    const logCollectorCmd = `docker run -d \\
  --name stackradar-docker-logs-collector \\
  --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e STACKRADAR_API_URL="${stackradarUrl}" \\
  -e API_TOKEN="${apiToken}" \\
  -e TENANT="${tenantName}" \\
  -e SITE="${siteName}" \\
  -e ENVIRONMENT="${envName}"${selectedSystem ? ` \\
  -e CONTAINER_FILTER="${selectedSystem}"` : ''} \\
  ghcr.io/gsotti/stackradar-docker-logs-collector:latest`;

    const statsCollectorCmd = `docker run -d \\
  --name stackradar-docker-stats-collector \\
  --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e STACKRADAR_API_URL="${stackradarUrl}" \\
  -e API_TOKEN="${apiToken}" \\
  -e COLLECTION_INTERVAL_MS="60000" \\
  ghcr.io/gsotti/stackradar-docker-stats-collector:latest`;

    const composeFile = `version: '3.8'

services:
  stackradar-docker-logs-collector:
    image: ghcr.io/gsotti/stackradar-docker-logs-collector:latest
    container_name: stackradar-docker-logs-collector
    restart: unless-stopped
    environment:
      STACKRADAR_API_URL: "${stackradarUrl}"
      API_TOKEN: "${apiToken}"
      TENANT: "${tenantName}"
      SITE: "${siteName}"
      ENVIRONMENT: "${envName}"${selectedSystem ? `\n      CONTAINER_FILTER: "${selectedSystem}"` : ''}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      resources:
        limits:
          memory: 256M

  stackradar-docker-stats-collector:
    image: ghcr.io/gsotti/stackradar-docker-stats-collector:latest
    container_name: stackradar-docker-stats-collector
    restart: unless-stopped
    environment:
      STACKRADAR_API_URL: "${stackradarUrl}"
      API_TOKEN: "${apiToken}"
      COLLECTION_INTERVAL_MS: "60000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      resources:
        limits:
          memory: 128M`;

    return (
      <div className="space-y-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
            {t('setup.docker_intro')}
          </p>
        </div>

        {/* Environment/System Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_environment_label')}
            </label>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_environment')}</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_system_logs_label')}
            </label>
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_system')}</option>
              {systems.map((sys) => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-6">
          {/* Log Collector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {t('setup.docker_log_title')}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.docker_log_description')}
            </p>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('setup.docker_run_command')}</span>
                <button
                  onClick={() => copyToClipboard(logCollectorCmd, 'log-cmd')}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  <Copy className="w-4 h-4" />
                  {getCopiedText('log-cmd')}
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                {logCollectorCmd}
              </pre>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('setup.deployment_heading')}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                {t('setup.docker_run_description')}
              </p>
              <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                # Verify logs after starting
                docker logs -f stackradar-docker-logs-collector
              </code>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Stats Collector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {t('setup.docker_stats_title')}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.docker_stats_description')}
            </p>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('setup.docker_run_command')}</span>
                <button
                  onClick={() => copyToClipboard(statsCollectorCmd, 'stats-cmd')}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  <Copy className="w-4 h-4" />
                  {getCopiedText('stats-cmd')}
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                {statsCollectorCmd}
              </pre>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('setup.deployment_heading')}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                {t('setup.docker_stats_note')}
              </p>
              <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                # Verify metrics collection
                docker logs stackradar-docker-stats-collector
              </code>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Docker Compose */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {t('setup.docker_compose_title')}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.docker_compose_description')}
            </p>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">docker-compose.yml</span>
                <button
                  onClick={() => copyToClipboard(composeFile, 'compose')}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  <Copy className="w-4 h-4" />
                  {getCopiedText('compose')}
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                {composeFile}
              </pre>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('setup.deployment_heading')}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Save the snippet above as <code className="text-blue-600 dark:text-blue-400">docker-compose.yml</code> and start both services:
              </p>
              <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                docker-compose up -d
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderKubernetesInstructions = () => {
    const apiToken = site.api_token;
    const stackradarUrl = resolveAppUrl();
    const tenantName = site.tenant_name || 'default';
    const siteName = site.name;
    const envName = getEnvName();
    const selectedEnvObj = environments.find(e => e.id === parseInt(selectedEnv));

    // --- kubectl content ---
    const statsConfigYaml = `apiVersion: v1
kind: Secret
metadata:
  name: stackradar-stats-config
  namespace: stackradar-system
type: Opaque
stringData:
  STACKRADAR_URL: "${stackradarUrl}"
  API_TOKEN: "${apiToken}"
  CLUSTER_NAME: "${siteName}"`;

    const logsConfigYaml = `apiVersion: v1
kind: Secret
metadata:
  name: stackradar-log-config-${selectedSystem || 'app'}
  namespace: stackradar-system
type: Opaque
stringData:
  STACKRADAR_URL: "${stackradarUrl}"
  API_TOKEN: "${apiToken}"
  TENANT: "${tenantName}"
  SITE: "${siteName}"
  ENVIRONMENT: "${envName}"
  APP_NAME: "${selectedSystem || '<system>'}"
  LOG_TAIL_LINES: "100"
  POLL_INTERVAL: "1000"
  FOLLOW_LOGS: "true"`;

    const logCollectorEnv = `env:
  - name: POD_NAMESPACE
    value: "default" # Target namespace
  - name: POD_LABEL_SELECTOR
    value: "app=${selectedSystem || '<system>'}"
  - name: APP_NAME
    value: "${selectedSystem || '<system>'}"
  - name: ENVIRONMENT
    value: "${envName}"
  - name: TENANT
    value: "${tenantName}"
  - name: SITE
    value: "${siteName}"`;

    // --- Helm content ---
    const helmStatsCmd = `helm install stackradar-stats-collector \\
  oci://ghcr.io/${registryOwner}/charts/stackradar-stats-collector \\
  --namespace stackradar-system --create-namespace \\
  --set stackradar.url=${stackradarUrl} \\
  --set stackradar.apiToken=${apiToken} \\
  --set collector.clusterName=${siteName}`;

    const helmLogsCmd = `helm install stackradar-logs-collector \\
  oci://ghcr.io/${registryOwner}/charts/stackradar-logs-collector \\
  --namespace stackradar-system \\
  --set stackradar.url=${stackradarUrl} \\
  --set stackradar.apiToken=${apiToken} \\
  --set collector.podNamespace=<your-namespace> \\
  --set collector.podLabelSelector=app=${selectedSystem || '<system>'} \\
  --set collector.tenant=${tenantName} \\
  --set collector.site=${siteName} \\
  --set collector.environment=${selectedEnvObj?.name || '<environment>'}`;

    // --- Helmfile content ---
    const helmfileYaml = `repositories:
  - name: stackradar
    url: oci://ghcr.io/${registryOwner}/charts

releases:
  - name: stackradar-stats-collector
    chart: stackradar/stackradar-stats-collector
    namespace: stackradar-system
    createNamespace: true
    values:
      - stackradar:
          url: ${stackradarUrl}
          apiToken: ${apiToken}
          clusterName: ${siteName}

  - name: stackradar-logs-collector
    chart: stackradar/stackradar-logs-collector
    namespace: stackradar-system
    values:
      - stackradar:
          url: ${stackradarUrl}
          apiToken: ${apiToken}
        collector:
          podNamespace: <your-namespace>
          podLabelSelector: app=${selectedSystem || '<system>'}
          tenant: ${tenantName}
          site: ${siteName}
          environment: ${selectedEnvObj?.name || '<environment>'}`;

    return (
      <div className="space-y-8">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
            {t('setup.kubernetes_intro')}
          </p>
        </div>

        {/* Environment/System Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_environment_label')}
            </label>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_environment')}</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_system_collector_label')}
            </label>
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_system')}</option>
              {systems.map((sys) => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Installation method tabs */}
        <div className="flex items-center gap-2">
          {(['kubectl', 'helm', 'helmfile'] as const).map((method) => (
            <button
              key={method}
              onClick={() => setK8sMethod(method)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                k8sMethod === method
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {method}
            </button>
          ))}
        </div>

        {/* kubectl tab */}
        {k8sMethod === 'kubectl' && (
          <>
            {/* Stats Collector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {t('setup.k8s_stats_title')}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('setup.k8s_stats_description')}
              </p>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('setup.k8s_config_secret')}</span>
                  <button
                    onClick={() => copyToClipboard(statsConfigYaml, 'k8s-stats-conf')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('k8s-stats-conf')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {statsConfigYaml}
                </pre>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('setup.k8s_deployment_steps')}</h4>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal ml-4">
                  <li>Create the <code className="text-blue-600 dark:text-blue-400">stackradar-system</code> namespace if it doesn't exist.</li>
                  <li>Apply the configuration secret shown above.</li>
                  <li>Deploy the stats collector from the <code className="text-blue-600 dark:text-blue-400">collector-k8s/stats-collector</code> directory.</li>
                </ol>
                <div className="mt-4">
                  <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                    kubectl apply -k collector-k8s/stats-collector
                  </code>
                </div>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Log Collector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {t('setup.k8s_logs_title')}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('setup.k8s_logs_description')}
              </p>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('setup.k8s_config_secret')}</span>
                  <button
                    onClick={() => copyToClipboard(logsConfigYaml, 'k8s-logs-conf')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('k8s-logs-conf')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {logsConfigYaml}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('setup.k8s_env_vars')}</span>
                  <button
                    onClick={() => copyToClipboard(logCollectorEnv, 'k8s-logs-env')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('k8s-logs-env')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {logCollectorEnv}
                </pre>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('setup.k8s_deployment_steps')}</h4>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal ml-4">
                  <li>Apply the configuration secret shown above.</li>
                  <li>In <code className="text-blue-600 dark:text-blue-400">collector-k8s/log-collector/deployment.yaml</code>, update the environment variables to target your pod.</li>
                  <li>Deploy the log collector:</li>
                </ol>
                <div className="mt-4">
                  <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
                    kubectl apply -f collector-k8s/log-collector/deployment.yaml
                  </code>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Helm tab */}
        {k8sMethod === 'helm' && (
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Charts are published to the OCI registry. No repository <code className="font-mono">helm repo add</code> needed.
              </p>
            </div>

            {/* Helm Stats Collector */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('setup.k8s_stats_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('setup.k8s_stats_description')}
              </p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Helm Install Command</span>
                  <button
                    onClick={() => copyToClipboard(helmStatsCmd, 'helm-stats-cmd')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('helm-stats-cmd')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {helmStatsCmd}
                </pre>
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Helm Logs Collector */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('setup.k8s_logs_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('setup.k8s_logs_description')}
              </p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Helm Install Command</span>
                  <button
                    onClick={() => copyToClipboard(helmLogsCmd, 'helm-logs-cmd')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('helm-logs-cmd')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {helmLogsCmd}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Helmfile tab */}
        {k8sMethod === 'helmfile' && (
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Install helmfile from <a href="https://helmfile.readthedocs.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">https://helmfile.readthedocs.io</a>, then run <code className="font-mono">helmfile apply</code>.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                helmfile.yaml
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Save this file as <code className="text-blue-600 dark:text-blue-400">helmfile.yaml</code> and run <code className="text-blue-600 dark:text-blue-400">helmfile apply</code> to deploy both collectors.
              </p>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">helmfile.yaml</span>
                  <button
                    onClick={() => copyToClipboard(helmfileYaml, 'helmfile-yaml')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                    {getCopiedText('helmfile-yaml')}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                  {helmfileYaml}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGenericInstructions = () => {
    const apiEndpoint = `${resolveAppUrl()}/api/ingest/${site.api_token}/single`;
    const envName = getEnvName();

    const curlSnippet = `curl -X POST "${apiEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "level": "INFO",
    "message": "Hello from StackRadar",
    "environment": "${envName}",
    "system": "${selectedSystem || '<system>'}",
    "source": "curl"
  }'`;

    const jsSnippet = `fetch("${apiEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    level: "INFO",
    message: "Log message from JavaScript",
    environment: "${envName}",
    system: "${selectedSystem || '<system>'}",
    source: "browser"
  })
})
.then(res => res.json())
.then(console.log);`;

    const tsSnippet = `interface StackRadarLog {
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  environment: string;
  system: string;
  source?: string;
  metadata?: any;
}

const log: StackRadarLog = {
  level: 'INFO',
  message: 'Log message from TypeScript',
  environment: '${envName}',
  system: '${selectedSystem || '<system>'}',
  source: 'nodejs'
};

async function sendLog(data: StackRadarLog) {
  const response = await fetch("${apiEndpoint}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

sendLog(log).catch(console.error);`;

    return (
      <div className="space-y-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('setup.generic_intro')}
          </p>
        </div>

        {/* Environment/System Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_environment_label')}
            </label>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_environment')}</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('setup.target_system_label')}
            </label>
            <select
              value={selectedSystem}
              onChange={(e) => setSelectedSystem(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('setup.select_system')}</option>
              {systems.map((sys) => (
                <option key={sys.id} value={sys.name}>{sys.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* cURL Snippet */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> {t('setup.tab_curl')}
            </h3>
            <button
              onClick={() => copyToClipboard(curlSnippet, 'curl')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {getCopiedText('curl')}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {curlSnippet}
          </pre>
        </div>

        {/* JS Snippet */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('setup.tab_js')}
            </h3>
            <button
              onClick={() => copyToClipboard(jsSnippet, 'js')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {getCopiedText('js')}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {jsSnippet}
          </pre>
        </div>

        {/* TS Snippet */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('setup.tab_ts')}
            </h3>
            <button
              onClick={() => copyToClipboard(tsSnippet, 'ts')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {getCopiedText('ts')}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {tsSnippet}
          </pre>
        </div>
      </div>
    );
  };

  const content = (
    <div className={`${embedded ? '' : 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col'}`}>
      {!embedded && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('setup.title')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('setup.subtitle', { siteName: site.name })}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          )}
        </div>
      )}

      <div className={`${embedded ? '' : 'p-6 overflow-y-auto'}`}>
        {site.site_type === 'docker' ? renderDockerInstructions() :
         site.site_type === 'kubernetes' ? renderKubernetesInstructions() :
         renderGenericInstructions()}
      </div>

      {!embedded && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            {t('common:actions.close')}
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl">
        {content}
      </div>
    </div>
  );
}
