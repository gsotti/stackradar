# LogRadar Docker Collectors

Automatically collect logs and metrics from Docker containers and send them to LogRadar.

## Overview

This directory contains two independent collectors:

| Collector | Purpose | Location |
|-----------|---------|----------|
| **Log Collector** | Real-time log streaming | `./logs/` |
| **Stats Collector** | Periodic metrics collection | `./stats/` |

Each collector has its own Dockerfile and can be deployed independently.

## Quick Start

### Using Docker Compose (Recommended)

Deploy both collectors:

```bash
# Copy and configure
cp docker-compose.example.yml docker-compose.yml
# Edit docker-compose.yml with your API token and settings

# Start both collectors
docker-compose up -d

# View logs
docker-compose logs -f
```

### Build Individual Collectors

**Log Collector:**
```bash
cd logs
docker build -t logradar-log-collector .
docker run -d \
  --name logradar-logs \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e LOGRADAR_API_URL="http://your-logradar" \
  -e API_TOKEN="your-token" \
  logradar-log-collector
```

**Stats Collector:**
```bash
cd stats
docker build -t logradar-stats-collector .
docker run -d \
  --name logradar-stats \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e LOGRADAR_API_URL="http://your-logradar" \
  -e API_TOKEN="your-token" \
  logradar-stats-collector
```

## Log Collector Features

- 📦 **Automatic Discovery**: Monitors all running Docker containers
- 🔄 **Real-time Streaming**: Streams logs as they're generated
- 🏷️ **Smart Labeling**: Uses container name as source, image name as system
- 📊 **Level Detection**: Auto-detects ERROR, WARN, INFO, DEBUG from messages
- ⚡ **Batching**: Efficient batching to reduce API calls
- 🎯 **Filtering**: Regex pattern to monitor specific containers only

### Log Collector Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOGRADAR_API_URL` | LogRadar API endpoint (required) | - |
| `API_TOKEN` | Site API token (required) | - |
| `TENANT` | Tenant name | `default` |
| `SITE` | Site name | `docker-host` |
| `ENVIRONMENT` | Environment name | `dev` |
| `CONTAINER_FILTER` | Regex to filter containers | `` |
| `LOG_LEVEL_MAPPING` | Parse log levels | `true` |
| `BATCH_SIZE` | Logs per batch | `10` |
| `BATCH_INTERVAL_MS` | Max batch wait time | `5000` |

## Stats Collector Features

- 📊 **Container Metrics**: CPU, memory, network per container
- 🖥️ **Host Metrics**: System-wide resource monitoring
- 📈 **Aggregation**: Average CPU/memory across all containers
- ⏱️ **Periodic Collection**: Configurable interval (default: 60s)
- 📉 **Historical Tracking**: Stores metrics for trending
- 🎯 **Filtering**: Monitor specific containers only

### Stats Collector Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOGRADAR_API_URL` | LogRadar API endpoint (required) | - |
| `API_TOKEN` | Site API token (required) | - |
| `COLLECTION_INTERVAL_MS` | Collection interval | `60000` |
| `CONTAINER_FILTER` | Regex to filter containers | `` |

### Metrics Collected

- **Containers**: Total, running, stopped, paused counts
- **CPU**: Average usage percentage
- **Memory**: Aggregate usage percentage
- **Network**: Total RX/TX bytes
- **Host**: CPU count, memory usage

## Directory Structure

```
collector-docker/
├── logs/
│   ├── Dockerfile
│   ├── package.json
│   ├── log-collector.mjs
│   └── .dockerignore
├── stats/
│   ├── Dockerfile
│   ├── package.json
│   ├── stats-collector.mjs
│   └── .dockerignore
├── docker-compose.example.yml
└── README.md
```

## Deployment Scenarios

### Scenario 1: Logs Only
```yaml
services:
  logradar-log-collector:
    build: ./logs
    # ... configuration
```

### Scenario 2: Stats Only
```yaml
services:
  logradar-stats-collector:
    build: ./stats
    # ... configuration
```

### Scenario 3: Both (Recommended)
```yaml
services:
  logradar-log-collector:
    build: ./logs
    # ... logs config

  logradar-stats-collector:
    build: ./stats
    # ... stats config
```

## Container Filtering

Filter which containers to monitor using regex:

```yaml
environment:
  # Monitor only production containers
  CONTAINER_FILTER: "^prod-"

  # Monitor app and api containers
  CONTAINER_FILTER: "(app|api)"

  # Exclude system containers
  CONTAINER_FILTER: "^(?!.*system).*"
```

## Resource Limits

Recommended limits:

```yaml
# Log Collector
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 256M

# Stats Collector
deploy:
  resources:
    limits:
      cpus: '0.25'
      memory: 128M
```

## Monitoring

**Check collector status:**
```bash
# Logs
docker logs logradar-log-collector

# Stats
docker logs logradar-stats-collector
```

**Expected output (Logs):**
```
🚀 Docker Log Collector started
📦 Starting log collection from container: app-1
📦 Starting log collection from container: nginx
✅ Sent 10 logs to LogRadar
```

**Expected output (Stats):**
```
🚀 Docker Stats Collector started
📊 Docker Stats:
   Containers: 5/7 running
   CPU Usage: 12.45%
   Memory Usage: 34.67%
✅ Metrics sent successfully
```

## Troubleshooting

### Logs not appearing

1. Check API token:
   ```bash
   docker logs logradar-log-collector | grep "Failed"
   ```

2. Verify container discovery:
   ```bash
   docker logs logradar-log-collector | grep "Starting log collection"
   ```

### Stats not updating

1. Check collection interval:
   ```bash
   docker logs logradar-stats-collector | grep "Stats:"
   ```

2. Verify API connectivity:
   ```bash
   docker exec logradar-stats-collector wget -O- http://logradar/api/health
   ```

## Security

- ✅ Non-root user in containers
- ✅ Read-only Docker socket access
- ✅ No privileged mode required
- ✅ Minimal Alpine-based images

## Multiple Docker Hosts

Deploy one set of collectors per host:

```yaml
# Host 1
environment:
  SITE: "docker-host-1"

# Host 2
environment:
  SITE: "docker-host-2"
```

## License

Same as LogRadar main application
