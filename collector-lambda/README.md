# StackRadar Lambda Collectors

Monitor AWS Lambda functions with StackRadar — zero changes to your existing functions.

Two lightweight Lambda collectors handle everything:

| Collector | Purpose | Location |
|-----------|---------|----------|
| **Log Forwarder** | Real-time log forwarding via CloudWatch subscription filters | `./log-forwarder/` |
| **Metrics Collector** | Periodic metrics collection from CloudWatch (invocations, errors, duration) | `./metrics-collector/` |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AWS Account                                            │
│                                                         │
│  Your Lambda Functions ──▶ CloudWatch Log Groups        │
│                                   │                     │
│                        Subscription Filters             │
│                                   ▼                     │
│                         ┌──────────────────┐            │
│                         │  Log Forwarder   │────────────────▶ StackRadar /api/ingest/{token}
│                         └──────────────────┘            │
│                                                         │
│  CloudWatch Metrics                                     │
│          │                                              │
│  EventBridge (every 5 min)                              │
│          ▼                                              │
│  ┌──────────────────────┐                               │
│  │  Metrics Collector   │────────────────────────────────▶ StackRadar /api/lambda/metrics/{token}
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- An AWS account with permissions to create Lambda functions, IAM roles, CloudWatch subscription filters, and EventBridge rules
- A StackRadar instance with an `aws_lambda` site configured — copy the site's API token
- Node.js 18+ (for building the collector code locally before uploading)
- AWS CLI configured (`aws configure`)

---

## Quick Start with CloudFormation

This is the recommended approach. The template deploys both collectors and all required IAM roles in one step.

### 1. Build the collector zip files

```bash
# Log Forwarder
cd collector-lambda/log-forwarder
npm install
zip -r ../log-forwarder.zip .

# Metrics Collector
cd ../metrics-collector
npm install
zip -r ../metrics-collector.zip .

cd ../..
```

### 2. Deploy the CloudFormation stack

```bash
aws cloudformation deploy \
  --template-file collector-lambda/cloudformation.yaml \
  --stack-name stackradar-lambda-collectors \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    StackRadarUrl=https://your-stackradar.example.com \
    StackRadarApiToken=your-api-token \
    Environment=production
```

Optional parameters:

```bash
  --parameter-overrides \
    StackRadarUrl=https://your-stackradar.example.com \
    StackRadarApiToken=your-api-token \
    Environment=production \
    FunctionPrefix=api-          # monitor only functions starting with "api-"
    MetricsCollectionInterval=5  # collect metrics every 5 minutes (default)
    NodeRuntime=nodejs20.x       # Lambda runtime version
```

### 3. Upload the actual function code

The CloudFormation template deploys placeholder code. Replace it:

```bash
# Get function names from the stack outputs
LOG_FORWARDER=$(aws cloudformation describe-stacks \
  --stack-name stackradar-lambda-collectors \
  --query 'Stacks[0].Outputs[?OutputKey==`LogForwarderFunctionName`].OutputValue' \
  --output text)

METRICS_COLLECTOR=$(aws cloudformation describe-stacks \
  --stack-name stackradar-lambda-collectors \
  --query 'Stacks[0].Outputs[?OutputKey==`MetricsCollectorFunctionArn`].OutputValue' \
  --output text | awk -F: '{print $NF}')

# Upload code
aws lambda update-function-code \
  --function-name "$LOG_FORWARDER" \
  --zip-file fileb://collector-lambda/log-forwarder.zip

aws lambda update-function-code \
  --function-name stackradar-lambda-collectors-metrics-collector \
  --zip-file fileb://collector-lambda/metrics-collector.zip
```

### 4. Create subscription filters

Subscribe each Lambda function's log group to the Log Forwarder. See [Creating Subscription Filters](#creating-subscription-filters) below.

---

## Manual Setup

Deploy each function individually without CloudFormation.

### Log Forwarder

```bash
# Build
cd collector-lambda/log-forwarder
npm install
zip -r ../log-forwarder.zip .
cd ../..

# Create IAM role
aws iam create-role \
  --role-name stackradar-log-forwarder-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name stackradar-log-forwarder-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Deploy function
aws lambda create-function \
  --function-name stackradar-log-forwarder \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/stackradar-log-forwarder-role \
  --zip-file fileb://collector-lambda/log-forwarder.zip \
  --memory-size 128 \
  --timeout 60 \
  --environment Variables="{
    STACKRADAR_URL=https://your-stackradar.example.com,
    STACKRADAR_API_TOKEN=your-api-token,
    STACKRADAR_ENVIRONMENT=production
  }"

# Allow CloudWatch Logs to invoke it
aws lambda add-permission \
  --function-name stackradar-log-forwarder \
  --statement-id allow-cloudwatch-logs \
  --action lambda:InvokeFunction \
  --principal logs.amazonaws.com \
  --source-arn arn:aws:logs:YOUR_REGION:YOUR_ACCOUNT_ID:log-group:*
```

