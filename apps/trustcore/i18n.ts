import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

type MessagePrimitive = string | number | boolean | null
interface MessageMap { [key: string]: MessageValue }
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MessageList extends Array<MessageValue> {}
type MessageValue = MessagePrimitive | MessageMap | MessageList
type Messages = MessageMap

function isObject(v: unknown): v is Messages {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge(base: Messages, override: Messages): Messages {
  if (!isObject(base) || !isObject(override)) return (override ?? base) as Messages
  const merged: Messages = { ...base }
  for (const key of Object.keys(override)) {
    const b = merged[key]; const o = override[key]
    merged[key] = isObject(b) && isObject(o) ? deepMerge(b, o) : o
  }
  return merged
}

export const TRUSTCORE_LOCALES = ['en-CA', 'fr-CA'] as const
export type TrustcoreLocale = (typeof TRUSTCORE_LOCALES)[number]

export const TRUSTCORE_DEFAULT_LOCALE: TrustcoreLocale = 'fr-CA'

function normalizeLocale(locale: string | undefined | null): TrustcoreLocale {
  if (locale === 'en' || locale === 'en-CA') return 'en-CA'
  if (locale === 'fr' || locale === 'fr-CA') return 'fr-CA'
  return TRUSTCORE_DEFAULT_LOCALE
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requestResolvedLocale = normalizeLocale(await requestLocale)
  const cookieStore = await cookies()
  const cookieLocale = normalizeLocale(cookieStore.get('NEXT_LOCALE')?.value)
  const locale = cookieStore.has('NEXT_LOCALE') ? cookieLocale : requestResolvedLocale

  const base = (await import('./messages/en-CA.json')).default as Messages
  let messages: Messages = base
  try {
    if (locale !== 'en-CA') {
      const override = (await import(`./messages/${locale}.json`)).default as Messages
      messages = deepMerge(base, override)
    }
  } catch {
    // Locale file missing — fall back to en-CA
  }

  return { locale, messages }
})
