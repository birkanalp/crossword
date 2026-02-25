# Backend-Core Memory

- Supabase local DB container mounts SQL migrations under `/docker-entrypoint-initdb.d/migrations/`.
- Existing `db:migrate` script references `/docker-entrypoint-initdb.d/run-migrations.sh`, but the container exposes `migrate.sh`; for targeted incremental updates, applying a specific migration file via `psql -f /docker-entrypoint-initdb.d/migrations/<file>.sql` is reliable.
- `levels.difficulty` remains compatibility-facing; Phase-0 canonical generation fields are `levels.target_difficulty` and `levels.computed_difficulty_score`.
- Migration numbering is sequential in `backend/supabase/migrations/`; Phase-0.5 TR import landed as `005_phase05_tr_frequency_setup.sql`.
- `words` import path now uses TR-safe normalization (`toLocaleLowerCase('tr-TR')` + Turkish-letter filtering), blacklist file `data/tr_blacklist.txt`, and rank-percentile difficulty buckets (20/50/25/5).
- Root scripts now include `build:tr:freq` and `import:tr:words` (run via `tsx`), while generation smoke should call `run_generation_job_once('tr')` for TR-only defaults.
- TR wiki corpus pipeline uses `scripts/tr/extract-trwiki-text.ts` to stream `.bz2` via `bzip2 -dc` directly (no full XML temp file); `build:tr:freq` already consumes `data/tr_corpus.txt` as first input candidate.
- Extraction process-close handling should register `once(bz2, "close")` immediately after spawn (before stream loop) to avoid missing the close event and losing final diagnostics when early-stopping on `--limitPages`.
- `checkWord` resume persistence (2026-02-25): validation flow now writes through DB RPC `record_checkword_progress` (migration `009_checkword_progress_history.sql`) so `user_progress` + `user_answer_history` update in one transaction with idempotency key (`request_id`).
