import { tr } from '@/dictionaries/tr'
import { en } from '@/dictionaries/en'

export type Lang = 'tr' | 'en'

export const SUPPORTED_LANGS: Lang[] = ['tr', 'en']
export const DEFAULT_LANG: Lang = 'tr'

const dictionaries = { tr, en }

export function getDictionary(lang: Lang) {
  return dictionaries[lang] ?? dictionaries[DEFAULT_LANG]
}

export function isValidLang(lang: string): lang is Lang {
  return SUPPORTED_LANGS.includes(lang as Lang)
}
