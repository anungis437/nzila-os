/**
 * Brand-voice registry — enforces tone & forbidden phrases.
 */
import { brandVoiceSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type { BrandVoice, GrowthScope } from '../types'
import { makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'brand-voice'

export interface CreateBrandVoiceInput {
  scope: GrowthScope
  label: string
  tone: string[]
  forbiddenPhrases?: string[]
  trustPosture?: BrandVoice['trustPosture']
  requiredDisclosures?: string[]
  id?: string
}

export function upsertBrandVoice(input: CreateBrandVoiceInput): BrandVoice {
  const now = nowISO()
  const id = input.id ?? makeId('voice')
  const existing = readRecord(ENTITY, id, brandVoiceSchema)
  const record: BrandVoice = {
    id,
    scope: input.scope,
    label: input.label,
    tone: input.tone,
    forbiddenPhrases: input.forbiddenPhrases ?? [],
    trustPosture: input.trustPosture ?? 'evidence-first',
    requiredDisclosures: input.requiredDisclosures ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  return writeRecord(ENTITY, id, record, brandVoiceSchema)
}

export function getBrandVoice(id: string): BrandVoice | null {
  return readRecord(ENTITY, id, brandVoiceSchema)
}

export function listBrandVoices(scope?: GrowthScope): BrandVoice[] {
  const all = listRecords(ENTITY, brandVoiceSchema)
  if (!scope) return all
  const key = scopeKey(scope)
  return all.filter((v) => scopeKey(v.scope) === key)
}

export interface VoiceCheckResult {
  ok: boolean
  violations: Array<{ kind: 'forbidden_phrase' | 'missing_disclosure'; detail: string }>
}

/**
 * Check copy against a voice. Fails closed (any violation → ok=false).
 * Forbidden-phrase matching is case-insensitive substring.
 */
export function checkCopyAgainstVoice(copy: string, voice: BrandVoice): VoiceCheckResult {
  const violations: VoiceCheckResult['violations'] = []
  const lower = copy.toLowerCase()
  for (const phrase of voice.forbiddenPhrases) {
    if (phrase && lower.includes(phrase.toLowerCase())) {
      violations.push({ kind: 'forbidden_phrase', detail: phrase })
    }
  }
  for (const disclosure of voice.requiredDisclosures) {
    if (disclosure && !lower.includes(disclosure.toLowerCase())) {
      violations.push({ kind: 'missing_disclosure', detail: disclosure })
    }
  }
  return { ok: violations.length === 0, violations }
}
