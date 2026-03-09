# StackRadar Lambda Log Forwarder

Forwards AWS Lambda logs from CloudWatch to StackRadar via subscription filters.

## How it works

1. You attach a CloudWatch Logs subscription filter to one or more log groups (e.g. `/aws/lambda/my-function`).
2. On each batch of log events CloudWatch invokes this Lambda.
3. The forwarder decompresses the payload, maps each log event to the StackRadar format, and POSTs the batch to your StackRadar ingest endpoint.
4. Function name is extracted automatically from the log group path (`/aws/lambda/<name>`).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `STACKRADAR_URL` | Yes | Base URL of your StackRadar instance (e.g. `https://stackradar.example.com`) |
| `STACKRADAR_API_TOKEN` | Yes | Site API token from the StackRadar dashboard |
| `STACKRADAR_ENVIRONMENT` | No | Environment name sent with every log entry (default: `production`) |

## Deployment

### 1. Package the function

```bash
zip -j log-forwarder.zip index.mjs package.json
```

### 2. Create the Lambda function

```bash
aws lambda create-function \
  --function-name stackradar-log-forwarder \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://log-forwarder.zip \
  --role arn:aws:iam::<account-id>:role/stackradar-log-forwarder \
  --environment "Variables={
    STACKRADAR_URL=https://stackradar.example.com,
    STACKRADAR_API_TOKEN=your-site-api-token,
    STACKRADAR_ENVIRONMENT=production
  }"
```

### 3. Grant CloudWatch Logs permission to invoke the function

```bash
aws lambda add-permission \
  --function-name stackradar-log-forwarder \
  --statement-id allow-cloudwatch-logs \
  --action lambda:InvokeFunction \
  --principal logs.amazonaws.com \
  --source-account <account-id>
```

### 4. Create a subscription filter for each log group

```bash
aws logs put-subscription-filter \
  --log-group-name /aws/lambda/my-function \
  --filter-name stackradar-forwarder \
  --filter-pattern "" \
  --destination-arn arn:aws:lambda:<region>:<account-id>:function:stackradar-log-forwarder
```

Repeat step 4 for every Lambda log group you want to monitor. An empty `--filter-pattern` captures all log events.

## IAM permissions

The forwarder's execution role needs only the standard Lambda execution policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

No additional AWS permissions are required — the forwarder only calls the external StackRadar API.

## Log level detection

| Message pattern | Level |
|---|---|
| Starts with `ERROR` | `error` |
| Starts with `WARN` / `WARNING` | `warn` |
| Starts with `INFO` | `info` |
| Starts with `DEBUG` | `debug` |
| Starts with `TRACE` | `trace` |
| `START RequestId:` / `END RequestId:` / `REPORT RequestId:` | `info` |
| Everything else | `info` |

`REPORT` lines are also parsed for duration, billed duration, memory size, and memory used, which are stored as structured metadata fields.
