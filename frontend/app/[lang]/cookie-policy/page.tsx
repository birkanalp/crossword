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
  return { title: dict.cookies.title }
}

const sections = {
  tr: [
    {
      heading: '1. Çerez Nedir?',
      body: 'Çerezler, tarayıcınız tarafından cihazınıza kaydedilen küçük metin dosyalarıdır. Web sitemizin düzgün çalışması ve size daha iyi bir deneyim sunmak için kullanılır.',
    },
    {
      heading: '2. Kullandığımız Çerezler',
      body: [
        'Zorunlu çerezler: Sitenin temel işlevselliği için gereklidir (oturum yönetimi). Bu çerezler devre dışı bırakılamaz.',
        'Analitik çerezler: Anonim ziyaretçi istatistikleri için kullanılır (opsiyonel).',
        'Tercih çerezleri: Dil tercihinizi hatırlamak için kullanılır.',
      ],
    },
    {
      heading: '3. Üçüncü Taraf Çerezleri',
      body: 'Web sitemiz şu an üçüncü taraf izleme veya reklam çerezi kullanmamaktadır. Mobil uygulama için Google AdMob reklam tanımlayıcıları kullanır; ayrıntılar için Gizlilik Politikamızı inceleyin.',
    },
    {
      heading: '4. Çerezleri Kontrol Etme',
      body: 'Tarayıcı ayarlarınızdan çerezleri yönetebilir veya reddedebilirsiniz. Zorunlu çerezleri devre dışı bırakırsanız site bazı özellikler düzgün çalışmayabilir.',
    },
    {
      heading: '5. İletişim',
      body: 'Çerez politikamız hakkında sorularınız için: support@bulmacaoyunu.com',
    },
  ],
  en: [
    {
      heading: '1. What Are Cookies?',
      body: 'Cookies are small text files stored on your device by your browser. They are used to ensure our website works correctly and to provide you with a better experience.',
    },
    {
      heading: '2. Cookies We Use',
      body: [
        'Essential cookies: Required for the site\'s core functionality (session management). These cannot be disabled.',
        'Analytics cookies: Used for anonymous visitor statistics (optional).',
        'Preference cookies: Used to remember your language preference.',
      ],
    },
    {
      heading: '3. Third-Party Cookies',
      body: 'Our website currently does not use any third-party tracking or advertising cookies. The mobile app uses Google AdMob advertising identifiers; see our Privacy Policy for details.',
    },
    {
      heading: '4. Managing Cookies',
      body: 'You can manage or reject cookies through your browser settings. Disabling essential cookies may cause some parts of the site to not function properly.',
    },
    {
      heading: '5. Contact',
      body: 'For questions about our cookie policy: support@bulmacaoyunu.com',
    },
  ],
}

export default function CookiePolicyPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const lang = params.lang as Lang
  const dict = getDictionary(lang)

  return (
    <LegalPage
      title={dict.cookies.title}
      lastUpdated={dict.cookies.lastUpdated}
      sections={sections[lang]}
    />
  )
}
