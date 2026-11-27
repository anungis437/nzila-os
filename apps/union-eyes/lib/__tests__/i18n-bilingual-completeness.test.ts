/**
 * Step 1 bilingual completeness (O12): every en-CA message has a fr-CA message and vice versa, with the same ICU arguments,
 * and a multi-word string identical in both languages is only allowed where it is reviewed as language-neutral.
 */
import { describe, expect, it } from 'vitest'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'

type Tree = { [key: string]: string | Tree }
const flatten = (tree: Tree, prefix = ''): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    if (value && typeof value === 'object') for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v)
    else out.set(`${prefix}${key}`, String(value))
  }
  return out
}
const E = flatten(en as Tree)
const F = flatten(fr as Tree)
/** ICU argument names used by a message, recursing into plural/select option bodies (which are messages, not arguments). */
function args(message: string): string[] {
  const found = new Set<string>()
  const walk = (text: string) => {
    let i = 0
    while (i < text.length) {
      if (text[i] !== '{') { i++; continue }
      let depth = 0, j = i
      for (; j < text.length; j++) { if (text[j] === '{') depth++; else if (text[j] === '}' && --depth === 0) break }
      const inner = text.slice(i + 1, j)
      const [name, type, ...rest] = inner.split(',')
      if (/^\s*[A-Za-z_]\w*\s*$/.test(name)) found.add(name.trim())
      if (type && /^\s*(plural|select|selectordinal)\s*$/.test(type)) {
        const options = rest.join(',')
        for (const body of options.match(/\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? []) walk(body.slice(1, -1))
      }
      i = j + 1
    }
  }
  walk(message)
  return [...found].sort()
}
/** Intentionally empty in both languages: the blank correspondence template starts with no subject and no body. */
const INTENTIONALLY_EMPTY = new Set(['correspondencePage.composer.templates.blank.subject', 'correspondencePage.composer.templates.blank.body'])

/** Reviewed: brand and page titles, product names, numeric/plural formats and the intentionally French Québec banner. */
const REVIEWED_IDENTICAL = new Set([
  'workAidPage.metaTitle', 'claims.types.discriminationRace', 'precedents.viewer.citationCount', 'settingsIntegrationsPage.providers.outlook',
  'notificationsPage.metaTitle', 'pensionMemberPage.metaTitle', 'adminMigrationsPage.metaTitle', 'settings.storageProviders.gcs',
  'marketing.solutions.index.metaTitle', 'qcBilingualBanner.message', 'qcBilingualBanner.switchAction', 'qcBilingualBanner.law25Note',
  'negotiationTimeline.proposalDescription', 'campaignDashboard.card.progressOf',
])

describe('en-CA / fr-CA bilingual completeness', () => {
  it('both catalogs have exactly the same message keys', () => {
    expect(E.size).toBeGreaterThan(10_000)
    expect([...E.keys()].filter((k) => !F.has(k))).toEqual([])
    expect([...F.keys()].filter((k) => !E.has(k))).toEqual([])
  })
  it('no message is empty in either language unless it is intentionally empty in both', () => {
    expect([...E].filter(([k, v]) => v.trim() === '' && !INTENTIONALLY_EMPTY.has(k)).map(([k]) => k)).toEqual([])
    expect([...F].filter(([k, v]) => v.trim() === '' && !INTENTIONALLY_EMPTY.has(k)).map(([k]) => k)).toEqual([])
    for (const k of INTENTIONALLY_EMPTY) expect([E.get(k), F.get(k)], k).toEqual(['', ''])
  })
  it('the argument extractor reads plural bodies as messages, not arguments', () => {
    expect(args('{count} bugfix{count, plural, one {} other {es}}')).toEqual(['count'])
    expect(args('{n, plural, one {# item for {name}} other {# items}}')).toEqual(['n', 'name'])
  })
  it('each message takes the same ICU arguments in both languages', () => {
    const mismatched = [...E].filter(([k, v]) => JSON.stringify(args(v)) !== JSON.stringify(args(F.get(k) ?? ''))).map(([k]) => k)
    expect(mismatched).toEqual([])
  })
  it('a multi-word string identical in both languages is reviewed as language-neutral (the list may only shrink)', () => {
    const identical = [...E].filter(([k, v]) => F.get(k) === v && /[a-z]{4,}/i.test(v) && v.split(/\s+/).length >= 3).map(([k]) => k)
    expect(identical.filter((k) => !REVIEWED_IDENTICAL.has(k))).toEqual([])
    for (const k of REVIEWED_IDENTICAL) expect(identical, k).toContain(k)
  })
})
