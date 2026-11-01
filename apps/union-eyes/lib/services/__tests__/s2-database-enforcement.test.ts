import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCheckViolation } from '@/lib/db/unique-violation'
import { expiryWarningKey } from '@/lib/services/rewards/expiry-warning-marker'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('S2 database enforcement of the partial Gate 0 fixes (migration 0040)', () => {
  it('recognises a check violation, which is what the capacity trigger raises', () => {
    expect(isCheckViolation(Object.assign(new Error('course session is full'), { code: '23514' }))).toBe(true)
    expect(isCheckViolation({ cause: { code: '23514' } })).toBe(true)
    expect(isCheckViolation(Object.assign(new Error('x'), { code: '23505' }))).toBe(false)
  })

  it('keys an expiry warning by lot date and tier, so each tier is recorded once per lot', () => {
    const lot = { expirationDate: new Date('2026-12-01T15:00:00Z') }
    expect(expiryWarningKey(lot, 7)).toBe('rewards-expiry:7:2026-12-01')
    expect(expiryWarningKey(lot, 14)).not.toBe(expiryWarningKey(lot, 7))
  })

  it('declares the enum value, the columns and the index the migration adds', () => {
    expect(read('db/schema/domains/employer-execution/employer-artifacts.ts')).toContain('"new_engine"')
    const ml = read('db/schema/domains/ml/predictions.ts')
    expect(ml).toContain('varchar("model_version"')
    expect(ml).toContain('varchar("subject_id"')
    for (const file of ['db/schema/domains/scheduling/training.ts', 'db/schema/education-training-schema.ts']) {
      expect(read(file)).toContain('uq_course_registrations_member_session')
    }
  })

  it('records an engine-change replay as new_engine and not as a faithful re-run', () => {
    const route = read('app/api/employer-execution/replay/[runId]/route.ts')
    expect(route).toContain('body.mode === "new_engine" ? "new_engine" : "exact"')
  })

  it('stores the model version and case on the SLA prediction, and scores feedback against the recorded version', () => {
    const predict = read('app/api/ml/predictions/sla-breach-risk/route.ts')
    expect(predict).toContain('modelVersion: model.version')
    expect(predict).toContain('subjectId: body.caseId')
    const feedback = read('app/api/ml/predictions/sla-breach-risk/feedback/route.ts')
    expect(feedback).toContain("body.modelVersion ?? prediction.modelVersion ?? 'sla-risk-v1'")
    // The version check is now written against the stored outcome row (S10 rewrote the route; disclosed update).
    expect(feedback).toContain('prediction.modelVersion !== model.version')
  })

  it('answers a lost registration race as a conflict through the factory error mapping', () => {
    const route = read('app/api/education/registrations/route.ts')
    expect(route).toContain('mapCreateError')
    expect(route).toContain("ApiError.conflict('This session is full')")
    expect(route).toContain("ApiError.conflict('Already registered for this session')")
    expect(read('lib/api/crud-factory.ts')).toContain('throw opts.mapCreateError?.(error) ?? error')
  })

  it('writes the expiry warning record before the mail leaves and releases it when the mail fails', () => {
    const service = read('lib/services/rewards/notification-service.ts')
    expect(service.indexOf('claimExpiryWarning(entry, tierDays)')).toBeLessThan(service.indexOf('await sendCreditExpirationEmail'))
    expect(service).toContain('releaseExpiryWarning(entry, tierDays)')
  })
})
