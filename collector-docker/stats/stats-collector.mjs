#!/usr/bin/env node

import Docker from 'dockerode';
import fetch from 'node-fetch';
import os from 'os';

// Configuration from environment variables
const LOGRADAR_API_URL = process.env.LOGRADAR_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.API_TOKEN;
const COLLECTION_INTERVAL_MS = parseInt(process.env.COLLECTION_INTERVAL_MS || '60000', 10); // 1 minute default
const DEBUG = process.env.DEBUG === "true" || false;
// Note: We report host-level system stats (not filtered per container)

if (!API_TOKEN) {
    console.error('ERROR: API_TOKEN environment variable is required');
    process.exit(1);
}

const docker = new Docker();

// Get host system info
function getHostStats() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const cpus = os.cpus();

    return {
        totalMemory,
        freeMemory,
        usedMemory,
        memoryUsagePercent,
        cpuCount: cpus.length,
    };
}

// Host-level CPU percent using os.cpus() tick deltas
function readAggregateCpuTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        const times = cpu.times;
        idle += times.idle;
        total += times.user + times.nice + times.sys + times.irq + times.idle;
    }
    return {idle, total};
}

let prevCpuTimes = null;

function calculateHostCPUPercent() {
    const now = readAggregateCpuTimes();
    if (!prevCpuTimes) {
        prevCpuTimes = now;
        return 0; // first sample, insufficient data
    }
    const idleDelta = now.idle - prevCpuTimes.idle;
    const totalDelta = now.total - prevCpuTimes.total;
    prevCpuTimes = now;
    if (totalDelta <= 0) return 0;
    const busy = Math.max(totalDelta - idleDelta, 0);
    return (busy / totalDelta) * 100;
}

// Collect stats from all containers
async function collectContainerStats() {
    try {
        const containers = await docker.listContainers({all: true});

        let runningCount = 0;
        let stoppedCount = 0;
        let pausedCount = 0;
        // For system-level stats we don't aggregate per-container CPU/memory

        const hostStats = getHostStats();

        for (const containerInfo of containers) {
            const containerName = containerInfo.Names[0].replace(/^\//, '');

            // Count by state
            const state = containerInfo.State;
            if (state === 'running') {
                runningCount++;
            } else if (state === 'exited' || state === 'dead') {
                stoppedCount++;
            } else if (state === 'paused') {
                pausedCount++;
            }
        }

        // Host-level CPU percent (not per-container)
        const cpuUsagePercent = calculateHostCPUPercent();
        // Host-level memory usage percent
        const memoryUsagePercent = hostStats.memoryUsagePercent;

        const metrics = {
            // Container counts
            node_count: 1, // Single Docker host
            pod_count: containers.length,
            pod_running: runningCount,
            pod_pending: 0,
            pod_failed: stoppedCount,
            deployment_count: runningCount,
            deployment_ready: runningCount,

            // Resource usage (aggregate across all containers)
            cpu_usage_percent: Math.round(cpuUsagePercent * 100) / 100,
            memory_usage_percent: Math.round(memoryUsagePercent * 100) / 100,

            // Network and storage
            pvc_count: 0,
            pvc_bound: 0,
        };

        return metrics;

    } catch (error) {
        if (DEBUG) {
            console.error('Error collecting container stats:', error.message);
        }
        return null;
    }
}

// Send metrics to LogRadar API
async function sendMetrics(metrics) {
    try {
        const response = await fetch(`${LOGRADAR_API_URL}/api/k8s/metrics/${API_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metrics),
        });

        if (!response.ok) {
            const error = await response.text();
            if (DEBUG) {

                console.error(`Failed to send metrics: ${response.status} ${error}`);
            }
            return false;
        }

        return true;
    } catch (error) {
        if (DEBUG) {
            console.error('Error sending metrics:', error.message);
        }
        return false;
    }
}

// Send stats history for tracking over time
async function sendStatsHistory(metrics) {
    try {
        const response = await fetch(`${LOGRADAR_API_URL}/api/k8s/stats/${API_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metrics),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to send stats history: ${response.status} ${error}`);
            return false;
        }
        if (DEBUG) {
            console.log('✅ Stats history sent successfully');
        }
        return true;

    } catch (error) {
        if (DEBUG) {
            console.error('Error sending stats history:', error.message);
        }
        return false;
    }
}

// Print current stats to console
function printStats(metrics) {
    console.log('\n📊 Docker Stats:');
    console.log(`   Containers: ${metrics.pod_running}/${metrics.pod_count} running`);
    console.log(`   CPU Usage: ${metrics.cpu_usage_percent.toFixed(2)}%`);
    console.log(`   Memory Usage: ${metrics.memory_usage_percent.toFixed(2)}%`);
    console.log('');
}

// Main collection loop
async function startCollection() {
    if (DEBUG) {
        console.log('🚀 Docker Stats Collector started');
        console.log(`   API URL: ${LOGRADAR_API_URL}`);
        console.log(`   Collection Interval: ${COLLECTION_INTERVAL_MS}ms`);
        console.log('');
    }

    // Initial collection
    const initialMetrics = await collectContainerStats();
    if (initialMetrics) {
        printStats(initialMetrics);
        await sendMetrics(initialMetrics);
    }

    // Periodic collection
    setInterval(async () => {
        const metrics = await collectContainerStats();
        if (metrics) {
            if (DEBUG) {
                printStats(metrics);
            }
            await sendMetrics(metrics);
            await sendStatsHistory(metrics);
        }
    }, COLLECTION_INTERVAL_MS);
}

// Graceful shutdown
process.on('SIGINT', () => {
    if (DEBUG) {
        console.log('\n🛑 Shutting down...');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (DEBUG) {
        console.log('\n🛑 Shutting down...');
    }
    process.exit(0);
});

// Start collection
startCollection();
