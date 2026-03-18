import Link from 'next/link'
import type { Lang } from '@/lib/dictionary'
import type { Dictionary } from '@/dictionaries/tr'

interface HeaderProps {
  lang: Lang
  dict: Dictionary
}

export function Header({ lang, dict }: HeaderProps) {
  const otherLang = lang === 'tr' ? 'en' : 'tr'

  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={`/${lang}`} className="font-bold text-xl text-gray-900">
          Bulmaca
        </Link>

        <nav className="flex items-center gap-6 text-sm text-gray-600">
          <Link href={`/${lang}/leaderboard`} className="hover:text-gray-900 transition-colors">
            {dict.nav.leaderboard}
          </Link>
          <Link href={`/${lang}/support`} className="hover:text-gray-900 transition-colors">
            {dict.nav.support}
          </Link>
          <Link
            href={`/${otherLang}`}
            className="border border-gray-200 rounded-md px-3 py-1 hover:border-gray-400 transition-colors font-medium"
          >
            {otherLang.toUpperCase()}
          </Link>
        </nav>
      </div>
    </header>
  )
}
