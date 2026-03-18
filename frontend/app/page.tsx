import { redirect } from 'next/navigation'
import { DEFAULT_LANG } from '@/lib/dictionary'

export default function RootPage() {
  redirect(`/${DEFAULT_LANG}`)
}
