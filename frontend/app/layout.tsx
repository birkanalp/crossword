import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bulmaca',
  description: 'Türkçe bulmaca oyunu',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
