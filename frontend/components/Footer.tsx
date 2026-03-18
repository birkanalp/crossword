import Link from 'next/link'
import type { Lang } from '@/lib/dictionary'
import type { Dictionary } from '@/dictionaries/tr'

interface FooterProps {
  lang: Lang
  dict: Dictionary
}

export function Footer({ lang, dict }: FooterProps) {
  const links = [
    { href: `/${lang}/privacy-policy`, label: dict.nav.privacy },
    { href: `/${lang}/terms-of-service`, label: dict.nav.terms },
    { href: `/${lang}/cookie-policy`, label: dict.nav.cookies },
    { href: `/${lang}/support`, label: dict.nav.support },
  ]

  return (
    <footer className="border-t border-gray-100 mt-16">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Bulmaca. {dict.footer.rights}
        </p>
        <nav className="flex flex-wrap justify-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
