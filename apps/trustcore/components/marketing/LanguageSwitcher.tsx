'use client'

import { useRouter } from 'next/navigation'

const LOCALES = [
  { code: 'fr-CA', shortLabel: 'FR' },
  { code: 'en-CA', shortLabel: 'EN' },
] as const

interface LanguageSwitcherProps {
  currentLocale?: string
}

export function LanguageSwitcher({ currentLocale = 'fr-CA' }: LanguageSwitcherProps) {
  const router = useRouter()

  function switchLocale(code: string) {
    if (code === currentLocale) return
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;SameSite=Lax`
    router.refresh()
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur">
      {LOCALES.map((locale, index) => {
        const isActive = locale.code === currentLocale
        return (
          <span key={locale.code} className="contents">
            {index > 0 ? <span className="text-slate-300">|</span> : null}
            <button
              type="button"
              onClick={() => switchLocale(locale.code)}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'text-slate-950' : 'text-slate-500 transition hover:text-slate-900'}
            >
              {locale.shortLabel}
            </button>
          </span>
        )
      })}
    </div>
  )
}
