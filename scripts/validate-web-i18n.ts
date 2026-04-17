import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { locales, defaultLocale } from '../apps/web/lib/locales'
import { mergeMessages } from '../apps/web/lib/i18n-utils'

type JsonMap = Record<string, unknown>

const root = process.cwd()
const messagesDir = path.join(root, 'apps', 'web', 'messages')

function loadJson(filePath: string): JsonMap {
  const content = readFileSync(filePath, 'utf8')
  return JSON.parse(content) as JsonMap
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  const out: string[] = []
  for (const [key, nested] of Object.entries(value as JsonMap)) {
    const next = prefix ? `${prefix}.${key}` : key
    const nestedKeys = flattenKeys(nested, next)
    if (nestedKeys.length === 0) {
      out.push(next)
    } else {
      out.push(...nestedKeys)
    }
  }
  return out
}

function getBaseLanguage(locale: string): string | undefined {
  const [lang] = locale.split('-')
  return lang && lang !== locale ? lang : undefined
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`Web i18n validation failed: ${message}`)
    process.exit(1)
  }
}

assert(locales.includes(defaultLocale), `defaultLocale '${defaultLocale}' must be listed in locales`)

const baseComposedByLocale = new Map<string, JsonMap>()

for (const locale of locales) {
  const localeFile = path.join(messagesDir, `${locale}.json`)
  assert(existsSync(localeFile), `missing locale catalog ${path.relative(root, localeFile)}`)

  const localeMessages = loadJson(localeFile)
  const baseLang = getBaseLanguage(locale)

  let composed: JsonMap = localeMessages
  if (baseLang) {
    const baseFile = path.join(messagesDir, `${baseLang}.json`)
    assert(existsSync(baseFile), `missing base language catalog ${path.relative(root, baseFile)} for ${locale}`)
    const baseMessages = loadJson(baseFile)
    composed = mergeMessages(baseMessages, localeMessages)
  }

  baseComposedByLocale.set(locale, composed)
}

const defaultMessages = baseComposedByLocale.get(defaultLocale)
assert(Boolean(defaultMessages), `missing composed messages for default locale ${defaultLocale}`)
const baselineKeys = new Set(flattenKeys(defaultMessages))

for (const locale of locales) {
  const composed = baseComposedByLocale.get(locale) as JsonMap
  const localeKeys = new Set(flattenKeys(composed))

  for (const key of baselineKeys) {
    assert(localeKeys.has(key), `locale ${locale} missing key '${key}'`) 
  }
}

console.log('Web i18n validation passed.')
