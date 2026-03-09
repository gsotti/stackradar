# StackRadar Lambda Metrics Collector

A scheduled AWS Lambda function that pulls CloudWatch metrics for all Lambda
functions in the region every 5 minutes and forwards them to StackRadar.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `STACKRADAR_URL` | Yes | Base URL of your StackRadar instance (e.g. `https://stackradar.example.com`) |
| `STACKRADAR_API_TOKEN` | Yes | Site API token from the StackRadar site settings |
| `FUNCTION_PREFIX` | No | Only monitor functions whose names start with this string (e.g. `myapp-`). If unset, all functions are monitored. |
| `EXCLUDE_SELF` | No | Set to `false` to include the metrics collector itself in results. Defaults to `true`. |

## Required IAM Permissions

Attach a policy with at least:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "lambda:ListFunctions"
      ],
      "Resource": "*"
    }
  ]
}
```

## Deployment

### Manual

1. Zip the directory contents (`index.mjs` + `package.json`):
   ```bash
   zip -j metrics-collector.zip index.mjs package.json
   ```
2. Create a Lambda function (Node.js 18.x or later, handler: `index.handler`).
3. Set the environment variables listed above.
4. Attach the IAM policy above to the function's execution role.
5. Create an EventBridge (CloudWatch Events) rule with schedule `rate(5 minutes)`,
   targeting this Lambda function.

### CloudFormation

See `collector-lambda/cloudformation.yaml` for a one-click deployment template
that provisions both this function and the log forwarder.

## Metrics Collected

The following CloudWatch metrics are fetched per function over a 5-minute window:

| CloudWatch Metric | Stat | Field |
|---|---|---|
| Invocations | Sum | `invocations` |
| Errors | Sum | `errors` |
| Throttles | Sum | `throttles` |
| Duration | Average | `avg_duration_ms` |
| Duration | Maximum | `max_duration_ms` |
| ConcurrentExecutions | Maximum | `concurrent_executions` |

Function metadata (`memory_size_mb`, `timeout_seconds`, `runtime`, `last_modified`)
is sourced from `lambda:ListFunctions` and included in every payload.
