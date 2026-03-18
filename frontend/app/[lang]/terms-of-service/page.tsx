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
  return { title: dict.terms.title }
}

const sections = {
  tr: [
    {
      heading: '1. Kabul',
      body: 'Bulmaca uygulamasını veya web sitesini kullanarak bu kullanım şartlarını kabul etmiş olursunuz. Kabul etmiyorsanız uygulamayı kullanmayı bırakınız.',
    },
    {
      heading: '2. Hizmet Açıklaması',
      body: 'Bulmaca, Türkçe çapraz bulmaca bulmacaları sunan bir mobil oyundur. Temel özellikler ücretsizdir; bazı premium içerikler uygulama içi satın alma gerektirebilir.',
    },
    {
      heading: '3. Hesap',
      body: 'Hesap bilgilerinizin gizliliğini korumak sizin sorumluluğunuzdadır. Hesabınızda gerçekleşen tüm etkinliklerden sorumlusunuz. Hesabınızın yetkisiz kullanımını derhal bize bildirmeniz gerekmektedir.',
    },
    {
      heading: '4. Uygulama İçi Satın Almalar',
      body: [
        'Tüm satın almalar ilgili uygulama mağazası (App Store / Google Play) aracılığıyla gerçekleşir.',
        'Dijital ürünler için cayma hakkı mağaza politikalarına tabidir.',
        'Satın almalarınızı aynı hesapla giriş yaparak ve "Satın Alımları Geri Yükle" seçeneğini kullanarak geri yükleyebilirsiniz.',
      ],
    },
    {
      heading: '5. Yasaklı Davranışlar',
      body: [
        'Uygulamayı tersine mühendislik yapmak veya kaynak kodunu çıkarmak',
        'Skor veya oyun ilerlemesini manipüle etmek',
        'Diğer kullanıcıları taciz etmek veya kötüye kullanmak',
        'Uygulamayı ticari amaçlarla izinsiz kullanmak',
      ],
    },
    {
      heading: '6. Sorumluluk Sınırlaması',
      body: 'Bulmaca, hizmetin kesintisiz veya hatasız olacağını garanti etmez. Hizmet "olduğu gibi" sağlanır. Yasaların izin verdiği azami ölçüde hiçbir zarardan sorumlu değiliz.',
    },
    {
      heading: '7. Değişiklikler',
      body: 'Bu şartları önceden bildirim yaparak değiştirebiliriz. Değişikliklerden sonra uygulamayı kullanmaya devam etmeniz yeni şartları kabul ettiğiniz anlamına gelir.',
    },
    {
      heading: '8. Uygulanacak Hukuk',
      body: 'Bu şartlar Türkiye Cumhuriyeti hukuku çerçevesinde yorumlanır ve uygulanır.',
    },
    {
      heading: '9. İletişim',
      body: 'Sorularınız için: support@bulmacaoyunu.com',
    },
  ],
  en: [
    {
      heading: '1. Acceptance',
      body: 'By using the Bulmaca app or website, you accept these terms of service. If you do not agree, please stop using the app.',
    },
    {
      heading: '2. Service Description',
      body: 'Bulmaca is a mobile game offering Turkish crossword puzzles. Core features are free; some premium content may require in-app purchases.',
    },
    {
      heading: '3. Account',
      body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use.',
    },
    {
      heading: '4. In-App Purchases',
      body: [
        'All purchases are processed through the relevant app store (App Store / Google Play).',
        'Refund rights for digital goods are subject to the respective store\'s policies.',
        'You can restore purchases by signing in with the same account and using the "Restore Purchases" option.',
      ],
    },
    {
      heading: '5. Prohibited Conduct',
      body: [
        'Reverse engineering or extracting the source code of the app',
        'Manipulating scores or game progress',
        'Harassing or abusing other users',
        'Using the app for unauthorized commercial purposes',
      ],
    },
    {
      heading: '6. Limitation of Liability',
      body: 'Bulmaca does not guarantee uninterrupted or error-free service. The service is provided "as is." To the maximum extent permitted by law, we are not liable for any damages.',
    },
    {
      heading: '7. Changes',
      body: 'We may update these terms with prior notice. Continued use of the app after changes constitutes acceptance of the new terms.',
    },
    {
      heading: '8. Governing Law',
      body: 'These terms are governed by and construed in accordance with the laws of the Republic of Turkey.',
    },
    {
      heading: '9. Contact',
      body: 'For questions: support@bulmacaoyunu.com',
    },
  ],
}

export default function TermsPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const lang = params.lang as Lang
  const dict = getDictionary(lang)

  return (
    <LegalPage
      title={dict.terms.title}
      lastUpdated={dict.terms.lastUpdated}
      sections={sections[lang]}
    />
  )
}
