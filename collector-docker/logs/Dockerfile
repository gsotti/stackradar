FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy collector script
COPY log-collector.mjs ./

# Note: Running as root is required to access Docker socket
# The container needs privileged access to monitor Docker containers
CMD ["node", "log-collector.mjs"]
