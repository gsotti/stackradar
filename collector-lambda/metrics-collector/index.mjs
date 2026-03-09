/**
 * StackRadar Lambda Metrics Collector
 *
 * Triggered by EventBridge every 5 minutes. Discovers all Lambda functions in
 * the region, fetches CloudWatch metrics for each, and POSTs the result to
 * the StackRadar Lambda metrics ingest endpoint.
 */

import https from 'https';
import http from 'http';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';

// --- Configuration -----------------------------------------------------------

const STACKRADAR_URL      = process.env.STACKRADAR_URL;
const STACKRADAR_API_TOKEN = process.env.STACKRADAR_API_TOKEN;
const FUNCTION_PREFIX     = process.env.FUNCTION_PREFIX || '';
// Default true: exclude the metrics collector itself to avoid self-referential noise
const EXCLUDE_SELF        = process.env.EXCLUDE_SELF !== 'false';

const SELF_FUNCTION_NAME  = process.env.AWS_LAMBDA_FUNCTION_NAME || '';

// CloudWatch constants
const METRIC_PERIOD_SECONDS = 300;        // 5-minute buckets match our schedule
const LOOKBACK_MINUTES      = 10;         // query last 10 min to guarantee a data point
const MAX_QUERIES_PER_CALL  = 490;        // CloudWatch limit is 500; leave headroom

// Metric definitions: [CloudWatch name, stat, output field]
const METRIC_DEFS = [
  ['Invocations',          'Sum',     'invocations'],
  ['Errors',               'Sum',     'errors'],
  ['Throttles',            'Sum',     'throttles'],
  ['Duration',             'Average', 'avg_duration_ms'],
  ['Duration',             'Maximum', 'max_duration_ms'],
  ['ConcurrentExecutions', 'Maximum', 'concurrent_executions'],
];

// --- AWS clients (reused across warm invocations) ----------------------------

const lambdaClient     = new LambdaClient({});
const cloudwatchClient = new CloudWatchClient({});

// --- Function discovery ------------------------------------------------------

async function listAllFunctions() {
  const functions = [];
  let marker;

  do {
    const cmd = new ListFunctionsCommand({ Marker: marker });
    const response = await lambdaClient.send(cmd);

    for (const fn of response.Functions || []) {
      const name = fn.FunctionName;

      if (FUNCTION_PREFIX && !name.startsWith(FUNCTION_PREFIX)) continue;
      if (EXCLUDE_SELF && name === SELF_FUNCTION_NAME) continue;

      functions.push({
        function_name:    name,
        memory_size_mb:   fn.MemorySize   || 0,
        timeout_seconds:  fn.Timeout      || 0,
        runtime:          fn.Runtime      || 'unknown',
        last_modified:    fn.LastModified || null,
      });
    }

    marker = response.NextMarker;
  } while (marker);

  return functions;
}

// --- CloudWatch metric queries -----------------------------------------------

/**
 * Build MetricDataQuery entries for a slice of functions.
 * Each query ID encodes the function index within the slice and the metric name
 * so we can map results back without an additional lookup structure.
 */
function buildQueries(functions) {
  const queries = [];

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    for (const [metricName, stat, field] of METRIC_DEFS) {
      // IDs must match [a-z][a-zA-Z0-9_]* and be <= 256 chars
      const id = `f${i}_${field}`;
      queries.push({
        Id: id,
        MetricStat: {
          Metric: {
            Namespace:  'AWS/Lambda',
            MetricName: metricName,
            Dimensions: [{ Name: 'FunctionName', Value: fn.function_name }],
          },
          Period: METRIC_PERIOD_SECONDS,
          Stat:   stat,
        },
        ReturnData: true,
      });
    }
  }

  return queries;
}

/**
 * Fetch all metric data for a set of functions, handling CloudWatch pagination
 * and the 500-query-per-call limit by splitting into batches.
 */
