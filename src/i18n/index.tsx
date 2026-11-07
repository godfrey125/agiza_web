import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { copy, type Copy } from './copy'

export type Lang = 'en' | 'sw'

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  c: Copy
}

const I18nContext = createContext<I18nValue | null>(null)
const STORAGE_KEY = 'agiza.web.lang'

function initialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'sw') return stored
  const browser = navigator.language.toLowerCase()
  return browser.startsWith('sw') ? 'sw' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18nValue>(() => ({ lang, setLang, c: copy[lang] }), [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}

export function useCopy() {
  return useI18n().c
}
