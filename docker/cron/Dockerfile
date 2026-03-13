# Cron service – runs scripts/tr/generate-crossword.ts (same as admin "Yeni Bulmaca")
# Build from repo root: docker build -f docker/cron/Dockerfile .
FROM node:20-alpine
RUN apk add --no-cache cronie
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY scripts scripts/
COPY docker/cron/run-daily.sh /app/docker/cron/run-daily.sh
RUN chmod +x /app/docker/cron/run-daily.sh

# Crontab: every 5 min + daily at 00:00
COPY docker/cron/crontab /etc/crontabs/root
RUN chmod 0644 /etc/crontabs/root

CMD ["crond", "-f"]
