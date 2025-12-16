FROM node:20-alpine

WORKDIR /app

COPY log-collector.mjs .

RUN chmod +x log-collector.mjs

CMD ["node", "log-collector.mjs"]
