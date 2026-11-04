/**
 * What the catalogs can say (UE-CONV-H-024). Pure apart from reading `messages/*.json`.
 *
 * The application does not load `fr-CA.json` alone: lib/i18n/messages.ts lays each locale's catalog over its base's (en-CA over en, fr-CA over fr, it and pt over
 * en-CA), and a key counts as present only if the merged catalog has it. Each message is also parsed the way the runtime parses it (use-intl compiles a message
 * that holds a `{` or a `<`): one that does not parse throws when a person opens the screen, and one whose arguments differ between English and French throws in
 * one language only (an apostrophe before a brace, `l'{name}`, quotes the argument away and prints it raw).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { loadMessages } from '../../../lib/i18n/messages'

export type Messages = Record<string, unknown>

/** Every message of a catalog by its dotted path. A group is not a message and is not listed; an array is a message the runtime refuses, and is listed as one. */
export function flattenMessages(messages: Messages, prefix = ''): Map<string, unknown> {
  const flat = new Map<string, unknown>()
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) for (const [inner, leaf] of flattenMessages(value as Messages, full)) flat.set(inner, leaf)
    else flat.set(full, value)
  }
  return flat
}

export interface Signature {
  /** The names a call must supply values for: arguments (plain, number, date, time, select, plural) and rich-text tags. */
  required: string[]
}

export type Parsed = { ok: true; signature: Signature } | { ok: false; error: string }

function collect(elements: MessageFormatElement[], names: Set<string>): void {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        names.add(element.value)
        break
      case TYPE.select:
      case TYPE.plural:
        names.add(element.value)
        for (const option of Object.values(element.options)) collect(option.value, names)
        break
      case TYPE.tag:
        names.add(`<${element.value}>`)
        collect(element.children, names)
        break
      default:
        break
    }
  }
}

/** A message the way the runtime reads it: which values it needs, or why it does not parse. */
export function parseMessage(message: unknown): Parsed {
  if (typeof message !== 'string') return { ok: false, error: Array.isArray(message) ? 'an array, which the runtime refuses' : `not a string (${typeof message})` }
  // use-intl serves a message with no brace and no angle bracket as written, without compiling it.
  if (!/[{<]|'[{}]/.test(message)) return { ok: true, signature: { required: [] } }
  try {
    const names = new Set<string>()
    collect(parse(message), names)
    return { ok: true, signature: { required: [...names].sort() } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.split('\n')[0] : String(error) }
  }
}

export interface Catalogs {
  /** The messages each locale can render, merged down its fallback chain. */
  byLocale: Record<string, Map<string, unknown>>
}

export const LIVE_LOCALES = ['en-CA', 'fr-CA'] as const
export const FALLBACK_LOCALES = ['it', 'pt'] as const

export async function loadCatalogs(root: string): Promise<Catalogs> {
  const read = async (catalog: string): Promise<Messages> => JSON.parse(readFileSync(path.join(root, 'messages', `${catalog}.json`), 'utf8')) as Messages
  const byLocale: Record<string, Map<string, unknown>> = {}
  for (const locale of [...LIVE_LOCALES, ...FALLBACK_LOCALES]) byLocale[locale] = flattenMessages(await loadMessages(locale, read))
  return { byLocale }
}
