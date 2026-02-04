#!/usr/bin/env node

import Docker from 'dockerode';
import fetch from 'node-fetch';

// Configuration from environment variables
const STACKRADAR_API_URL = process.env.STACKRADAR_API_URL || 'http://localhost:8000';
const API_TOKEN = process.env.API_TOKEN;
const TENANT = process.env.TENANT || 'default';
const SITE = process.env.SITE || 'docker-host';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const CONTAINER_FILTER = process.env.CONTAINER_FILTER || ''; // Regex pattern to filter container names
const LOG_LEVEL_MAPPING = process.env.LOG_LEVEL_MAPPING === 'true'; // Try to parse log levels from messages
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
const BATCH_INTERVAL_MS = parseInt(process.env.BATCH_INTERVAL_MS || '5000', 10);
const DEBUG = process.env.DEBUG === "true" || false;

if (!API_TOKEN) {
    console.error('ERROR: API_TOKEN environment variable is required');
    process.exit(1);
}

const docker = new Docker();
const logBuffer = [];
let batchTimeout = null;

// Parse log level from message
function parseLogLevel(message) {
    if (!LOG_LEVEL_MAPPING) return 'INFO';

    const upperMsg = message.toUpperCase();
    if (upperMsg.includes('ERROR') || upperMsg.includes('ERR')) return 'ERROR';
    if (upperMsg.includes('WARN') || upperMsg.includes('WARNING')) return 'WARN';
    if (upperMsg.includes('DEBUG') || upperMsg.includes('DBG')) return 'DEBUG';
    if (upperMsg.includes('FATAL') || upperMsg.includes('CRITICAL')) return 'FATAL';
    if (upperMsg.includes('INFO')) return 'INFO';

    return 'INFO';
}

// Send logs to stackradar API
async function sendLogs(logs) {
    if (logs.length === 0) return;

    try {
        const response = await fetch(`${STACKRADAR_API_URL}/api/ingest/${API_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({logs}),
        });

        if (!response.ok) {
            const error = await response.text();
            if (DEBUG) {
                console.error(`Failed to send logs: ${response.status} ${error}`);
            }
        }
    } catch (error) {
        if (DEBUG) {
            console.error('Error sending logs:', error.message);
        }
    }
}

// Flush log buffer
async function flushLogs() {
    if (logBuffer.length === 0) return;

    const logsToSend = logBuffer.splice(0, logBuffer.length);
    await sendLogs(logsToSend);
}

// Add log to buffer and flush if needed
function addLog(log) {
    logBuffer.push(log);

    if (logBuffer.length >= BATCH_SIZE) {
        clearTimeout(batchTimeout);
        flushLogs();
    } else {
        clearTimeout(batchTimeout);
        batchTimeout = setTimeout(flushLogs, BATCH_INTERVAL_MS);
    }
}

// Stream logs from a container
async function streamContainerLogs(container, containerInfo) {
    const containerName = containerInfo.Names[0].replace(/^\//, '');
    const imageName = containerInfo.Image;
    if (DEBUG) {
        console.log(`📦 Starting log collection from container: ${containerName}`);
    }

    try {
        const stream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
            timestamps: true,
            tail: 100, // Start with last 100 lines
        });

        stream.on('data', (chunk) => {
            // Docker log format: first 8 bytes are header, rest is message
            // Header: [stream_type, 0, 0, 0, size1, size2, size3, size4]
            const message = chunk.slice(8).toString('utf-8').trim();

            if (!message) return;

            // Parse timestamp and message if present
            let timestamp = new Date().toISOString();
            let logMessage = message;

            // Docker timestamps format: 2024-01-01T12:00:00.000000000Z message
            const timestampMatch = message.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(.*)$/);
            if (timestampMatch) {
                timestamp = timestampMatch[1];
                logMessage = timestampMatch[2];
            }

            const logEntry = {
                timestamp,
                level: parseLogLevel(logMessage),
                message: logMessage,
                source: containerName,
                tenant: TENANT,
                site: SITE,
                environment: ENVIRONMENT,
                system: imageName.split(':')[0], // Use image name without tag as system
                metadata: {
                    container_id: containerInfo.Id.substring(0, 12),
                    container_name: containerName,
                    image: imageName,
                },
            };

            addLog(logEntry);
        });

        stream.on('error', (error) => {
            if (DEBUG) {
                console.error(`Error streaming logs from ${containerName}:`, error.message);
            }
        });

        stream.on('end', () => {
            if (DEBUG) {
                console.log(`Stream ended for container: ${containerName}`);
            }
        });

    } catch (error) {
        if (DEBUG) {
            console.error(`Failed to stream logs from ${containerName}:`, error.message);
        }
    }
}

// Monitor containers and start log streaming
async function monitorContainers() {
    const containerFilter = CONTAINER_FILTER ? new RegExp(CONTAINER_FILTER) : null;
    const monitoredContainers = new Set();

    if (DEBUG) {
        console.log('🚀 Docker Log Collector started');
        console.log(`   API URL: ${STACKRADAR_API_URL}`);
        console.log(`   Tenant: ${TENANT}`);
        console.log(`   Site: ${SITE}`);
        console.log(`   Environment: ${ENVIRONMENT}`);
        console.log(`   Container Filter: ${CONTAINER_FILTER || 'all containers'}`);
        console.log('');
    }

    // Check for running containers every 10 seconds
    setInterval(async () => {
        try {
            const containers = await docker.listContainers({all: false});

            for (const containerInfo of containers) {
                const containerName = containerInfo.Names[0].replace(/^\//, '');
                const containerId = containerInfo.Id;

                // Skip if already monitoring
                if (monitoredContainers.has(containerId)) continue;

                // Skip if doesn't match the filter
                if (containerFilter && !containerFilter.test(containerName)) {
                    continue;
                }

                // Start monitoring this container
                monitoredContainers.add(containerId);
                const container = docker.getContainer(containerId);
                streamContainerLogs(container, containerInfo);
            }

            // Clean up stopped containers from monitoring set
            const currentContainerIds = new Set(containers.map(c => c.Id));
            for (const id of monitoredContainers) {
                if (!currentContainerIds.has(id)) {
                    monitoredContainers.delete(id);
                }
            }

        } catch (error) {
            if (DEBUG) {
                console.error('Error monitoring containers:', error.message);
            }
        }
    }, 10000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
    if (DEBUG) {
        console.log('\n🛑 Shutting down...');

    }
    await flushLogs();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (DEBUG) {
        console.log('\n🛑 Shutting down...');
    }
    await flushLogs();
    process.exit(0);
});

// Start monitoring
monitorContainers();
