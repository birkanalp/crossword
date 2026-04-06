# Bulmaca Store Release Readiness Audit

Audit tarihi: 2026-04-06 18:36:25 +03

Bu rapor repo incelemesi, Docker stack doğrulaması, veritabanı sorguları ve release kalite kontrollerine dayanır. Amaç, projeyi App Store ve Google Play'e ciddi şekilde yayınlayabilmek için eksik kalan noktaları öncelik sırasıyla çıkarmaktır.

## Kısa sonuç

Proje bugün itibarıyla store submission için hazır değil.

## Repo içinde çözülenler

- Mobil typecheck kırığı giderildi.
- Auth/session iskeleti Supabase session kaynağına bağlandı.
- Guest ve authenticated session ayrımı tek kaynağa indirildi.
- Release config artık `app.config.ts` ve runtime validator üzerinden okunuyor.
- Preview/production için kritik config yoksa uygulama açık hata ekranı veriyor.
- Login ekranı artık boş TODO butonları yerine config-driven OAuth entrypoint kullanıyor.

## Repo dışında kalanlar

- App Store Connect ve Google Play submit credential’ları
- Gerçek production AdMob / RevenueCat anahtarları
- Final icon / splash / screenshot / feature graphic asset seti
- Approved puzzle stoğu ve admin review operasyonu

Bloklayıcı ana nedenler:

1. Mobil auth ve gerçek session akışı tamamlanmamış.
2. Production env / submit / store credential zinciri eksik.
3. Monetization ve analytics yapılandırmaları boş veya yarım.
4. Release asset pack placeholder durumda.
5. İçerik stoğu henüz yayına uygun görünmüyor: veritabanında `approved` level yok.
6. Release quality gate kırık: mobil TypeScript typecheck fail ediyor.

## İnceleme özeti

### Docker / runtime

- Proje Docker stack'i izole portlarla başarıyla ayağa kalktı.
- Sağlıklı ayağa kalkan servisler: `db`, `auth`, `rest`, `realtime`, `storage`, `meta`, `studio`, `kong`, `inbucket`, `ollama`, `cron`, `generation-worker`.
- Varsayılan portlar yerelde çakışıyor:
  - `54321` ve `54322` makinede başka bir Supabase stack tarafından kullanılıyordu.
  - Çalıştırmak için şu override kullanıldı:

```bash
POSTGRES_PORT=55432 KONG_HTTP_PORT=55421 STUDIO_PORT=55423 docker compose up -d --wait db auth rest realtime storage imgproxy meta studio kong inbucket ollama cron generation-worker
```

### Veritabanı

- `admin_todos` tablosu mevcut ve seed edilmiş.
- Durum özeti:
  - `backlog`: 49
  - `blocked`: 5
  - `ideas`: 11
- `levels` tablosunda toplam 3000 kayıt var, ama tamamı `review_status='generating'`.
- `approved` puzzle sayısı: `0`
- `generation_jobs` tablosunda kayıt görünmüyor.
- Worker logları placeholder üretimin çalıştığını, fakat yayınlanabilir/pas edilmiş içerik stoğunun oluşmadığını gösteriyor.

### Quality gate

- `scripts/quality-gate.sh` çalıştırıldı.
- Sonuç:
  - Mobile TypeScript typecheck: fail
  - Mobile ESLint: pass
  - Web typecheck + build: pass
  - Admin typecheck + build: pass
- Mevcut kırık:
  - `mobile/src/api/adapters/levelAdapter.ts:161` civarında `hint: string | undefined` → `Clue` tipi ile uyumsuz.

## Bloklayıcı eksikler

### 1. Gerçek auth / session / identity akışı yok

Kanıt:

