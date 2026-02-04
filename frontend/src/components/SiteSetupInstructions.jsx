import React, { useState, useEffect } from 'react';
import { Copy, Terminal, X } from 'lucide-react';
import { api } from '../utils/api';

export default function SiteSetupInstructions({ site, onClose, embedded = false }) {
  const [environments, setEnvironments] = useState([]);
  const [systems, setSystems] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('');
  const [copied, setCopied] = useState({});

  useEffect(() => {
    fetchEnvironments();
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
      const data = await api.get(`/environments?site_id=${site.id}`);
      setEnvironments(data || []);
      if (data && data.length > 0) {
        setSelectedEnv(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching environments:', error);
    }
  };

  const fetchSystems = async (envId) => {
    try {
      const data = await api.get(`/systems?environment_id=${envId}`);
      setSystems(data || []);
      if (data && data.length > 0) {
        setSelectedSystem(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    setTimeout(() => setCopied({ ...copied, [key]: false }), 2000);
  };

  const getEnvName = () => {
    const env = environments.find(e => e.id === parseInt(selectedEnv));
    return env ? env.name : 'dev';
  };

  const renderDockerInstructions = () => {
    const logCollectorCmd = `docker run -d \\
  --name stackradar-docker-logs-collector \\
  --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e LOGRADAR_API_URL="${window.location.origin}" \\
  -e API_TOKEN="${site.api_token}" \\
  -e TENANT="${site.tenant_name || 'default'}" \\
  -e SITE="${site.name}" \\
  -e ENVIRONMENT="${getEnvName()}"${selectedSystem ? ` \\
  -e CONTAINER_FILTER="${selectedSystem}"` : ''} \\
  ghcr.io/gsotti/stackradar-docker-logs-collector:latest`;

    const statsCollectorCmd = `docker run -d \\
  --name stackradar-docker-stats-collector \\
  --restart unless-stopped \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -e LOGRADAR_API_URL="${window.location.origin}" \\
  -e API_TOKEN="${site.api_token}" \\
  -e COLLECTION_INTERVAL_MS="60000" \\
  ghcr.io/gsotti/stackradar-docker-stats-collector:latest`;

    const composeFile = `version: '3.8'

services:
  stackradar-docker-logs-collector:
    image: ghcr.io/gsotti/stackradar-docker-logs-collector:latest
    container_name: stackradar-docker-logs-collector
    restart: unless-stopped
    environment:
      LOGRADAR_API_URL: "${window.location.origin}"
      API_TOKEN: "${site.api_token}"
      TENANT: "${site.tenant_name || 'default'}"
      SITE: "${site.name}"
      ENVIRONMENT: "${getEnvName()}"${selectedSystem ? `\n      CONTAINER_FILTER: "${selectedSystem}"` : ''}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  stackradar-docker-stats-collector:
    image: ghcr.io/gsotti/stackradar-docker-stats-collector:latest
    container_name: stackradar-docker-stats-collector
    restart: unless-stopped
    environment:
      LOGRADAR_API_URL: "${window.location.origin}"
      API_TOKEN: "${site.api_token}"
      COLLECTION_INTERVAL_MS: "60000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Deploy the collectors on your Docker host to start collecting logs and metrics.
          </p>
        </div>

        {/* Environment/System Selection */}
        {(environments.length > 0 || systems.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {environments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Environment
                </label>
                <select
                  value={selectedEnv}
                  onChange={(e) => setSelectedEnv(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>
            )}
            {systems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter by System (Optional)
                </label>
                <select
                  value={selectedSystem}
                  onChange={(e) => setSelectedSystem(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All containers</option>
                  {systems.map((sys) => (
                    <option key={sys.id} value={sys.name}>{sys.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Log Collector Command */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Log Collector (Docker Run)
            </h3>
            <button
              onClick={() => copyToClipboard(logCollectorCmd, 'log-cmd')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {copied['log-cmd'] ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {logCollectorCmd}
          </pre>
        </div>

        {/* Stats Collector Command */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Stats Collector (Docker Run)
            </h3>
            <button
              onClick={() => copyToClipboard(statsCollectorCmd, 'stats-cmd')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {copied['stats-cmd'] ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {statsCollectorCmd}
          </pre>
        </div>

        {/* Docker Compose */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Docker Compose (Both Collectors)
            </h3>
            <button
              onClick={() => copyToClipboard(composeFile, 'compose')}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              {copied['compose'] ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
            {composeFile}
          </pre>
        </div>
      </div>
    );
  };

  const renderKubernetesInstructions = () => {
    return (
      <div className="space-y-4">
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            Deploy the log collector to your Kubernetes cluster using the provided manifests.
          </p>
        </div>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg">
          <code className="text-xs">
            kubectl apply -f https://raw.githubusercontent.com/your-repo/k8s-collector/main/deployment.yaml
          </code>
        </div>
      </div>
    );
  };

  const renderGenericInstructions = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Use the HTTP API to send logs and metrics from any platform:
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">API Endpoint</h4>
          <code className="block bg-gray-900 text-green-400 p-3 rounded-lg text-xs">
            POST {window.location.origin}/api/ingest/{site.api_token}
          </code>
        </div>
      </div>
    );
  };

  const content = (
    <>
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Site Type: <span className="font-bold capitalize">{site.site_type}</span>
        </span>
      </div>

      {site.site_type === 'docker' && renderDockerInstructions()}
      {site.site_type === 'kubernetes' && renderKubernetesInstructions()}
      {site.site_type === 'generic' && renderGenericInstructions()}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Setup Instructions - {site.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}
