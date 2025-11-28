#!/usr/bin/env node

/**
 * LogPilot Kubernetes Metrics Collector
 * 
 * Collects cluster metrics and sends them to LogPilot
 * Run as a CronJob in your cluster
 */

import https from 'https';
import fs from 'fs';

const LOGPILOT_URL = process.env.LOGPILOT_URL;
const API_TOKEN = process.env.API_TOKEN;
const KUBERNETES_SERVICE_HOST = process.env.KUBERNETES_SERVICE_HOST;
const KUBERNETES_SERVICE_PORT = process.env.KUBERNETES_SERVICE_PORT || '443';

// Read service account token
const SA_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const CA_CERT_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

async function k8sRequest(path) {
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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function collectMetrics() {
  console.log('Collecting Kubernetes metrics...');

  const metrics = {
    cluster_name: process.env.CLUSTER_NAME || 'default',
    node_count: 0,
    node_ready: 0,
    pod_count: 0,
    pod_running: 0,
    pod_pending: 0,
    pod_failed: 0,
    cpu_usage_percent: 0,
    memory_usage_percent: 0,
    deployment_count: 0,
    deployment_ready: 0,
    service_count: 0,
    pvc_count: 0,
    pvc_bound: 0,
    namespaces: [],
    alerts: []
  };

  try {
    // Get nodes
    const nodes = await k8sRequest('/api/v1/nodes');
    metrics.node_count = nodes.items?.length || 0;
    metrics.node_ready = nodes.items?.filter(n => 
      n.status?.conditions?.find(c => c.type === 'Ready' && c.status === 'True')
    ).length || 0;

    // Get pods
    const pods = await k8sRequest('/api/v1/pods');
    metrics.pod_count = pods.items?.length || 0;
    pods.items?.forEach(pod => {
      const phase = pod.status?.phase;
      if (phase === 'Running') metrics.pod_running++;
      else if (phase === 'Pending') metrics.pod_pending++;
      else if (phase === 'Failed') metrics.pod_failed++;
    });

    // Get deployments
    const deployments = await k8sRequest('/apis/apps/v1/deployments');
    metrics.deployment_count = deployments.items?.length || 0;
    metrics.deployment_ready = deployments.items?.filter(d => 
      d.status?.readyReplicas === d.status?.replicas
    ).length || 0;

    // Get services
    const services = await k8sRequest('/api/v1/services');
    metrics.service_count = services.items?.length || 0;

    // Get PVCs
    const pvcs = await k8sRequest('/api/v1/persistentvolumeclaims');
    metrics.pvc_count = pvcs.items?.length || 0;
    metrics.pvc_bound = pvcs.items?.filter(p => p.status?.phase === 'Bound').length || 0;

    // Get namespaces
    const namespaces = await k8sRequest('/api/v1/namespaces');
    metrics.namespaces = namespaces.items?.map(n => n.metadata?.name) || [];

    // Check for alerts
    if (metrics.node_ready < metrics.node_count) {
      metrics.alerts.push(`${metrics.node_count - metrics.node_ready} node(s) not ready`);
    }
    if (metrics.pod_failed > 0) {
      metrics.alerts.push(`${metrics.pod_failed} pod(s) in failed state`);
    }
    if (metrics.pod_pending > 5) {
      metrics.alerts.push(`${metrics.pod_pending} pod(s) pending`);
    }

    // Try to get metrics from metrics-server (optional)
    try {
      const nodeMetrics = await k8sRequest('/apis/metrics.k8s.io/v1beta1/nodes');
      if (nodeMetrics.items) {
        let totalCpu = 0, totalMemory = 0;
        let usedCpu = 0, usedMemory = 0;

        for (const node of nodes.items) {
          const allocatable = node.status?.allocatable;
          if (allocatable) {
            totalCpu += parseCpu(allocatable.cpu);
            totalMemory += parseMemory(allocatable.memory);
          }
        }

        for (const metric of nodeMetrics.items) {
          usedCpu += parseCpu(metric.usage?.cpu);
          usedMemory += parseMemory(metric.usage?.memory);
        }

        if (totalCpu > 0) metrics.cpu_usage_percent = (usedCpu / totalCpu) * 100;
        if (totalMemory > 0) metrics.memory_usage_percent = (usedMemory / totalMemory) * 100;
      }
    } catch (e) {
      console.log('Metrics server not available, skipping resource metrics');
    }

  } catch (error) {
    console.error('Error collecting metrics:', error.message);
    metrics.alerts.push(`Collection error: ${error.message}`);
  }

  return metrics;
}

function parseCpu(cpu) {
  if (!cpu) return 0;
  if (cpu.endsWith('n')) return parseInt(cpu) / 1e9;
  if (cpu.endsWith('m')) return parseInt(cpu) / 1000;
  return parseInt(cpu);
}

function parseMemory(mem) {
  if (!mem) return 0;
  const units = { Ki: 1024, Mi: 1024**2, Gi: 1024**3, Ti: 1024**4 };
  for (const [unit, multiplier] of Object.entries(units)) {
    if (mem.endsWith(unit)) {
      return parseInt(mem) * multiplier;
    }
  }
  return parseInt(mem);
}

async function sendMetrics(metrics) {
  const url = new URL(`/api/k8s/metrics/${API_TOKEN}`, LOGPILOT_URL);
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(metrics);
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

    const protocol = url.protocol === 'https:' ? https : await import('http');
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
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
  if (!LOGPILOT_URL || !API_TOKEN) {
    console.error('Missing LOGPILOT_URL or API_TOKEN environment variables');
    process.exit(1);
  }

  try {
    const metrics = await collectMetrics();
    console.log('Collected metrics:', JSON.stringify(metrics, null, 2));
    
    const result = await sendMetrics(metrics);
    console.log('Metrics sent successfully:', result);
  } catch (error) {
    console.error('Failed to collect/send metrics:', error.message);
    process.exit(1);
  }
}

main();
