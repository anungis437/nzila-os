'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { locales, localeLabels, type Locale } from '@/lib/locales'

/**
 * Locales that have full translation files.
 * Others fall back to en-CA automatically via i18n.ts try/catch.
 */
const translatedLocales: Locale[] = ['en-CA', 'fr-CA', 'ln']
const prioritizedAfricanLocales: Locale[] = ['sw', 'ha', 'ar']

interface LanguageSwitcherProps {
  /** Current locale from the URL or default. */
  currentLocale?: string
  /** Visual variant. */
  variant?: 'light' | 'dark'
  /** Show only locales with full translations, or all defined locales. */
  showAll?: boolean
  /** Dropdown direction. */
  dropDirection?: 'up' | 'down'
}

export function LanguageSwitcher({
  currentLocale,
  variant = 'dark',
  showAll = false,
  dropDirection = 'up',
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  // Resolve the active locale: from prop, from URL path segment, or from cookie
  const resolvedLocale = (() => {
    if (currentLocale) return currentLocale
    const localePattern = new RegExp(`^/(${locales.join('|')})(\/|$)`)
    const match = pathname.match(localePattern)
    if (match) return match[1]
    // Marketing pages: read from cookie
    if (typeof document !== 'undefined') {
      const cookie = document.cookie.split('; ').find(c => c.startsWith('NEXT_LOCALE='))
      if (cookie) return cookie.split('=')[1]
    }
    return 'en-CA'
  })()

  const available = showAll ? [...locales] : [...translatedLocales, ...prioritizedAfricanLocales]
  const currentLabel =
    localeLabels[resolvedLocale as Locale] ??
    localeLabels['en-CA']

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function switchLocale(newLocale: string) {
    setOpen(false)

    // If we're in a locale-prefixed path (e.g., /en/dashboard/catalog),
    // swap the locale segment.
    const localePattern = new RegExp(`^/(${locales.join('|')})(\/|$)`)
    const match = pathname.match(localePattern)

    if (match) {
      const rest = pathname.slice(match[1].length + 1) // strip /en
      router.push(`/${newLocale}${rest}`)
    } else {
      // Marketing/non-locale pages: save preference for next dashboard visit
      // eslint-disable-next-line react-hooks/immutability -- document.cookie is a browser API, not component state
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`
      router.refresh()
    }
  }

  const isLight = variant === 'light'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isLight
            ? 'text-gray-600 hover:text-navy hover:bg-gray-100'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        aria-label="Switch language"
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{currentLabel}</span>
        <span className="sm:hidden">{(resolvedLocale as string).split('-')[0].toUpperCase()}</span>
      </button>

      {open && (
        <div
          className={`absolute z-50 min-w-45 rounded-xl border shadow-lg py-1 ${
            dropDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
          } right-0 ${
            isLight
              ? 'bg-white border-gray-200'
              : 'bg-navy border-white/10'
          }`}
        >
          {available.map((locale) => {
            const isActive = locale === resolvedLocale
            return (
              <button
                key={locale}
                onClick={() => switchLocale(locale)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? isLight
                      ? 'bg-electric/10 text-electric font-medium'
                      : 'bg-white/10 text-white font-medium'
                    : isLight
                      ? 'text-gray-600 hover:bg-gray-50 hover:text-navy'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex-1 text-left">{localeLabels[locale]}</span>
                {isActive && <span className="text-electric text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
