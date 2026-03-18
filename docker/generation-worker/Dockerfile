# Generation worker — seeds puzzles on boot, replenishes low stock every 30 min.
# Build from repo root: docker build -f docker/generation-worker/Dockerfile .
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# --include=dev required: @supabase/supabase-js is in devDependencies
RUN npm ci --include=dev

COPY scripts scripts/

CMD ["npx", "tsx", "scripts/generation-worker.ts"]
