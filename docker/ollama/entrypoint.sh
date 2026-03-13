#!/bin/sh
# Start Ollama server in background, pull model on first run, then keep server alive.
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"

ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready, then pull model (no-op if already present)
sleep 5
for i in 1 2 3 4 5 6 7 8 9 10; do
  if ollama pull "$MODEL"; then
    echo "[ollama] Model $MODEL ready"
    break
  fi
  echo "[ollama] Waiting for server... retry $i/10"
  sleep 3
done

wait $OLLAMA_PID
