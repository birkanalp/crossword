import type { Metadata } from 'next'
import { getDictionary, isValidLang, type Lang } from '@/lib/dictionary'
import { notFound } from 'next/navigation'

interface Props {
  params: { lang: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidLang(params.lang)) return {}
  const dict = getDictionary(params.lang as Lang)
  return { title: dict.landing.badge }
}

export default function LandingPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const dict = getDictionary(params.lang as Lang)
  const l = dict.landing

  return (
    <>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-24 text-center">
        <span className="inline-block bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          {l.badge}
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight whitespace-pre-line mb-6">
          {l.headline}
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-10">{l.sub}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* App Store */}
          <button
            disabled
            className="flex items-center justify-center gap-3 bg-black text-white px-6 py-3 rounded-xl font-medium opacity-60 cursor-not-allowed"
            title={l.comingSoon}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span>{l.downloadIos}</span>
          </button>

          {/* Google Play */}
          <button
            disabled
            className="flex items-center justify-center gap-3 bg-gray-900 text-white px-6 py-3 rounded-xl font-medium opacity-60 cursor-not-allowed"
            title={l.comingSoon}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
              <path d="M3.18 23.76a2 2 0 0 1-.9-1.67V1.91A2 2 0 0 1 3.18.24l12.38 11.76-12.38 11.76zM20.14 13.5l-2.97 1.72-3.28-3.12 3.28-3.1 2.98 1.73a2 2 0 0 1 0 2.77zM4.06 23.25L15.3 12.5 4.06.75A1.99 1.99 0 0 0 3 .24v23.52c.4-.1.77-.28 1.06-.51z" />
            </svg>
            <span>{l.downloadAndroid}</span>
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-400">{l.comingSoon}</p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">
            {l.features.title}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {l.features.items.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