async function fetchMetricData(functions, startTime, endTime) {
  // Map: functionIndex -> { field: value }
  const results = {};

  const queriesPerFunction = METRIC_DEFS.length; // 6
  const maxFunctionsPerCall = Math.floor(MAX_QUERIES_PER_CALL / queriesPerFunction);

  for (let batchStart = 0; batchStart < functions.length; batchStart += maxFunctionsPerCall) {
    const batchFunctions = functions.slice(batchStart, batchStart + maxFunctionsPerCall);
    const queries = buildQueries(batchFunctions);

    let nextToken;
    // Accumulate results across CloudWatch pagination
    const batchValues = {}; // id -> latest value

    do {
      const cmd = new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime:  startTime,
        EndTime:    endTime,
        NextToken:  nextToken,
      });

      const response = await cloudwatchClient.send(cmd);

      for (const result of response.MetricDataResults || []) {
        if (result.Values && result.Values.length > 0) {
          // Values are ordered newest-first; take the most recent data point
          batchValues[result.Id] = result.Values[0];
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    // Map collected values back to function records
    for (let i = 0; i < batchFunctions.length; i++) {
      const globalIndex = batchStart + i;
      results[globalIndex] = {};

      for (const [, , field] of METRIC_DEFS) {
        const id = `f${i}_${field}`;
        results[globalIndex][field] = batchValues[id] ?? 0;
      }
    }
  }

  return results;
}

// --- HTTP POST to StackRadar -------------------------------------------------

function postJSON(urlString, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body });
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

// --- Main handler ------------------------------------------------------------

export async function handler(event) {
  if (!STACKRADAR_URL || !STACKRADAR_API_TOKEN) {
    throw new Error('STACKRADAR_URL and STACKRADAR_API_TOKEN environment variables are required');
  }

  const endTime   = new Date();
  const startTime = new Date(endTime.getTime() - LOOKBACK_MINUTES * 60 * 1000);

  console.log(`Collecting Lambda metrics [${startTime.toISOString()} – ${endTime.toISOString()}]`);

  // 1. Discover functions
  let functions;
  try {
    functions = await listAllFunctions();
  } catch (err) {
    console.error('Failed to list Lambda functions:', err.message);
    throw err;
  }

  console.log(`Discovered ${functions.length} function(s)${FUNCTION_PREFIX ? ` matching prefix "${FUNCTION_PREFIX}"` : ''}`);

  if (functions.length === 0) {
    return { statusCode: 200, body: 'No functions to monitor' };
  }

  // 2. Fetch CloudWatch metrics
  let metricsByIndex;
  try {
    metricsByIndex = await fetchMetricData(functions, startTime, endTime);
  } catch (err) {
    console.error('Failed to fetch CloudWatch metrics:', err.message);
    // Send what we have — metadata is still valuable even without metrics
    metricsByIndex = {};
  }

  // 3. Assemble per-function records
  const functionPayloads = functions.map((fn, i) => {
    const m = metricsByIndex[i] || {};
    return {
      function_name:          fn.function_name,
      invocations:            Math.round(m.invocations            ?? 0),
      errors:                 Math.round(m.errors                 ?? 0),
      throttles:              Math.round(m.throttles               ?? 0),
      avg_duration_ms:        m.avg_duration_ms                   ?? 0,
      max_duration_ms:        m.max_duration_ms                   ?? 0,
      concurrent_executions:  Math.round(m.concurrent_executions  ?? 0),
      memory_size_mb:         fn.memory_size_mb,
      timeout_seconds:        fn.timeout_seconds,
      runtime:                fn.runtime,
      last_modified:          fn.last_modified,
    };
  });

  const payload = { functions: functionPayloads };

  // 4. POST to StackRadar
  const url = `${STACKRADAR_URL}/api/lambda/metrics/${STACKRADAR_API_TOKEN}`;
  try {
    const result = await postJSON(url, payload);
    console.log(`Metrics sent successfully (${result.status}): ${functions.length} function(s)`);
  } catch (err) {
    console.error('Failed to send metrics to StackRadar:', err.message);
    // Do not rethrow — a delivery failure should not cause the Lambda to appear
    // as errored in CloudWatch (which would create a feedback loop).
  }

  return {
    statusCode: 200,
    body: `Collected metrics for ${functions.length} function(s)`,
  };
}
