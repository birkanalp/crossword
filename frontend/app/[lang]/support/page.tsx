import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, isValidLang, type Lang } from '@/lib/dictionary'

interface Props {
  params: { lang: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidLang(params.lang)) return {}
  const dict = getDictionary(params.lang as Lang)
  return { title: dict.support.title }
}

export default function SupportPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const dict = getDictionary(params.lang as Lang)
  const s = dict.support
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@bulmacaoyunu.com'

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">{s.title}</h1>
        <p className="text-gray-500 mt-2">{s.subtitle}</p>
      </div>

      <div className="bg-indigo-50 rounded-2xl p-6 mb-10 flex items-center gap-4">
        <span className="text-2xl">✉️</span>
        <div>
          <p className="text-sm text-gray-600 mb-1">{s.emailLabel}</p>
          <a
            href={`mailto:${supportEmail}`}
            className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {supportEmail}
          </a>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">{s.faq.title}</h2>
        <div className="space-y-4">
          {s.faq.items.map((item) => (
            <div
              key={item.q}
              className="border border-gray-200 rounded-xl p-5"
            >
              <h3 className="font-medium text-gray-900 mb-2">{item.q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