- [`mobile/app/(auth)/login.tsx:8`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/(auth)/login.tsx#L8) dosyası doğrudan "Skeleton only" diyor.
- [`mobile/app/(auth)/login.tsx:29`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/(auth)/login.tsx#L29) ve [`mobile/app/(auth)/login.tsx:39`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/(auth)/login.tsx#L39) Apple/Google butonlarını TODO bırakıyor.
- [`mobile/src/store/userStore.ts:25`](/Users/birkanalp/Desktop/Bulmaca/mobile/src/store/userStore.ts#L25) gerçek auth yerine geçici local store akışı kullanıyor.
- [`backend/supabase/config.toml:37`](/Users/birkanalp/Desktop/Bulmaca/backend/supabase/config.toml#L37) ve [`backend/supabase/config.toml:40`](/Users/birkanalp/Desktop/Bulmaca/backend/supabase/config.toml#L40) Apple ve Google provider'larını kapalı bırakıyor.

Yayın öncesi yapılması gereken:

- Supabase Auth client'ını mobilde kur.
- Apple Sign-In ve Google Sign-In'i native redirect/deep link ile tamamla.
- JWT session restore, refresh ve secure saklama akışını tamamla.
- Guest → authenticated merge akışını gerçek giriş sonrası zorunlu hale getir.
- Logout akışını auth provider ile tutarlı yap.

### 2. Production API ve secret yönetimi hazır değil

Kanıt:

- [`mobile/app.json:76`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L76) `supabaseUrl` olarak `http://localhost:54321` kullanıyor.
- [`mobile/app.json:77`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L77) ile [`mobile/app.json:86`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L86) arası Sentry, RevenueCat, AdMob ve PostHog anahtarları boş.
- [`mobile/src/api/client.ts:9`](/Users/birkanalp/Desktop/Bulmaca/mobile/src/api/client.ts#L9) runtime'da `expoConfig.extra.supabaseUrl` okuyor; store build'te bu değer prod değilse uygulama yanlış backend'e gider veya hiç bağlanamaz.
- [`mobile/eas.json:21`](/Users/birkanalp/Desktop/Bulmaca/mobile/eas.json#L21) production profile'da sadece `APP_ENV=production` set ediyor.

Yayın öncesi yapılması gereken:

- EAS secrets / env üzerinden production `SUPABASE_URL`, DSN'ler, RC key'leri, AdMob unit ID'leri tanımla.
- `localhost` fallback'lerini release build'ten çıkar.
- Ortam ayrımını `development` / `preview` / `production` için kesinleştir.
- Secret rotation ve sahiplik prosedürü yazılı hale getir.

### 3. Store submit zinciri eksik

Kanıt:

- [`mobile/eas.json:31`](/Users/birkanalp/Desktop/Bulmaca/mobile/eas.json#L31), [`mobile/eas.json:32`](/Users/birkanalp/Desktop/Bulmaca/mobile/eas.json#L32), [`mobile/eas.json:33`](/Users/birkanalp/Desktop/Bulmaca/mobile/eas.json#L33) placeholder.
- [`mobile/eas.json:36`](/Users/birkanalp/Desktop/Bulmaca/mobile/eas.json#L36) `./google-play-key.json` bekliyor.
- Repo içinde `mobile/google-play-key.json` yok.

Yayın öncesi yapılması gereken:

- App Store Connect `ascAppId`, team, API key/submit kimliklerini üret.
- Google Play service account JSON'unu oluştur ve CI/EAS ile güvenli bağla.
- Internal track / TestFlight akışını en az bir kez uçtan uca test et.

### 4. Release asset’leri placeholder

Kanıt:

- [`mobile/app.json:8`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L8), [`mobile/app.json:11`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L11), [`mobile/app.json:28`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L28), [`mobile/app.json:35`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L35) gerçek asset dosyalarına referans veriyor.
- Dosya doğrulaması sonucu:
  - `mobile/assets/icon.png` → `1 x 1`
  - `mobile/assets/adaptive-icon.png` → `1 x 1`
  - `mobile/assets/splash.png` → `1 x 1`
  - `mobile/assets/favicon.png` → `1 x 1`

Yayın öncesi yapılması gereken:

- 1024x1024 app icon
- Android adaptive icon katmanları
- Splash screen final asset'i
- App Store / Play Store screenshot setleri
- Android feature graphic
- Marka/logotype seti

### 5. Yayınlanabilir puzzle içeriği hazır değil

Kanıt:

- Veritabanı sorgusunda `levels` tablosunda bütün kayıtlar `review_status='generating'`.
- `approved_count = 0`.
- Worker logları placeholder üretimi gösteriyor; yayın stoğu değil.

Yayın öncesi yapılması gereken:

- En azından launch için yeterli sayıda `approved` puzzle stoğu oluştur.
- Manual/admin review sürecini çalıştır.
- Daily challenge ve progression için sıralı, görüntülenebilir içerik stoğunu garanti et.
- İçerik kalite kapısı tanımla: tekrar eden clue, çözülebilirlik, profanity, premium gating, difficulty dengelemesi.

### 6. Mobil build kalite kapısı kırık

Kanıt:

- `scripts/quality-gate.sh` sonucu release fail.
- Hata kaynağı: [`mobile/src/api/adapters/levelAdapter.ts:161`](/Users/birkanalp/Desktop/Bulmaca/mobile/src/api/adapters/levelAdapter.ts#L161)

Yayın öncesi yapılması gereken:

- Mobil typecheck'i yeşile çek.
- Release öncesi zorunlu CI gate haline getir.
- EAS build öncesi `mobile typecheck + lint + smoke run` zorunlu olsun.

## Yüksek öncelikli eksikler

### 7. Monetization akışı yarım ve backend authoritative değil

Kanıt:

- [`mobile/app/store.tsx:70`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/store.tsx#L70) satın alma akışını başlatıyor.
- [`mobile/app/store.tsx:93`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/store.tsx#L93) coin'i local store'a ekliyor.
- Aynı dosyada yorum olarak authoritative kredi işleminin webhook'a bırakıldığı belirtilmiş.
- [`mobile/app.json:78`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L78) ve [`mobile/app.json:79`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L79) RevenueCat key'leri boş.
- `admin_todos` seed backlog'unda da RevenueCat webhook ve entitlement sync açıkça eksik.

Yayın öncesi yapılması gereken:

- RevenueCat products/offering/entitlement tanımlarını oluştur.
- Backend webhook doğrulaması ve entitlement sync'i tamamla.
- Coin crediting'in authoritative backend kaydıyla tutarlı olduğundan emin ol.
- Restore purchases sonrası profil/entitlement UI yenilenmeli.

### 8. AdMob prod yapılandırması tamamlanmamış

Kanıt:

- [`mobile/app.json:80`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L80) ile [`mobile/app.json:85`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L85) arası unit ID alanları boş.
- iOS `Info.plist` içinde görülen `GADApplicationIdentifier` test ID.
- `admin_todos` içinde AdMob App ID ve rewarded unit ID kartları `blocked`.

Yayın öncesi yapılması gereken:

- Production App ID ve ad unit ID'lerini bağla.
- Çocuklara yönelik değilse uygun ads/privacy işaretlemelerini doldur.
- Frequency capping ve no-ads entitlement davranışını doğrula.

### 9. Analytics ve observability eksik

Kanıt:

- [`mobile/app.json:77`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L77) `sentryDsn` boş.
- [`mobile/app.json:86`](/Users/birkanalp/Desktop/Bulmaca/mobile/app.json#L86) `posthogApiKey` boş.
- Kodda analytics wrapper var ama prod anahtarları yok.

Yayın öncesi yapılması gereken:

- Sentry release/env/source map akışını aktif et.
- PostHog event sözleşmesiyle prod API key'ini bağla.
- Crash-free sessions, purchase funnel, tutorial funnel, retention, ad impressions ölçümleri aktif olsun.

### 10. Native strateji tutarsız

Bulgu:

- Repo'da `mobile/ios` var.
- Repo'da `mobile/android` yok.
- `CONTRACTS/NATIVE_CONFIG.md` tracked native klasörlerden bahsediyor, ama mevcut repo durumu yalnızca iOS için bunu sağlıyor.

Yayın öncesi yapılması gereken:

- Net karar ver:
  - Ya tam CNG/EAS prebuild modeli kullanılacak,
  - ya da hem `ios/` hem `android/` native klasörleri repo'da tutulacak.
- Karara göre `prebuild`, CI ve release prosedürünü tek modele indir.

## Orta öncelikli eksikler

### 11. Profil tarafı kısmen hazır ama gerçek backend kullanıcı yaşam döngüsü eksik

Pozitif taraf:

- [`mobile/app/profile.tsx:60`](/Users/birkanalp/Desktop/Bulmaca/mobile/app/profile.tsx#L60) hesap silme akışını içeriyor.
- [`admin/app/delete-account/page.tsx:1`](/Users/birkanalp/Desktop/Bulmaca/admin/app/delete-account/page.tsx#L1) web account deletion sayfası var.
- Backend'de `deleteAccount` ve `getProfile` edge function dosyaları mevcut.

Eksik taraf:

- Bu akışların değer üretmesi gerçek auth/session bağlanmasına bağlı.
- Avatar upload, tam profil düzenleme, entitlements/profil senkronizasyonu net değil.

### 12. Policy/support yüzeyi mevcut, ama store metadata paketi görünmüyor

Pozitif taraf:

- `frontend/app/[lang]/privacy-policy/page.tsx`
- `frontend/app/[lang]/terms-of-service/page.tsx`
- `frontend/app/[lang]/cookie-policy/page.tsx`
- `frontend/app/[lang]/support/page.tsx`

Eksik taraf:

- App Store subtitle, promotional text, keywords, short/full description, release notes, age rating cevap seti repo içinde görünmüyor.
- Reviewer test account ve review notes paketi görünmüyor.

### 13. Release operasyonu için port/yerel ortam çakışmaları var

Bulgu:

- Varsayılan `54321` / `54322` portları bu makinede başka Supabase stack ile çakıştı.
- Lokal geliştirici deneyimi için bu kabul edilebilir, ama onboarding ve CI smoke test için daha net izolasyon gerekir.

Yayın öncesi yapılması gereken:

- `.env` override örneklerini dökümante et.
- CI'da deterministic compose port seti kullan.

## Hazır olan veya güçlü görünen alanlar

Bunlar eksik değil, ama launch için temel oluşturuyor:

- Docker tabanlı yerel backend stack kapsamlı.
- `admin_todos` backlog'unun veritabanına taşınmış olması operasyonel olarak iyi.
- Web frontend ve admin panel production build alıyor.
- Account deletion için hem uygulama içi hem web yüzeyi düşünülmüş.
- `getProfile`, `deleteAccount`, `submitScore`, `getLeaderboard`, `getDailyChallenge` gibi backend parçaları repo'da mevcut.
- Quality gate script'i var; sadece tamamen yeşil değil.

## Yayın öncesi önerilen sıra

1. Mobil auth + provider + session restore zincirini tamamla.
2. Production env ve EAS secret setini kur.
3. RevenueCat + AdMob prod credential ve entitlement akışını tamamla.
4. Release asset pack ve store metadata paketini hazırla.
5. Mobil typecheck kırığını düzelt ve CI gate'i yeşil yap.
6. İçerik pipeline'ında `approved` puzzle stoğunu oluştur.
7. Internal testing:
   - TestFlight
   - Play Internal Testing
   - purchase/restore
   - delete account
   - leaderboard submission
   - guest→login merge
8. Son olarak privacy/data safety/app access formlarını doldur.

## Son karar

Mevcut durum "beta/internal testing" seviyesine yakın, fakat "store-ready production release" seviyesinde değil.

Özellikle aşağıdakiler çözülmeden submission önermem:

- gerçek auth
- prod env/secrets
- submit credentials
- release assets
- approved content inventory
- green mobile quality gate
