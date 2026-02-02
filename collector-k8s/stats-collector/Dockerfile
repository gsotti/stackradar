FROM node:20-alpine

WORKDIR /app

COPY stats-collector.mjs .

RUN chmod +x stats-collector.mjs

CMD ["node", "stats-collector.mjs"]
