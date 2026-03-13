# Cron Job Kurulumu (Docker)

Puzzle üretimi **Docker cron servisi** ile çalışır. Admin paneldeki "Yeni Bulmaca" düğmesiyle **aynı kod** çalıştırılır: `scripts/tr/generate-crossword.ts`.

**AI inceleme:** Admin panelden üretilen bulmacalar Ollama ile otomatik incelenir. Bkz. [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

---

## Nasıl Çalışır

| Tetikleyici | Çalışan kod |
|-------------|-------------|
| **Admin "Yeni Bulmaca"** | `npx tsx scripts/tr/generate-crossword.ts --difficulty=<seçilen> --count=1 --json` |
| **Cron (her 5 dk)** | `npx tsx scripts/tr/generate-crossword.ts --count 1 --json` (rastgele zorluk) |
| **Cron (günlük 00:00)** | `run-daily.sh` → hard veya expert (rastgele), `--daily` ile |

Her ikisi de aynı script'i kullanır: tam crossword algoritması, gerçek ipuçları, veritabanına kayıt.

**Cron aç/kapa:** Admin panel → Bulmacalar sayfası → "Cron: Aktif" / "Cron: Pasif" butonu ile toggle.

---

## Kurulum

1. **Cron servisi** `docker-compose.yml` içinde tanımlı.

2. **Stack'i başlat:**
   ```bash
   docker compose up -d --build
   ```
   İlk seferde `cron` imajı build edilir.

3. **Cron logları:**
   ```bash
   docker compose exec cron cat /var/log/cron-generate.log   # 5 dk cron
   docker compose exec cron cat /var/log/cron-daily.log     # günlük cron
   ```

4. **Manuel test (cron beklenmeden):**
   ```bash
   # 5 dk cron
   docker compose exec cron sh -c 'cd /app && npx tsx scripts/tr/generate-crossword.ts --count 1 --json'
   # Günlük cron (hard veya expert)
   docker compose exec cron /app/docker/cron/run-daily.sh
   ```

---

## Yapılandırma

- **5 dk cron:** `*/5 * * * *` | Rastgele zorluk, 1 bulmaca
- **Günlük cron:** `0 0 * * *` (her gün 00:00) | hard veya expert (rastgele), `--daily` ile `daily_challenges` tablosuna
- **DB bağlantısı:** `DATABASE_URL` docker-compose env ile verilir

### Crontab değiştirmek

`docker/cron/crontab` dosyasını düzenleyip imajı yeniden build edin:

```bash
docker compose build cron && docker compose up -d cron
```

---

## pg_cron (Opsiyonel)

`pg_cron` extension migration 014 ile etkinleştirilir. Puzzle üretimi için kullanılmaz; ileride DB seviyesinde başka cron job'lar eklemek isterseniz kullanılabilir.
