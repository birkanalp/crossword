import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, isValidLang, type Lang } from '@/lib/dictionary'
import { LeaderboardTable } from '@/components/LeaderboardTable'

interface Props {
  params: { lang: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidLang(params.lang)) return {}
  const dict = getDictionary(params.lang as Lang)
  return { title: dict.leaderboard.title }
}

export default function LeaderboardPage({ params }: Props) {
  if (!isValidLang(params.lang)) notFound()

  const dict = getDictionary(params.lang as Lang)
  const l = dict.leaderboard

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{l.title}</h1>
        <p className="text-gray-500 mt-2">{l.subtitle}</p>
      </div>
      <LeaderboardTable dict={l} />
    </div>
  )
}
