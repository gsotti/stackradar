#!/usr/bin/env node

/**
 * LogRadar Kubernetes Pod Log Collector
 *
 * Collects logs from a single specified pod and sends them to LogRadar
 * Run as a sidecar container or deployment
 */

import https from 'https';
import http from 'http';
import fs from 'fs';

const LOGRADAR_URL = process.env.LOGRADAR_URL;
const API_TOKEN = process.env.API_TOKEN;
const KUBERNETES_SERVICE_HOST = process.env.KUBERNETES_SERVICE_HOST;
const KUBERNETES_SERVICE_PORT = process.env.KUBERNETES_SERVICE_PORT || '443';
const CLUSTER_NAME = process.env.CLUSTER_NAME || 'default';

// Pod-specific configuration
const POD_NAMESPACE = process.env.POD_NAMESPACE;
const POD_LABEL_SELECTOR = process.env.POD_LABEL_SELECTOR; // e.g., "app.kubernetes.io/name=api-chart"
const LOG_TAIL_LINES = parseInt(process.env.LOG_TAIL_LINES) || 100;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 10000; // Default 10 seconds
const FOLLOW_LOGS = process.env.FOLLOW_LOGS !== 'false'; // Default true

// LogRadar metadata
const TENANT = process.env.TENANT || 'default';
const SYSTEM_TYPE = process.env.SYSTEM_TYPE || 'kubernetes';
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';

// Cached pod name when using label selector
let resolvedPodName = null;

// Read service account token
const SA_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_CERT_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

async function k8sRequest(path, parseJSON = true) {
  const token = fs.readFileSync(SA_TOKEN_PATH, 'utf8');
  const ca = fs.readFileSync(CA_CERT_PATH);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: KUBERNETES_SERVICE_HOST,
      port: KUBERNETES_SERVICE_PORT,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      ca: ca
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (parseJSON) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        } else {
          resolve(data); // Return raw text for logs
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function resolvePodName() {
  // Find the pod by label selector
  try {
    const podsPath = `/api/v1/namespaces/${POD_NAMESPACE}/pods?labelSelector=${encodeURIComponent(POD_LABEL_SELECTOR)}`;
    const response = await k8sRequest(podsPath, true);

    if (response.items && response.items.length > 0) {
      // Get the first running pod
      const runningPod = response.items.find(pod => pod.status.phase === 'Running');
      if (runningPod) {
        return runningPod.metadata.name;
      }
      // If no running pod, take the first one
      return response.items[0].metadata.name;
    }
  } catch (error) {
    console.error('Error resolving pod by label selector:', error.message);
  }

  return null;
}

async function collectPodLogs(sinceTime = null) {
  // Resolve pod name if using label selector
  const targetPodName = await resolvePodName();

  if (!targetPodName) {
    console.error('Could not resolve pod name');
    return { success: 0, failed: 1 };
  }

  // Update resolved pod name cache
  if (resolvedPodName !== targetPodName) {
    resolvedPodName = targetPodName;
    console.log(`Resolved target pod: ${POD_NAMESPACE}/${targetPodName}`);
  }

  console.log(`Collecting logs for ${POD_NAMESPACE}/${targetPodName}...`);

  try {
    // Build log request path
    let logPath = `/api/v1/namespaces/${POD_NAMESPACE}/pods/${targetPodName}/log?tailLines=${LOG_TAIL_LINES}`;

    if (sinceTime) {
      logPath += `&sinceTime=${sinceTime}`;
    }

    // Get pod logs
    const logs = await k8sRequest(logPath, false);

    if (logs && typeof logs === 'string') {
      // Split logs into individual lines
      const logLines = logs.split('\n').filter(line => line.trim());

      console.log(`Collected ${logLines.length} log lines`);

      // Auto-detect application from pod name if not set
      const appName = targetPodName.split('-').slice(0, 2).join('-');

      // Send each log line to LogRadar
      let successCount = 0;
      for (const logLine of logLines) {
        if (logLine.trim()) {
          await sendLog({
            level: detectLogLevel(logLine),
            message: logLine,
            source: `${POD_NAMESPACE}/${targetPodName}`,
            tenant: TENANT,
            system_type: SYSTEM_TYPE,
            environment: ENVIRONMENT,
            application: appName,
            metadata: {
              cluster: CLUSTER_NAME,
              namespace: POD_NAMESPACE,
              pod: targetPodName
            }
          });
          successCount++;
        }
      }

      return { success: successCount, failed: 0 };
    }

    return { success: 0, failed: 0 };
  } catch (error) {
    console.error('Error collecting pod logs:', error.message);
    return { success: 0, failed: 1 };
  }
}

function detectLogLevel(logLine) {
  const line = logLine.toLowerCase();
  if (line.includes('error') || line.includes('fatal') || line.includes('exception')) return 'ERROR';
  if (line.includes('warn')) return 'WARNING';
  if (line.includes('debug')) return 'DEBUG';
  return 'INFO';
}

async function sendLog(log) {
  const url = new URL(`/api/ingest/${API_TOKEN}/single`, LOGRADAR_URL);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(log);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Validate required environment variables
  if (!LOGRADAR_URL || !API_TOKEN) {
    console.error('Missing LOGRADAR_URL or API_TOKEN environment variables');
    process.exit(1);
  }

  if (!POD_NAMESPACE) {
    console.error('Missing POD_NAMESPACE environment variable');
    process.exit(1);
  }

  if (!POD_LABEL_SELECTOR) {
    console.error('Missing POD_LABEL_SELECTOR environment variable');
    console.error('Required environment variables:');
    console.error('  - POD_NAMESPACE: The namespace of the pod to collect logs from');
    console.error('  - POD_LABEL_SELECTOR: Label selector to find the pod (e.g., "app.kubernetes.io/name=api-chart")');
    console.error('Optional environment variables:');
    console.error('  - LOG_TAIL_LINES: Number of log lines to collect (default: 100)');
    console.error('  - POLL_INTERVAL: Polling interval in milliseconds (default: 10000)');
    console.error('  - FOLLOW_LOGS: Whether to continuously follow logs (default: true)');
    console.error('  - TENANT: Tenant name (default: "default")');
    console.error('  - SYSTEM_TYPE: System type (default: "kubernetes")');
    console.error('  - ENVIRONMENT: Environment name (default: "production")');
    console.error('  - APPLICATION: Application name (auto-detected from pod name if not set)');
    console.error('  - CLUSTER_NAME: Cluster name (default: "default")');
    process.exit(1);
  }

  console.log('LogRadar Pod Log Collector started');
  console.log(`Target: ${POD_NAMESPACE} with labels: ${POD_LABEL_SELECTOR}`);
  console.log(`Cluster: ${CLUSTER_NAME}`);
  console.log(`Follow mode: ${FOLLOW_LOGS ? 'enabled' : 'disabled'}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);

  let lastCollectionTime = null;

  // Main collection loop
  while (true) {
    try {
      const stats = await collectPodLogs(lastCollectionTime);
      console.log(`Log collection complete: ${stats.success} sent, ${stats.failed} failed`);

      // Update last collection time
      lastCollectionTime = new Date().toISOString();

      if (!FOLLOW_LOGS) {
        console.log('Follow mode disabled, exiting after single collection');
        break;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      console.error('Error in collection loop:', error.message);

      if (!FOLLOW_LOGS) {
        process.exit(1);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

main();
