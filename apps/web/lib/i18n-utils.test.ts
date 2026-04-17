import { describe, expect, it } from 'vitest'
import { defaultLocale, locales } from './locales'
import {
  detectLocaleFromHeaders,
  mergeMessages,
  normalizeLocaleCandidate,
} from './i18n-utils'

function createHeaders(values: Record<string, string>): Pick<Headers, 'get'> {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  }
}

describe('normalizeLocaleCandidate', () => {
  it('accepts exact locale matches', () => {
    expect(normalizeLocaleCandidate('en-CA', locales)).toBe('en-CA')
    expect(normalizeLocaleCandidate('fr-CA', locales)).toBe('fr-CA')
  })

  it('normalizes case and underscore separators', () => {
    expect(normalizeLocaleCandidate('EN_ca', locales)).toBe('en-CA')
    expect(normalizeLocaleCandidate('fr_ca', locales)).toBe('fr-CA')
  })

  it('maps base language tags to supported regional locales', () => {
    expect(normalizeLocaleCandidate('en', locales)).toBe('en-CA')
    expect(normalizeLocaleCandidate('fr', locales)).toBe('fr-CA')
  })

  it('returns undefined for unsupported locales', () => {
    expect(normalizeLocaleCandidate('es-MX', locales)).toBeUndefined()
  })
})

describe('detectLocaleFromHeaders', () => {
  it('prefers NEXT_LOCALE cookie when valid', () => {
    const locale = detectLocaleFromHeaders(
      createHeaders({
        cookie: 'foo=bar; NEXT_LOCALE=fr-CA; baz=1',
        'accept-language': 'en-CA,en;q=0.9',
      }),
      locales,
      defaultLocale,
    )
    expect(locale).toBe('fr-CA')
  })

  it('falls back to accept-language negotiation when cookie is absent', () => {
    const locale = detectLocaleFromHeaders(
      createHeaders({
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
      }),
      locales,
      defaultLocale,
    )
    expect(locale).toBe('fr-CA')
  })

  it('uses default locale when nothing matches', () => {
    const locale = detectLocaleFromHeaders(
      createHeaders({
        'accept-language': 'es-MX,es;q=0.8',
      }),
      locales,
      defaultLocale,
    )
    expect(locale).toBe(defaultLocale)
  })
})

describe('mergeMessages', () => {
  it('deep merges nested objects and preserves base keys', () => {
    const base = {
      common: {
        appName: 'Nzila Ventures',
        learnMore: 'Learn more',
      },
      nav: {
        home: 'Home',
      },
    }
    const override = {
      common: {
        learnMore: 'En savoir plus',
      },
    }

    const merged = mergeMessages(base, override) as Record<string, unknown>
    expect(merged).toEqual({
      common: {
        appName: 'Nzila Ventures',
        learnMore: 'En savoir plus',
      },
      nav: {
        home: 'Home',
      },
    })
  })
})
