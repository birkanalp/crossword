# Beklemede (Blocked) Tasklar – Adım Adım Rehber

Bu doküman, admin panelindeki **Beklemede** (blocked) sütununda yer alan 4 AdMob task'ı için adım adım talimatlar içerir. Her biri için hangi web sayfasına gidileceği, neyin nereden alınacağı ve projede nereye yazılacağı detaylı anlatılmaktadır.

---

## Genel Ön Bilgiler

- **Kaynak:** Todo'lar admin panelinde (`http://localhost:3001/todos`) Kanban board üzerinden görüntülenir; localStorage'da tutulur.
- **AdMob Konsolu:** https://admob.google.com
- **Hesap gereksinimi:** Google hesabı; AdMob hesabı (yoksa oluşturulacak)
- **Proje dosya yolu:** Bulmaca repo kökü (`/Users/birkanalp/Desktop/Bulmaca`)

---

## Task 1: AdMob iOS App ID

**Ne lazım:** iOS uygulaması için AdMob App ID (format: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)

### Adımlar

1. **AdMob'a giriş**
   - Tarayıcıda https://admob.google.com adresine git
   - Google hesabınla giriş yap
   - AdMob hesabın yoksa, kayıt ekranını tamamla (özellikle ödeme/vergi bilgileri)

2. **Uygulama ekleme (henüz yoksa)**
   - Sol menüden **Uygulamalar** (Apps) bölümüne tıkla
   - **Uygulama ekle** düğmesine tıkla
   - **Platform** olarak **iOS** seç
   - **App Store'da mı?** sorusunda:
     - Henüz yayınlamadıysan: **Hayır** de
     - İsim: `Bulmaca` (veya istediğin isim)
   - **Uygulama oluştur** ile kaydet

3. **iOS App ID'yi kopyalama**
   - Uygulama listesinde iOS uygulamanı bul
   - Üzerine tıkla veya **App ayarları**na gir
   - **Uygulama kimliği** (App ID) alanındaki değeri kopyala  
     - Örnek format: `ca-app-pub-3940256099942544~1458002511` (test) veya `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX` (gerçek)

4. **Projeye yazma**
   - Dosya: `frontend/app.json`
   - Bölüm: `expo.plugins` → `react-native-google-mobile-ads` bloğu
   - Alan: `iosAppId`
   
   ```json
   [
     "react-native-google-mobile-ads",
     {
       "androidAppId": "ca-app-pub-3940256099942544~3347511713",  // Android ayrı task
       "iosAppId": "BURAYA_İOS_APP_ID_YAPIŞTIR"
     }
   ]
   ```

   **Not:** Şu anda test ID kullanılıyor. Gerçek ID'yi aldıktan sonra bu değeri değiştir.

---

## Task 2: AdMob Android App ID

**Ne lazım:** Android uygulaması için AdMob App ID (format: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)

### Adımlar

1. **AdMob'a giriş**
   - https://admob.google.com adresine git
   - Giriş yap

2. **Android uygulaması ekleme (henüz yoksa)**
   - Sol menüden **Uygulamalar** (Apps) tıkla
   - **Uygulama ekle** düğmesine tıkla
   - **Platform** olarak **Android** seç
   - **Google Play'de mi?** sorusunda:
     - Henüz yayınlamadıysan: **Hayır** de
     - İsim: `Bulmaca` (veya istediğin isim)
   - **Uygulama oluştur** ile kaydet

3. **Android App ID'yi kopyalama**
   - Uygulama listesinde Android uygulamanı bul
   - Tıkla veya **App ayarları**na gir
   - **Uygulama kimliği** (App ID) alanındaki değeri kopyala  
     - Örnek format: `ca-app-pub-3940256099942544~3347511713` (test) veya `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX` (gerçek)

4. **Projeye yazma**
   - Dosya: `frontend/app.json`
   - Bölüm: `expo.plugins` → `react-native-google-mobile-ads` bloğu
   - Alan: `androidAppId`
   
   ```json
   [
     "react-native-google-mobile-ads",
     {
       "androidAppId": "BURAYA_ANDROID_APP_ID_YAPIŞTIR",
       "iosAppId": "ca-app-pub-..."  // iOS Task 1'den gelecek
     }
   ]
   ```

---

## Task 3: AdMob Rewarded Ad Unit ID – iOS

