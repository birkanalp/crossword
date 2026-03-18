import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { isValidLang, getDictionary, type Lang } from '@/lib/dictionary'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

interface LayoutProps {
  children: React.ReactNode
  params: { lang: string }
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  if (!isValidLang(params.lang)) return {}
  const dict = getDictionary(params.lang as Lang)
  return {
    title: {
      template: '%s | Bulmaca',
      default: 'Bulmaca',
    },
    description: dict.landing.sub,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bulmacaoyunu.com'),
    alternates: {
      languages: {
        tr: '/tr',
        en: '/en',
      },
    },
  }
}

export function generateStaticParams() {
  return [{ lang: 'tr' }, { lang: 'en' }]
}

export default function LangLayout({ children, params }: LayoutProps) {
  if (!isValidLang(params.lang)) notFound()

  const lang = params.lang as Lang
  const dict = getDictionary(lang)

  return (
    <html lang={lang}>
      <body className="min-h-screen flex flex-col">
        <Header lang={lang} dict={dict} />
        <main className="flex-1">{children}</main>
        <Footer lang={lang} dict={dict} />
      </body>
    </html>
  )
}
