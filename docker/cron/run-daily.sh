#!/bin/sh
# Günlük bulmaca: hard veya expert (rastgele), --daily ile
N=$(head -c1 /dev/urandom | od -A n -t d | tr -d ' ')
[ $((N % 2)) -eq 0 ] && D=hard || D=expert
cd /app && npx tsx scripts/tr/generate-crossword.ts --difficulty "$D" --daily --count 1 --json