**Ne lazım:** iOS için Rewarded (ödüllü) reklam birimi ID (format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`)

### Adımlar

1. **AdMob'da iOS uygulamanı aç**
   - https://admob.google.com → **Uygulamalar** → iOS uygulama adına tıkla

2. **Yeni reklam birimi oluştur**
   - **Reklam birimleri** (Ad units) sekmesine geç
   - **Reklam birimi ekle** (Add ad unit) düğmesine tıkla

3. **Reklam formatı seç**
   - **Ödüllü** (Rewarded) formatını seç
   - **Devam** ile ilerle

4. **Ad unit ismi ve ayarları**
   - Örn. isim: `Bulmaca iOS Rewarded`
   - (İsteğe bağlı) Ödül: "ipucu" veya benzeri
   - **Reklam birimini oluştur** ile kaydet

5. **Ad Unit ID'yi kopyalama**
   - Oluşan reklam biriminde **Ad unit ID** alanındaki değeri kopyala  
     - Format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX` (App ID'den farklı; `/` ile ayrılır)

6. **Projeye yazma**
   - Dosya: `frontend/app.json`
   - Bölüm: `expo.extra`
   - Alan: `admobRewardedIos`
   
   ```json
   "extra": {
     ...
     "admobRewardedIos": "BURAYA_İOS_REWARDED_AD_UNIT_ID_YAPIŞTIR",
     "admobRewardedAndroid": "",
     ...
   }
   ```

   **Alternatif:** `frontend/.env` veya `frontend/.env.local` içinde:
   ```env
   ADMOB_REWARDED_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   ```
   (`app.config.js` bu env değişkenini okur; production için env kullanımı tercih edilebilir.)

---

## Task 4: AdMob Rewarded Ad Unit ID – Android

**Ne lazım:** Android için Rewarded (ödüllü) reklam birimi ID (format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`)

### Adımlar

1. **AdMob'da Android uygulamanı aç**
   - https://admob.google.com → **Uygulamalar** → Android uygulama adına tıkla

2. **Yeni reklam birimi oluştur**
   - **Reklam birimleri** (Ad units) sekmesine geç
   - **Reklam birimi ekle** (Add ad unit) düğmesine tıkla

3. **Reklam formatı seç**
   - **Ödüllü** (Rewarded) formatını seç
   - **Devam** ile ilerle

4. **Ad unit ismi ve ayarları**
   - Örn. isim: `Bulmaca Android Rewarded`
   - (İsteğe bağlı) Ödül: "ipucu" vb.
   - **Reklam birimini oluştur** ile kaydet

5. **Ad Unit ID'yi kopyalama**
   - **Ad unit ID** alanındaki değeri kopyala  
     - Format: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`

6. **Projeye yazma**
   - Dosya: `frontend/app.json`
   - Bölüm: `expo.extra`
   - Alan: `admobRewardedAndroid`
   
   ```json
   "extra": {
     ...
     "admobRewardedIos": "...",
     "admobRewardedAndroid": "BURAYA_ANDROID_REWARDED_AD_UNIT_ID_YAPIŞTIR",
     ...
   }
   ```

   **Alternatif:** `frontend/.env` veya `frontend/.env.local`:
   ```env
   ADMOB_REWARDED_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   ```

---

## Özet Tablo

| Task | Kaynak (URL) | Nereden alınır | Projede nereye yazılır |
|------|--------------|----------------|------------------------|
| iOS App ID | admob.google.com → Apps → iOS app | App ayarları → Uygulama kimliği | `frontend/app.json` → `plugins[].iosAppId` |
| Android App ID | admob.google.com → Apps → Android app | App ayarları → Uygulama kimliği | `frontend/app.json` → `plugins[].androidAppId` |
| iOS Rewarded | admob.google.com → Apps → iOS → Ad units | Yeni Rewarded unit → Ad unit ID | `frontend/app.json` → `extra.admobRewardedIos` veya `ADMOB_REWARDED_IOS` |
| Android Rewarded | admob.google.com → Apps → Android → Ad units | Yeni Rewarded unit → Ad unit ID | `frontend/app.json` → `extra.admobRewardedAndroid` veya `ADMOB_REWARDED_ANDROID` |

---

## Sıra Önerisi

1. Önce **iOS App ID** ve **Android App ID** (Task 1 ve 2) — uygulamaları AdMob'a kaydet
2. Sonra **Rewarded Ad Unit ID'ler** (Task 3 ve 4) — her platform için rewarded unit oluştur

---

## Güncel Dosya Konumları

- **app.json:** `frontend/app.json`
- **plugins bloğu:** satır ~56–63
- **extra bloğu:** satır ~68–84
- **app.config.js:** `frontend/app.config.js` — env'den okuma mantığı burada

---

## Notlar

- Test ID'leri zaten `app.json` plugin bloğunda tanımlı; geliştirme ortamında test reklamları gösterilir
- Production build için gerçek App ID ve Ad Unit ID kullanılmalı
- Hassas ID'leri `.env` ile tutup `app.config.js` üzerinden okumak daha güvenli; `.env` dosyası `.gitignore`'da olmalı
- Todo'yu tamamladıktan sonra admin panelinde ilgili task'ı "Tamamlandı" (done) veya "Yapılıyor" (in_progress) olarak sürükleyebilirsin
