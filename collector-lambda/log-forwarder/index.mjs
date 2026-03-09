/**
 * StackRadar Lambda Log Forwarder
 *
 * Receives CloudWatch Logs events via subscription filters and forwards
 * them to the StackRadar ingest API. Deploy this Lambda and attach
 * subscription filters to the log groups you want to monitor.
 *
 * Environment variables:
 *   STACKRADAR_URL        - Base URL of StackRadar instance (e.g. https://stackradar.example.com)
 *   STACKRADAR_API_TOKEN  - Site API token for authentication
 *   STACKRADAR_ENVIRONMENT - Environment name (default: production)
 */

import zlib from 'zlib';
import https from 'https';
import http from 'http';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const STACKRADAR_URL = process.env.STACKRADAR_URL;
const STACKRADAR_API_TOKEN = process.env.STACKRADAR_API_TOKEN;
const STACKRADAR_ENVIRONMENT = process.env.STACKRADAR_ENVIRONMENT || 'production';

const BATCH_SIZE = 100;

/**
 * Extract the Lambda function name from a CloudWatch log group path.
 * /aws/lambda/my-function-name → my-function-name
 * Falls back to the full log group name if the pattern does not match.
 */
function extractFunctionName(logGroup) {
  const match = logGroup.match(/^\/aws\/lambda\/(.+)$/);
  return match ? match[1] : logGroup;
}

/**
 * Detect the log level from a log message string.
 * Checks for a known prefix word at the start of the message, then falls back
 * to a substring scan for Lambda platform lines (START / END / REPORT).
 */
function detectLogLevel(message) {
  const trimmed = message.trimStart();

  // Common structured prefix patterns: "ERROR ", "WARN ", "INFO ", etc.
  const prefixMatch = trimmed.match(/^(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\s/i);
  if (prefixMatch) {
    const raw = prefixMatch[1].toUpperCase();
    // Normalise WARN → warn, WARNING → warn
    if (raw === 'WARN' || raw === 'WARNING') return 'warn';
    return raw.toLowerCase();
  }

  // Lambda platform messages
  if (/^(START|END|REPORT)\s+RequestId:/.test(trimmed)) {
    return 'info';
  }

  return 'info';
}

/**
 * Parse a Lambda REPORT line into structured metadata fields.
 * Example input:
 *   REPORT RequestId: abc-123 Duration: 123.45 ms Billed Duration: 200 ms
 *          Memory Size: 128 MB Max Memory Used: 75 MB Init Duration: 234.56 ms
 */
function parseReportLine(message) {
  const metadata = { source: 'aws-lambda' };

  const requestId = message.match(/RequestId:\s+([^\s]+)/);
  if (requestId) metadata.request_id = requestId[1];

  const duration = message.match(/Duration:\s+([\d.]+)\s+ms/);
  if (duration) metadata.duration_ms = parseFloat(duration[1]);

  const billedDuration = message.match(/Billed Duration:\s+(\d+)\s+ms/);
  if (billedDuration) metadata.billed_duration_ms = parseInt(billedDuration[1], 10);

  const memorySize = message.match(/Memory Size:\s+(\d+)\s+MB/);
  if (memorySize) metadata.memory_size_mb = parseInt(memorySize[1], 10);

  const memoryUsed = message.match(/Max Memory Used:\s+(\d+)\s+MB/);
  if (memoryUsed) metadata.memory_used_mb = parseInt(memoryUsed[1], 10);

  const initDuration = message.match(/Init Duration:\s+([\d.]+)\s+ms/);
  if (initDuration) metadata.init_duration_ms = parseFloat(initDuration[1]);

  return metadata;
}

/**
 * Extract a request ID from a log message when it appears inline.
 * Lambda runtimes often embed the request ID in every line.
 * Example: "2024-01-01T00:00:00.000Z\tabc-123\tINFO\tsome message"
 */
function extractRequestId(message) {
  // Tab-delimited runtime format: timestamp \t requestId \t level \t message
  const tabMatch = message.match(/^[^\t]+\t([0-9a-f-]{36})\t/i);
  if (tabMatch) return tabMatch[1];
  return null;
}

/**
 * Map a single CloudWatch log event to a StackRadar log entry.
 */
function mapLogEvent(event, logGroup, logStream, functionName) {
  const rawMessage = event.message.replace(/\n$/, ''); // strip trailing newline
  const level = detectLogLevel(rawMessage);
  const isReport = /^REPORT\s+RequestId:/.test(rawMessage.trimStart());

  const metadata = isReport
    ? parseReportLine(rawMessage)
    : { source: 'aws-lambda' };

  metadata.log_stream = logStream;

  // Attempt to extract an inline request ID if not already set by REPORT parsing
  if (!metadata.request_id) {
    const requestId = extractRequestId(rawMessage);
    if (requestId) metadata.request_id = requestId;
  }

  return {
    timestamp: new Date(event.timestamp).toISOString(),
    level,
    message: rawMessage,
    system: functionName,
    environment: STACKRADAR_ENVIRONMENT,
    metadata,
  };
}

/**
 * POST a batch of log entries to the StackRadar ingest endpoint.
 * Uses Node.js built-in https/http — no external dependencies.
 */
function postBatch(entries) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `/api/ingest/${STACKRADAR_API_TOKEN}`,
      STACKRADAR_URL
    );

    const body = JSON.stringify({ logs: entries });
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Send all log entries, splitting into batches of BATCH_SIZE if needed.
 */
async function sendEntries(entries) {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await postBatch(batch);
    console.log(`Forwarded batch of ${batch.length} log entries to StackRadar`);
  }
}

/**
 * Lambda handler entry point.
 *
 * CloudWatch delivers the payload as a base64-encoded gzipped JSON object
 * under event.awslogs.data.
 */
export async function handler(event) {
  if (!STACKRADAR_URL || !STACKRADAR_API_TOKEN) {
    // Log the misconfiguration but return success to avoid CloudWatch retries
    console.error(
      'Missing required environment variables: STACKRADAR_URL and/or STACKRADAR_API_TOKEN'
    );
    return { statusCode: 200 };
  }

  let cwEvent;
  try {
    const compressed = Buffer.from(event.awslogs.data, 'base64');
    const decompressed = await gunzip(compressed);
    cwEvent = JSON.parse(decompressed.toString('utf8'));
  } catch (err) {
    console.error('Failed to decompress or parse CloudWatch event:', err.message);
    return { statusCode: 200 };
  }

  // Skip control messages (e.g. messageType === 'CONTROL_MESSAGE')
  if (cwEvent.messageType !== 'DATA_MESSAGE') {
    console.log(`Skipping non-data message type: ${cwEvent.messageType}`);
    return { statusCode: 200 };
  }

  const { logGroup, logStream, logEvents } = cwEvent;

  if (!Array.isArray(logEvents) || logEvents.length === 0) {
    console.log('No log events in payload');
    return { statusCode: 200 };
  }

  const functionName = extractFunctionName(logGroup);
  console.log(
    `Processing ${logEvents.length} events from ${logGroup} (${logStream})`
  );

  const entries = logEvents.map((e) =>
    mapLogEvent(e, logGroup, logStream, functionName)
  );

  try {
    await sendEntries(entries);
    console.log(
      `Successfully forwarded ${entries.length} log entries for ${functionName}`
    );
  } catch (err) {
    // Log the error but return success to prevent CloudWatch from retrying,
    // which could cause duplicate log entries.
    console.error('Failed to forward logs to StackRadar:', err.message);
  }

  return { statusCode: 200 };
}
