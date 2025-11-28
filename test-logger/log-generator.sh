#!/bin/bash

API_TOKEN="${API_TOKEN:-62b81c04d47245efb82fae99282998158b72e4a8683b46d494e57a38e45d180e}"
API_URL="${API_URL:-http://logpilot:8000}"
SYSTEM_NAME="${SYSTEM_NAME:-Test}"

# Array of random log messages
MESSAGES=(
  "User logged in successfully"
  "Database connection established"
  "Cache hit for key: user_session_12345"
  "API request processed in 45ms"
  "Email sent to user@example.com"
  "File uploaded: document.pdf (2.3MB)"
  "Payment processed: \$99.99"
  "Order #12345 shipped"
  "Background job started: data_export"
  "Cron job executed successfully"
  "Error connecting to payment gateway"
  "Warning: High memory usage detected (85%)"
  "Configuration updated by admin"
  "New user registered: john.doe@example.com"
  "Session expired for user ID 789"
  "Search query: 'how to use logpilot'"
  "404 Not Found: /api/invalid-endpoint"
  "Rate limit exceeded for IP 192.168.1.100"
  "Backup completed successfully"
  "SSL certificate renewed"
  "Server started on port 8080"
  "Database migration applied: 003_add_indexes"
  "Cache cleared for namespace: products"
  "WebSocket connection established"
  "Image resized: 1920x1080 -> 800x600"
  "Password reset requested for admin@example.com"
  "2FA code sent via SMS"
  "Login attempt from new location: Tokyo, Japan"
  "Suspicious activity detected"
  "Webhook received from Stripe"
)

# Array of log levels
LEVELS=("INFO" "INFO" "INFO" "INFO" "DEBUG" "DEBUG" "WARNING" "ERROR")

# Array of sources
SOURCES=("web-server" "api" "worker" "cron" "auth-service" "payment-service" "database" "cache")

echo "Starting log generator for system: $SYSTEM_NAME"
echo "API URL: $API_URL"
echo "Sending logs every 2-5 seconds..."

while true; do
  # Random message
  MESSAGE="${MESSAGES[$RANDOM % ${#MESSAGES[@]}]}"

  # Random level
  LEVEL="${LEVELS[$RANDOM % ${#LEVELS[@]}]}"

  # Random source
  SOURCE="${SOURCES[$RANDOM % ${#SOURCES[@]}]}"

  # Create log payload
  PAYLOAD=$(cat <<EOF
{
  "level": "$LEVEL",
  "message": "$MESSAGE",
  "source": "$SOURCE",
  "metadata": {
    "hostname": "test-container-$(hostname)",
    "pid": $$,
    "random_id": "$RANDOM"
  }
}
EOF
)

  # Send log
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/api/ingest/$API_TOKEN/single" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Sent: [$LEVEL] $SOURCE: $MESSAGE"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ Failed (HTTP $HTTP_CODE): [$LEVEL] $SOURCE: $MESSAGE"
  fi

  # Random sleep between 2-5 seconds
  SLEEP_TIME=$((2 + RANDOM % 4))
  sleep $SLEEP_TIME
done
