import type { Locale } from './locales'

type MessageTree = Record<string, unknown>

function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const q = qParam ? Number(qParam.split('=')[1]) : 1
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0 }
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag)
}

export function mergeMessages(base: MessageTree, localeSpecific: MessageTree): MessageTree {
  const merged: MessageTree = { ...base }
  for (const key of Object.keys(localeSpecific)) {
    const baseVal = base[key]
    const overrideVal = localeSpecific[key]
    if (
      baseVal &&
      overrideVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal) &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal)
    ) {
      merged[key] = mergeMessages(baseVal as MessageTree, overrideVal as MessageTree)
    } else {
      merged[key] = overrideVal
    }
  }
  return merged
}

export function normalizeLocaleCandidate(
  candidate: string | undefined,
  supportedLocales: readonly Locale[],
): Locale | undefined {
  if (!candidate) return undefined
  const normalized = candidate.replace('_', '-').toLowerCase()

  const exact = supportedLocales.find((locale) => locale.toLowerCase() === normalized)
  if (exact) return exact

  const [lang] = normalized.split('-')
  if (!lang) return undefined
  return supportedLocales.find((locale) => locale.toLowerCase().startsWith(`${lang}-`))
}

export function detectLocaleFromHeaders(
  headers: Pick<Headers, 'get'>,
  supportedLocales: readonly Locale[],
  fallbackLocale: Locale,
): Locale {
  const cookieHeader = headers.get('cookie') ?? ''
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i)
  const cookieLocale = normalizeLocaleCandidate(cookieMatch?.[1], supportedLocales)
  if (cookieLocale) return cookieLocale

  const acceptLanguage = headers.get('accept-language') ?? ''
  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const negotiated = normalizeLocaleCandidate(tag, supportedLocales)
    if (negotiated) return negotiated
  }

  return fallbackLocale
}