### Metrics Collector

```bash
# Build
cd collector-lambda/metrics-collector
npm install
zip -r ../metrics-collector.zip .
cd ../..

# Create IAM role with CloudWatch + Lambda list permissions
aws iam create-role \
  --role-name stackradar-metrics-collector-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name stackradar-metrics-collector-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy \
  --role-name stackradar-metrics-collector-role \
  --policy-name MetricsCollectorPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["cloudwatch:GetMetricData"],
        "Resource": "*"
      },
      {
        "Effect": "Allow",
        "Action": ["lambda:ListFunctions"],
        "Resource": "*"
      }
    ]
  }'

# Deploy function
aws lambda create-function \
  --function-name stackradar-metrics-collector \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/stackradar-metrics-collector-role \
  --zip-file fileb://collector-lambda/metrics-collector.zip \
  --memory-size 256 \
  --timeout 120 \
  --environment Variables="{
    STACKRADAR_URL=https://your-stackradar.example.com,
    STACKRADAR_API_TOKEN=your-api-token,
    FUNCTION_PREFIX=,
    EXCLUDE_SELF=true
  }"

# Create EventBridge rule (every 5 minutes)
aws events put-rule \
  --name stackradar-metrics-schedule \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED

aws events put-targets \
  --rule stackradar-metrics-schedule \
  --targets '[{
    "Id": "MetricsCollectorTarget",
    "Arn": "arn:aws:lambda:YOUR_REGION:YOUR_ACCOUNT_ID:function:stackradar-metrics-collector"
  }]'

aws lambda add-permission \
  --function-name stackradar-metrics-collector \
  --statement-id allow-eventbridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:YOUR_REGION:YOUR_ACCOUNT_ID:rule/stackradar-metrics-schedule
```

---

## Creating Subscription Filters

Subscription filters tell CloudWatch to send a Lambda function's logs to the Log Forwarder in real time. You need one filter per function.

### Single function

```bash
aws logs put-subscription-filter \
  --log-group-name /aws/lambda/YOUR_FUNCTION_NAME \
  --filter-name stackradar \
  --filter-pattern "" \
  --destination-arn arn:aws:lambda:YOUR_REGION:YOUR_ACCOUNT_ID:function:stackradar-log-forwarder
```

Use `--filter-pattern ""` to forward all log events. You can narrow this with a CloudWatch filter pattern (e.g., `?ERROR ?WARN`) if you only want error logs.

### Subscribe all functions at once

The script below subscribes every Lambda function in the region:

```bash
#!/bin/bash
# subscribe-all.sh — Subscribe all Lambda functions to the StackRadar log forwarder

LOG_FORWARDER_ARN="arn:aws:lambda:YOUR_REGION:YOUR_ACCOUNT_ID:function:stackradar-log-forwarder"
REGION="us-east-1"   # change to your region

# Optional: filter by prefix (leave empty to subscribe all functions)
PREFIX=""

# List all functions
FUNCTIONS=$(aws lambda list-functions \
  --region "$REGION" \
  --query 'Functions[].FunctionName' \
  --output text)

for FUNCTION in $FUNCTIONS; do
  # Skip the collectors themselves
  if [[ "$FUNCTION" == *"stackradar"* ]]; then
    continue
  fi

  # Filter by prefix if set
  if [[ -n "$PREFIX" && "$FUNCTION" != "$PREFIX"* ]]; then
    continue
  fi

  LOG_GROUP="/aws/lambda/$FUNCTION"

  echo "Subscribing $LOG_GROUP ..."
  aws logs put-subscription-filter \
    --region "$REGION" \
    --log-group-name "$LOG_GROUP" \
    --filter-name stackradar \
    --filter-pattern "" \
    --destination-arn "$LOG_FORWARDER_ARN" 2>&1 || echo "  Warning: could not subscribe $LOG_GROUP"
done

echo "Done."
```

### Remove a subscription filter

```bash
aws logs delete-subscription-filter \
  --log-group-name /aws/lambda/YOUR_FUNCTION_NAME \
  --filter-name stackradar
```

---

## Configuration Reference

### Log Forwarder (`log-forwarder/`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STACKRADAR_URL` | Yes | — | Base URL of your StackRadar instance |
| `STACKRADAR_API_TOKEN` | Yes | — | Site API token from StackRadar |
| `STACKRADAR_ENVIRONMENT` | No | `production` | Environment tag applied to all forwarded logs |

