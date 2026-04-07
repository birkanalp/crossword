-- =============================================================================
-- Migration: 022_admin_todos
-- Description: Persist admin kanban todos in Postgres instead of browser localStorage
-- Date: 2026-03-13
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) > 0),
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('backlog', 'ideas', 'in_progress', 'done', 'blocked')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_todos_status_sort_order
  ON admin_todos (status, sort_order, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_todos_updated_at
  ON admin_todos (updated_at DESC);

DROP TRIGGER IF EXISTS trg_admin_todos_updated_at ON admin_todos;
CREATE TRIGGER trg_admin_todos_updated_at
  BEFORE UPDATE ON admin_todos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE admin_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_todos: admins read" ON admin_todos;
CREATE POLICY "admin_todos: admins read"
  ON admin_todos FOR SELECT
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS "admin_todos: admins insert" ON admin_todos;
CREATE POLICY "admin_todos: admins insert"
  ON admin_todos FOR INSERT
  TO authenticated
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS "admin_todos: admins update" ON admin_todos;
CREATE POLICY "admin_todos: admins update"
  ON admin_todos FOR UPDATE
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS "admin_todos: admins delete" ON admin_todos;
CREATE POLICY "admin_todos: admins delete"
  ON admin_todos FOR DELETE
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

DO $$
BEGIN
  IF current_setting('app.seed_admin_todos', true) IS DISTINCT FROM 'true' THEN
    RAISE NOTICE '[022] Skipped admin_todos backlog seed. Set app.seed_admin_todos=true before migration to opt in.';
    RETURN;
  END IF;
END $$;

WITH seed(title, body, status, sort_order) AS (
  VALUES
    ('RevenueCat API anahtarlarını yapılandır', 'app.json: revenueCatApiKeyIos, revenueCatApiKeyAndroid', 'backlog', 10),
    ('RevenueCat Dashboard''da product IDs ve offerings tanımla', '', 'backlog', 20),
    ('Paywall ekranı ve premium level kilidi UI''ı', '', 'backlog', 30),
    ('Restore purchases butonu (ayarlar/profil)', '', 'backlog', 40),
    ('AdMob SDK kurulumu (react-native-google-mobile-ads)', '', 'backlog', 50),
    ('AdMob unit ID''leri (banner, interstitial, rewarded) app.json''a ekle', '', 'backlog', 60),
    ('Banner reklamları yerleştir', '', 'backlog', 70),
    ('Interstitial ve rewarded reklamları entegre et', '', 'backlog', 80),
    ('hasNoAds() entegrasyonu (reklamsız paket)', '', 'backlog', 90),
    ('EAS projesi oluştur, eas.json build profilleri', '', 'backlog', 100),
    ('App Store Connect hesabı aç', '', 'backlog', 110),
    ('Google Play Console hesabı aç', '', 'backlog', 120),
    ('Store listing metadata (açıklama, anahtar kelimeler)', '', 'backlog', 130),
    ('Privacy policy URL', '', 'backlog', 140),
    ('Destek URL''i', '', 'backlog', 150),
    ('Store ekran görüntüleri', '', 'backlog', 160),
    ('Android feature graphic', '', 'backlog', 170),
    ('App ikonu kalite kontrolü (1024x1024)', '', 'backlog', 180),
    ('Splash screen asset''leri doğrula', '', 'backlog', 190),
    ('Uygulama logosu tasarımı (store için)', '', 'backlog', 200),
    ('getProfile endpoint (CR-006) — backend + frontend', '', 'backlog', 210),
    ('Apple Sign-In implementasyonu', '', 'backlog', 220),
    ('Google Sign-In implementasyonu', '', 'backlog', 230),
    ('Analytics (PostHog) entegrasyonu', '', 'backlog', 240),
    ('Leaderboard ekranını bağla (useDailyLeaderboard, useLevelLeaderboard)', '', 'backlog', 250),
    ('Profil: avatar yükleme, ayarlar paneli (ses, haptik, tema)', '', 'backlog', 260),
    ('getDailyChallenge path güncellemesi (CR-003)', '', 'backlog', 270),
    ('RevenueCat webhook (verifyPurchase)', '', 'backlog', 280),
    ('Production secret management stratejisi dokümante et', '', 'backlog', 290),
    ('Edge Function rate limiting middleware', '', 'backlog', 300),
    ('Storage bucket RLS (storage kullanılıyorsa)', '', 'backlog', 310),
    ('Production CORS kısıtlaması', '', 'backlog', 320),
    ('Admin şifresi production için güçlü değer', '', 'backlog', 330),
    ('Frontend XSS kontrolü (dangerouslySetInnerHTML kullanımı)', '', 'backlog', 340),
    ('Cron ayarları production ortamında test', '', 'backlog', 350),
    ('AI review (Ollama) production URL yapılandırması', '', 'backlog', 360),
    ('RevenueCat entitlement backend senkronizasyonu', '', 'backlog', 370),
    ('Günlük meydan okuma ödülleri (coin, streak bonusu)', '', 'ideas', 10),
    ('Ses efektleri (harf yazma, kelime tamamlama, hata)', '', 'ideas', 20),
    ('Haptic feedback', '', 'ideas', 30),
    ('Tema seçenekleri (açık/koyu)', '', 'ideas', 40),
    ('Streak görselleştirmesi (ateş ikonu, animasyon)', '', 'ideas', 50),
    ('Zorluk seçiminde önizleme (örnek grid)', '', 'ideas', 60),
    ('Başarı rozetleri / achievement sistemi', '', 'ideas', 70),
    ('Arkadaşlarla paylaşım (skor, bulmaca linki)', '', 'ideas', 80),
    ('Offline modda daha fazla bulmaca önbellekleme', '', 'ideas', 90),
    ('Zamanlayıcı modu (süreye karşı)', '', 'ideas', 100),
    ('Günlük kelime ipucu / kelime öğrenme özelliği', '', 'ideas', 110),
    ('[BEKLEYEN BİLGİ] AdMob iOS App ID', 'Google AdMob hesabı açıldıktan sonra iOS uygulamasını kaydet ve App ID''yi al.
Format: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
Bu değer frontend/app.json → plugins → react-native-google-mobile-ads → iosAppId alanına girilecek.', 'blocked', 10),
    ('[BEKLEYEN BİLGİ] AdMob Android App ID', 'Google AdMob hesabı açıldıktan sonra Android uygulamasını kaydet ve App ID''yi al.
Format: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
Bu değer frontend/app.json → plugins → react-native-google-mobile-ads → androidAppId alanına girilecek.', 'blocked', 20),
    ('[BEKLEYEN BİLGİ] AdMob Rewarded Ad Unit ID – iOS', 'Google AdMob > iOS Uygulaması > Ad Units > Rewarded bölümünden oluştur.
Format: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
Bu değer frontend/app.json → extra → admobRewardedIos alanına girilecek.
Dev ortamı için test ID zaten ayarlı, üretim build''i için gerekli.', 'blocked', 30),
    ('[BEKLEYEN BİLGİ] AdMob Rewarded Ad Unit ID – Android', 'Google AdMob > Android Uygulaması > Ad Units > Rewarded bölümünden oluştur.
Format: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
Bu değer frontend/app.json → extra → admobRewardedAndroid alanına girilecek.
Dev ortamı için test ID zaten ayarlı, üretim build''i için gerekli.', 'blocked', 40),
    ('[STORE RELEASE] Mobil auth/session altyapisini gercek backend ile bagla', 'Bulgu: frontend/app/(auth)/login.tsx hala skeleton; frontend/src/store/userStore.ts icindeki loginUser sadece local state degistiriyor ve mobilde gercek auth session yonetimi yok. Yapilacak: Supabase auth client, Apple/Google callback akisi, session restore, secure token saklama, guest->user merge ve logout.', 'backlog', 380),
    ('[STORE RELEASE] Supabase prod auth provider ve redirect URL ayarlarini ac', 'Bulgu: backend/supabase/config.toml icinde auth.external.apple = false, auth.external.google = false ve site_url / additional_redirect_urls localhost. Production icin Apple ve Google provider secretlari, deep link redirectleri ve bundle/package callback URL''leri tanimlanmali.', 'backlog', 390),
    ('[STORE RELEASE] Profil, ayarlar ve logout ekranini tamamla', 'Bulgu: frontend/app/profile.tsx icinde sign-out, restore purchases ve settings bolumu yok; frontend/src/api/hooks/useProfile.ts getProfile endpoint''ine bagli ama backend karsiligi eksik. Yapilacak: profil fetch/update, avatar, ayarlar, logout ve hata/retry durumlari.', 'backlog', 400),
    ('[STORE COMPLIANCE] Hesap silme akislarini ekle (uygulama ici + web)', 'Apple 5.1.1(v) ve Google Play account deletion requirement nedeniyle uygulama ici hesap olusturma/sosyal login sunuluyorsa kullanici uygulama icinden hesap silme baslatabilmeli; ayrica Play Console icin disardan erisilen bir delete-account URL hazirlanmali.', 'backlog', 410),
    ('[STORE RELEASE] submitScore ve leaderboard yazma akislarini gercek auth ile bagla', 'Bulgu: frontend/app/game/level/[id].tsx icinde authToken sabit undefined; useSubmitScore entegrasyonu yok. Sonuc: giris yapan kullanici olsa bile skorlar authoritative backend''e yazilmiyor. Yapilacak: JWT ile submitScore, rank refresh, retry ve offline fallback.', 'backlog', 420),
    ('[STORE RELEASE] Magaza ekranindaki sahte satin alma akislarini kaldir', 'Bulgu: frontend/app/store.tsx icinde confirmPurchase sadece bekleyip basari alert''i gosteriyor. Store review oncesi RevenueCat checkout, restore purchases, entitlement sync, coin crediting ve hata durumlari tamamlanmali.', 'backlog', 430),
    ('[STORE RELEASE] Production API/env ayrimini ve EAS secret setini tamamla', 'Bulgu: frontend/app.json -> extra.supabaseUrl localhost; frontend/eas.json production profili sadece APP_ENV set ediyor. Store build''lerinde SUPABASE_URL, SENTRY_DSN, RevenueCat key''leri, prod ad unit ID''leri ve release env''leri EAS secret/env uzerinden verilmeli; localhost fallback''e guvenilmemeli.', 'backlog', 440),
    ('[STORE RELEASE] EAS submit kimlik bilgilerini placeholderlardan cikar', 'Bulgu: frontend/eas.json icinde appleId / ascAppId / appleTeamId placeholder, android serviceAccountKeyPath dosyasi ise repo''da yok. App Store Connect API key veya ascAppId ile Google Play service account hazirlanmadan auto-submit / CI submit akisi calismaz.', 'blocked', 50),
    ('[STORE RELEASE] Expo/iOS native config senkronizasyon stratejisini sabitle', 'Bulgu: expo-doctor, native project klasorleri varken app config alanlarinin otomatik sync edilmeyecegini raporluyor. iOS native proje tutulacaksa prebuild/sync proseduru netlestirilmeli; degilse CNG''ye gecilip app config source of truth yapilmali.', 'backlog', 450),
    ('[STORE RELEASE] Placeholder app assetlerini gercek release assetleriyle degistir', 'Bulgu: frontend/assets/icon.png, adaptive-icon.png, splash.png ve favicon.png 1x1 placeholder. Release asset pack, Android adaptive icon, splash, App Store / Play listing gorselleri ve branding dosyalari gercek final assetlerle degistirilmeli.', 'backlog', 460),
    ('[STORE COMPLIANCE] App Store Privacy + Play Data Safety + Ads + App Access beyanlarini doldur', 'Apple privacy label, Google Play Data Safety, Contains Ads ve App Access formlari SDK inventory ile doldurulmali. AdMob, Sentry, RevenueCat, auth/profile verileri, reviewer test hesabi ve review notlari hazirlanmali.', 'backlog', 470),
    ('[ENGINEERING] Release quality gate kur: frontend/admin lint + build + typecheck', 'Bulgu: frontend lint ve admin lint config yok; admin next build de hata veriyor. Store oncesi CI''da en az frontend typecheck, admin build, lint ve release smoke checklist zorunlu hale getirilmeli.', 'backlog', 480),
    ('[ENGINEERING] Admin production build errorini duzelt', 'Bulgu: admin/app/api/cron-settings/route.ts satir 42 civarinda "pool is possibly null" nedeniyle next build fail ediyor. Admin panel production build verebilmeden release operasyonu guvenli olmaz.', 'backlog', 490)
)
INSERT INTO admin_todos (title, body, status, sort_order)
SELECT seed.title, seed.body, seed.status, seed.sort_order
FROM seed
WHERE current_setting('app.seed_admin_todos', true) = 'true'
  AND NOT EXISTS (SELECT 1 FROM admin_todos);
