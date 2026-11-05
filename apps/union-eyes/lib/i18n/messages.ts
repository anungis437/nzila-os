import type { Locale } from '@/lib/locales';

/**
 * Which catalog sits underneath each locale's own: a region locale's keys win and the base language fills in what it does not carry, so a message added to
 * `fr.json` shows in fr-CA. Italian and Portuguese fall back to Canadian English, which itself falls back to English. This is the one description of that rule;
 * i18n.ts applies it per request and the i18n census (scripts/lib/i18n-census) applies it to judge which keys a locale can really render.
 */
export const BASE_CATALOG: Readonly<Record<Locale, string | null>> = {
  'en-CA': 'en',
  'fr-CA': 'fr',
  it: 'en-CA',
  pt: 'en-CA',
};

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type Messages = Record<string, unknown>;

const isGroup = (value: unknown): value is Messages => !!value && typeof value === 'object' && !Array.isArray(value);

/** `localeSpecific` over `base`, group by group: a message the locale does not carry is the base language's. */
export function mergeMessages(base: Messages, localeSpecific: Messages): Messages {
  const merged = new Map<string, unknown>(Object.entries(base));
  for (const [key, override] of Object.entries(localeSpecific)) {
    if (BLOCKED_KEYS.has(key)) continue;
    const inherited = merged.get(key);
    if (isGroup(inherited) && isGroup(override)) merged.set(key, mergeMessages(inherited, override));
    else merged.set(key, override);
  }
  return Object.fromEntries(merged);
}

/**
 * Every message a locale can render: its own catalog over its base's, to the root of the chain (it → en-CA → en). `read` returns one catalog file by name
 * (`en-CA`, `fr`, ...); a base the chain names that does not exist is an error, not an empty catalog.
 */
export async function loadMessages(locale: string, read: (catalog: string) => Promise<Messages>): Promise<Messages> {
  const own = await read(locale);
  const base = (BASE_CATALOG as Readonly<Record<string, string | null>>)[locale] ?? null;
  return base ? mergeMessages(await loadMessages(base, read), own) : own;
}