### Metrics Collector (`metrics-collector/`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STACKRADAR_URL` | Yes | — | Base URL of your StackRadar instance |
| `STACKRADAR_API_TOKEN` | Yes | — | Site API token from StackRadar |
| `FUNCTION_PREFIX` | No | `""` | Only collect metrics for functions whose names start with this prefix. Empty = all functions. |
| `EXCLUDE_SELF` | No | `true` | Exclude the metrics collector function itself from the report |

---

## IAM Permissions

### Log Forwarder role

The Log Forwarder only needs to write its own execution logs. No additional AWS permissions are required because it only decompresses incoming payloads and makes outbound HTTPS calls to StackRadar.

| Permission | Reason |
|------------|--------|
| `logs:CreateLogGroup` | Write own execution logs |
| `logs:CreateLogStream` | Write own execution logs |
| `logs:PutLogEvents` | Write own execution logs |

These are all granted by the `AWSLambdaBasicExecutionRole` managed policy.

### Metrics Collector role

| Permission | Reason |
|------------|--------|
| `cloudwatch:GetMetricData` | Pull invocation, error, duration, and throttle metrics |
| `lambda:ListFunctions` | Discover all functions in the region to monitor |
| `logs:CreateLogGroup` + `logs:PutLogEvents` | Write own execution logs (via `AWSLambdaBasicExecutionRole`) |

---

## Monitoring the Monitors

Check that the collectors are running correctly.

### Log Forwarder

```bash
# View recent invocation logs
aws logs tail /aws/lambda/stackradar-lambda-collectors-log-forwarder --follow

# Check invocation metrics in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=stackradar-lambda-collectors-log-forwarder \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Metrics Collector

```bash
# View recent invocation logs
aws logs tail /aws/lambda/stackradar-lambda-collectors-metrics-collector --follow

# Manually trigger a collection run
aws lambda invoke \
  --function-name stackradar-lambda-collectors-metrics-collector \
  --payload '{}' \
  /tmp/response.json && cat /tmp/response.json
```

### Verify data is arriving in StackRadar

1. Open your StackRadar instance and navigate to the `aws_lambda` site
2. Logs should appear within seconds of a Lambda invocation (after subscription filters are set up)
3. Metrics update on the collection schedule (default: every 5 minutes)

---

## Troubleshooting

### Logs not appearing in StackRadar

**Check the subscription filter exists:**
```bash
aws logs describe-subscription-filters \
  --log-group-name /aws/lambda/YOUR_FUNCTION_NAME
```

**Check the Log Forwarder is being invoked:**
```bash
aws logs tail /aws/lambda/stackradar-lambda-collectors-log-forwarder --since 1h
```

**Verify the API token:**
The Log Forwarder logs will show HTTP errors if the token is invalid. Look for `4xx` responses.

**Check the log group exists:**
CloudWatch log groups are created on first invocation. If a function has never run, the log group may not exist yet — trigger the function once.

### Metrics not appearing in StackRadar

**Manually invoke the collector and inspect the response:**
```bash
aws lambda invoke \
  --function-name stackradar-lambda-collectors-metrics-collector \
  --log-type Tail \
  --payload '{}' \
  /tmp/out.json \
  --query 'LogResult' --output text | base64 -d
cat /tmp/out.json
```

**Check the EventBridge rule is enabled:**
```bash
aws events describe-rule --name stackradar-lambda-collectors-metrics-schedule
```

**Verify IAM permissions:**
```bash
# Check the role has cloudwatch:GetMetricData
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::YOUR_ACCOUNT_ID:role/stackradar-lambda-collectors-metrics-collector-role \
  --action-names cloudwatch:GetMetricData lambda:ListFunctions \
  --resource-arns '*'
```

### CloudFormation deployment fails

**Missing CAPABILITY_NAMED_IAM:**
The template creates named IAM roles. Always include `--capabilities CAPABILITY_NAMED_IAM` in the deploy command.

**Stack already exists:**
Use `aws cloudformation update-stack` instead of `deploy`, or delete the existing stack first:
```bash
aws cloudformation delete-stack --stack-name stackradar-lambda-collectors
aws cloudformation wait stack-delete-complete --stack-name stackradar-lambda-collectors
```

### Permission denied when creating subscription filters

CloudWatch Logs needs permission to invoke the Log Forwarder. Verify the `LogForwarderPermission` resource was created:

```bash
aws lambda get-policy --function-name stackradar-lambda-collectors-log-forwarder
```

The policy should include a statement allowing `logs.amazonaws.com` to call `lambda:InvokeFunction`.

---

## Directory Structure

```
collector-lambda/
├── log-forwarder/          # Log Forwarder Lambda source
│   ├── index.mjs           # Main handler
│   └── package.json
│
├── metrics-collector/      # Metrics Collector Lambda source
│   ├── index.mjs           # Main handler
│   └── package.json
│
├── cloudformation.yaml     # One-click CloudFormation deployment template
└── README.md               # This file
```
