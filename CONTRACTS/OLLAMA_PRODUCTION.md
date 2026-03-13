# Ollama Production Configuration — Bulmaca AI Review

## Overview

The AI review pipeline (edge functions `cronTriggerAiReview` and `admin`)
calls an Ollama instance at runtime to score crossword clues. In local
development this is the `ollama` Docker service at `http://ollama:11434`. In
production (Supabase Cloud) the edge functions run in Deno isolates and cannot
reach Docker — you must host Ollama externally.

## Environment Variables (read at runtime by edge functions)

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama server base URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model to use for clue scoring |

If `OLLAMA_BASE_URL` is not set in Supabase Secrets the edge functions will
fall back to the Docker URL, which is unreachable in production — **always set
this explicitly in production**.

## Step-by-Step: Production Deployment

### 1. Host Ollama on a VPS

Minimum recommended: 8 GB RAM for `qwen2.5:7b` (better quality than 3b).

```bash
# On your VPS (Ubuntu/Debian example):
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull qwen2.5:7b

# Expose on all interfaces (required for external access)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### 2. Secure with HTTPS (Nginx + Certbot)

Edge functions must reach Ollama via HTTPS (Supabase Cloud outbound).

```nginx
server {
    listen 443 ssl;
    server_name ollama.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/ollama.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ollama.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:11434;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### 3. Set Supabase Edge Function Secrets

In Supabase Dashboard → Project → Edge Functions → Secrets, add:

```
OLLAMA_BASE_URL = https://ollama.your-domain.com
OLLAMA_MODEL    = qwen2.5:7b
```

Or via Supabase CLI:

```bash
supabase secrets set OLLAMA_BASE_URL=https://ollama.your-domain.com
supabase secrets set OLLAMA_MODEL=qwen2.5:7b
```

### 4. Verify the Connection

```bash
# From your local machine, after setting secrets:
curl https://your-supabase-project.supabase.co/functions/v1/cronTriggerAiReview \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"level_id": "some-valid-uuid"}'
```

## Fallback Behavior

If Ollama is unreachable (e.g. VPS is down), the edge function:

1. Catches the error and reverts the level status back to `pending`.
2. Returns HTTP 503 — the cron job will retry on the next run.
3. The level is never permanently rejected due to an Ollama outage.

## Local Development (Docker)

The `docker-compose.yml` includes an `ollama` service. No extra configuration
is needed — `OLLAMA_BASE_URL` defaults to `http://ollama:11434`.

Pull the model once after first `docker compose up`:

```bash
docker compose exec ollama ollama pull qwen2.5:3b
```
