import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, isValidLang, type Lang } from '@/lib/dictionary'
import { LegalPage } from '@/components/LegalPage'

interface Props {
  params: { lang: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidLang(params.lang)) return {}
  const dict = getDictionary(params.lang as Lang)
  return { title: dict.privacy.title }
}

const sections = {
  tr: [
    {
      heading: '1. Topladığımız Veriler',
      body: [
        'Hesap bilgileri: e-posta adresi, kullanıcı adı (opsiyonel)',
        'Oyun verileri: tamamlanan bulmacalar, skorlar, süre, hata sayısı',
        'Satın alma bilgileri: RevenueCat aracılığıyla abonelik/satın alma durumu',
        'Reklam tanımlayıcıları: Google AdMob tarafından sağlanan reklam kimlikleri (yalnızca reklam izniniz varsa)',
        'Cihaz bilgileri: işletim sistemi, uygulama sürümü, bölge',
        'Hata raporları: Sentry aracılığıyla uygulama çökmelerine ilişkin anonim hata verileri',
      ],
    },
    {
      heading: '2. Verilerin Kullanım Amacı',
      body: [
        'Oyun deneyiminizi kişiselleştirmek ve ilerlemenizi kaydetmek',
        'Skor tablosunu oluşturmak ve yarışma özelliklerini sunmak',
        'Satın aldığınız içeriklere erişiminizi doğrulamak',
        'Reklam göstermek (onayınız dahilinde)',
        'Uygulama hatalarını tespit edip gidermek',
      ],
    },
    {
      heading: '3. Üçüncü Taraf Servisler',
      body: [
        'Supabase (supabase.com): kimlik doğrulama ve veritabanı — AB sunucularında barındırılabilir',
        'RevenueCat (revenuecat.com): uygulama içi satın alma yönetimi',
        'Google AdMob (admob.google.com): reklamcılık — kendi gizlilik politikasına tabidir',
        'Sentry (sentry.io): hata takibi ve performans izleme',
      ],
    },
    {
      heading: '4. Veri Saklama Süresi',
      body: 'Hesabınızı silene kadar verilerinizi saklarız. Hesap silme işlemini uygulamadan veya destek@bulmacaoyunu.com adresine e-posta göndererek talep edebilirsiniz. Anonim oyun istatistikleri silinmeyebilir.',
    },
    {
      heading: '5. KVKK / GDPR Hakları',
      body: [
        'Verilerinize erişim talep etme',
        'Verilerinizin düzeltilmesini isteme',
        'Verilerinizin silinmesini talep etme',
        'İşlemeye itiraz etme',
        'Veri taşınabilirliği talep etme',
      ],
    },
    {
      heading: '6. Çocukların Gizliliği',
      body: '13 yaşın altındaki çocuklardan bilerek kişisel veri toplamıyoruz. Bir çocuğun bize veri sağladığını düşünüyorsanız lütfen bizimle iletişime geçin.',
    },
    {
      heading: '7. İletişim',
      body: 'Gizlilik politikamıza ilişkin sorularınız için: support@bulmacaoyunu.com',
    },
  ],
  en: [
    {
      heading: '1. Data We Collect',
      body: [
        'Account information: email address, username (optional)',
        'Game data: completed puzzles, scores, time, mistake count',
        'Purchase information: subscription/purchase status via RevenueCat',
        'Advertising identifiers: ad IDs provided by Google AdMob (only with your permission)',
        'Device information: operating system, app version, region',
        'Error reports: anonymous crash data via Sentry',
      ],
    },
    {
      heading: '2. How We Use Your Data',
      body: [
        'To personalize your game experience and save your progress',
        'To build the leaderboard and provide competitive features',
        'To verify access to purchased content',
        'To show advertisements (with your consent)',
        'To detect and fix application errors',
      ],
    },
    {
      heading: '3. Third-Party Services',
      body: [
        'Supabase (supabase.com): authentication and database — may be hosted in EU servers',
        'RevenueCat (revenuecat.com): in-app purchase management',
        'Google AdMob (admob.google.com): advertising — subject to its own privacy policy',
        'Sentry (sentry.io): error tracking and performance monitoring',
      ],
    },
    {
      heading: '4. Data Retention',
      body: 'We retain your data until you delete your account. You can request account deletion in-app or by emailing support@bulmacaoyunu.com. Anonymous game statistics may not be deleted.',
    },
    {
      heading: '5. Your GDPR Rights',
      body: [
        'Right to access your data',
        'Right to correct your data',
        'Right to erasure ("right to be forgotten")',
        'Right to object to processing',
        'Right to data portability',
      ],
    },
    {
      heading: '6. Children\'s Privacy',
      body: 'We do not knowingly collect personal data from children under 13. If you believe a child has provided us with data, please contact us.',
    },
    {
      heading: '7. Contact',
      body: 'For questions about this privacy policy: support@bulmacaoyunu.com',
    },
  ],
}

export default function PrivacyPolicyPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const lang = params.lang as Lang
  const dict = getDictionary(lang)

  return (
    <LegalPage
      title={dict.privacy.title}
      lastUpdated={dict.privacy.lastUpdated}
      sections={sections[lang]}
    />
  )
}
