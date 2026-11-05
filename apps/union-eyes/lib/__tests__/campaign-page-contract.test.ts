import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCapability } from '@/lib/reality/capability-registry'

const APP = join(__dirname, '..', '..')
const PAGES = join(APP, 'app', '[locale]', 'dashboard', 'communications', 'campaigns')
const LOCALES = ['en-CA', 'en', 'fr-CA', 'fr', 'it', 'pt']

const read = (...segments: string[]) => readFileSync(join(PAGES, ...segments), 'utf8')
const catalog = (locale: string, namespace: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(APP, 'messages', `${locale}.json`), 'utf8'))[namespace]

// The keys a page asks its namespace for with a literal: t('errors.notFound').
const keysUsed = (source: string): string[] => [...source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map((found) => found[1])

function hasMessage(messages: Record<string, unknown>, path: string): boolean {
  let node: unknown = messages
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string'
}

function enumValues(name: string): string[] {
  const schema = readFileSync(join(APP, 'db', 'schema', 'domains', 'communications', 'campaigns.ts'), 'utf8')
  const match = new RegExp(`pgEnum\\('${name}',\\s*\\[([^\\]]*)\\]`).exec(schema)
  if (!match) throw new Error(`enum ${name} not found`)
  return [...match[1].matchAll(/'([A-Za-z_]+)'/g)].map((found) => found[1])
}

describe('campaign detail page', () => {
  const source = read('[id]', 'page.tsx')

  it('reads the campaign through the route that exists, with the id the router gives, never a prop that Next 16 hands over as a promise', () => {
    expect(source).toContain('/api/communications/campaigns/${id}')
    expect(source).toContain('useParams<{ id: string }>()')
    expect(source).not.toMatch(/\bparams\.id\b/)
    expect(source).not.toMatch(/\/api\/messages\/threads/)
  })

  it('only reads: nothing sends, edits or deletes, and nothing links to a page that does not exist', () => {
    expect(source).not.toMatch(/method:\s*['"]/)
    expect(source).not.toMatch(/\/(send|schedule|send-test|edit)\b/)
  })

  it('says that sending is unavailable by an id the capability registry holds', () => {
    expect(source).toContain('capability="UE-ACTION-CAMPAIGN-SEND"')
    expect(getCapability('UE-ACTION-CAMPAIGN-SEND')?.state).toBe('NOT_IMPLEMENTED')
  })

  it.each(LOCALES)('has every message it asks for, and a word for every status, type and channel the table can hold (%s)', (locale) => {
    const messages = catalog(locale, 'communicationsCampaignDetailPage')
    for (const key of keysUsed(source)) expect(hasMessage(messages, key), key).toBe(true)
    for (const status of enumValues('campaign_status')) expect(hasMessage(messages, `statuses.${status}`), status).toBe(true)
    for (const type of enumValues('campaign_type')) expect(hasMessage(messages, `types.${type}`), type).toBe(true)
    for (const channel of enumValues('campaign_channel')) expect(hasMessage(messages, `channels.${channel}`), channel).toBe(true)
  })
})

describe('campaign wizard', () => {
  const source = read('new', 'page.tsx')

  it('creates through the one create route, and posts nothing that the delivery side owns or that only a sender could act on', () => {
    expect(source).toContain("'/api/communications/campaigns'")
    expect(source).toContain("method: 'POST'")
    expect(source).not.toMatch(/\/(send|schedule|send-test)\b/)
    expect(source).not.toMatch(/scheduledAt|sendImmediately|testMode|audienceCount/)
  })

  it('says that sending is unavailable by an id the capability registry holds', () => {
    expect(source).toContain('capability="UE-ACTION-CAMPAIGN-SEND"')
    expect(getCapability('UE-ACTION-CAMPAIGN-SEND')?.state).toBe('NOT_IMPLEMENTED')
  })

  it.each(LOCALES)('has every message it asks for and none of the scheduling or test-mode ones it dropped (%s)', (locale) => {
    const messages = catalog(locale, 'communicationsCampaignsNewPage')
    for (const key of keysUsed(source)) expect(hasMessage(messages, key), key).toBe(true)
    for (const dropped of ['scheduleCampaignTitle', 'sendNowOption', 'scheduleForLaterOption', 'scheduleDateTimeLabel', 'testModeLabel', 'testModeDescription', 'estimatedAudienceLabel', 'stepSchedule']) {
      expect(messages, dropped).not.toHaveProperty(dropped)
    }
  })
})
