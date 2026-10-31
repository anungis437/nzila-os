import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_QUESTIONS } from '@/lib/icra/questions'
import { DOCTRINE_VERSION } from '@/lib/icra/copy'
import { hasRecordedConsent, normalizeIcraLocale, serverConsentRecord } from '../consent'
import { missingRequiredAnswerIds } from '../stepwise-coverage'

const all = { acknowledgedAntiSurveillance: true, acknowledgedDataHandling: true, acknowledgedExplainability: true }

describe('B46 ICRA consent (DEF-0B8-ICRA-ONE-SHOT-SUBMIT-STORES-CLIENT-SUPPLIED-CONSENT, DEF-0B8-ICRA-STEPWISE-FLOW-NEVER-REQUIRES-CONSENT)', () => {
  it('builds the stored consent from the three acknowledgements and stamps time and doctrine itself', () => {
    const now = new Date('2026-05-05T12:00:00.000Z')
    const stored = serverConsentRecord({ ...all, acceptedAt: '1999-01-01', doctrineVersion: 'attacker', extra: 'x' }, now)
    expect(stored).toEqual({ ...all, acceptedAt: now.toISOString(), doctrineVersion: DOCTRINE_VERSION })
  })

  it.each([[undefined], [null], [{}], [{ ...all, acknowledgedDataHandling: false }], [{ ...all, acknowledgedExplainability: 'true' }]])('records no consent for %j', (value) => {
    expect(serverConsentRecord(value)).toBeNull()
  })

  it('counts a stored consent only with the three acknowledgements and the server stamp', () => {
    expect(hasRecordedConsent(serverConsentRecord(all))).toBe(true)
    expect(hasRecordedConsent(null)).toBe(false)
    expect(hasRecordedConsent(all)).toBe(false)
    expect(hasRecordedConsent({ ...all, acceptedAt: 'now' })).toBe(false)
  })

  it('accepts only supported locales and defaults a missing one', () => {
    expect(normalizeIcraLocale(undefined)).toBe('en-CA')
    expect(normalizeIcraLocale('fr-CA')).toBe('fr-CA')
    expect(normalizeIcraLocale('klingon-0123456789')).toBeNull()
    expect(normalizeIcraLocale(42)).toBeNull()
  })
})

describe('B46 ICRA stepwise coverage (DEF-0B8-ICRA-STEPWISE-SUBMIT-SCORES-ANY-NON-EMPTY-ANSWER-SET)', () => {
  it('requires answers for the required routed questions', () => {
    expect(missingRequiredAnswerIds([ALL_QUESTIONS[0].id]).length).toBeGreaterThan(0)
    expect(missingRequiredAnswerIds([])).not.toHaveLength(0)
  })

  it('is satisfied when every question is answered', () => {
    expect(missingRequiredAnswerIds(ALL_QUESTIONS.map((question) => question.id))).toEqual([])
  })
})

describe('B46 ICRA routes', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('requires consent to start, to answer and to submit the stepwise flow', () => {
    expect(read('app/api/icra/start/route.ts')).toContain('serverConsentRecord(payload.consent)')
    expect(read('app/api/icra/[assessmentId]/answer/route.ts')).toContain('hasRecordedConsent(assessment.consent)')
    const submit = read('app/api/icra/[assessmentId]/submit/route.ts')
    expect(submit).toContain('hasRecordedConsent(assessment.consent)')
    expect(submit).toContain('missingRequiredAnswerIds(')
  })

  it('stores a server-built consent, a supported locale, and bounds the one-shot body and context keys', () => {
    const submit = read('app/api/icra/submit/route.ts')
    expect(submit).toContain('serverConsentRecord(body.consent)')
    expect(submit).toContain('normalizeIcraLocale(body.locale)')
    expect(submit).toContain('ICRA_SUBMIT_MAX_BODY_BYTES')
    expect(submit).toContain('ORG_CONTEXT_KEY.test(key)')
    expect(submit).not.toContain('await req.json()')
  })
})
