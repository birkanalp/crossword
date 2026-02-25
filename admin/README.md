# Bulmaca Admin Panel

Admin panel for puzzle moderation and metrics dashboard.

## Kurulum

1. **Ortam değişkenleri:** `admin/.env.local` dosyası oluşturuldu. Supabase anahtarlarınız farklıysa güncelleyin.

2. **Admin kullanıcı:** Veritabanında admin kullanıcı oluşturuldu:
   - **E-posta:** `admin@bulmaca.local`
   - **Şifre:** `Admin123!`

   Auth servisi çalışıyorsa bu bilgilerle giriş yapabilirsiniz. Auth sorunluysa:
   - `npm run docker:reset` ile stack'i sıfırlayıp yeniden başlatın
   - Ardından Supabase Studio (http://localhost:54323) → Authentication → Users üzerinden yeni kullanıcı ekleyin
   - Kullanıcıya `app_metadata: {"role": "admin"}` eklemek için SQL Editor'da:
     ```sql
     UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb WHERE email = 'sizin@email.com';
     ```

3. **Anon key:** Docker'daki gerçek anon key'i kullanın. Farklıysa:
   ```bash
   docker compose exec kong env | grep ANON_KEY
   ```
   Çıkan değeri `admin/.env.local` içindeki `NEXT_PUBLIC_SUPABASE_ANON_KEY` olarak ayarlayın.

## Çalıştırma

```bash
# Backend (Supabase) çalışıyor olmalı
npm run docker:up

# Admin paneli
npm run admin:dev
```

Tarayıcıda: **http://localhost:3001**

## Sayfalar

- **/** — Giriş
- **/dashboard** — Metrikler (günlük oynanma, kullanıcı sayıları, aktif kullanıcı)
- **/puzzles** — Bulmaca listesi (onay bekleyen / onaylı / reddedilen)
- **/puzzles/[id]** — Bulmaca onay ekranı (grid, sorular, düzenleme, onayla/reddet)
