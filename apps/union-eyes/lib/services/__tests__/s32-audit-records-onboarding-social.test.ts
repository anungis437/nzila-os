import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B88: audit records for onboarding reads, social connection and integration sync', () => {
  it('records each onboarding read in the canonical audit log and no longer emits to the in-process bus', () => {
    for (const [route, action] of [
      ['discover-federation', 'onboarding.federation_discovery'],
      ['peer-benchmarks', 'onboarding.peer_benchmarks'],
      ['suggest-clauses', 'onboarding.clause_suggestions'],
    ]) {
      const source = src(`app/api/onboarding/${route}/route.ts`)
      expect(source).toContain(`await recordOnboardingRead(`)
      expect(source).toContain(action)
      expect(source).not.toContain('eventBus')
    }
    const writer = src('lib/utils/onboarding-read-audit.ts')
    expect(writer).toContain('persistAtomicAudit(tx')
    expect(writer).toContain("resourceType: 'onboarding'")
  })

  it('refuses a dry-run sync because nothing performs one', () => {
    expect(src('app/api/integrations/framework/[id]/sync/route.ts')).toContain('dryRun: z.literal(false).optional()')
  })

  it('audits social account listing and connection in the canonical log, the completion with the credential', () => {
    const list = src('app/api/social-media/accounts/route.ts')
    expect(list).not.toContain('logApiAuditEvent')
    expect(list).toContain("action: 'social_account.list'")
    expect(list).toContain("action: 'social_account.connect_initiated'")
    const callback = src('app/api/social-media/accounts/callback/route.ts')
    expect(callback).not.toContain('logApiAuditEvent')
    const tx = callback.slice(callback.indexOf('withRLSContext({ organizationId }, async (tx) => {'))
    expect(tx.indexOf('.onConflictDoUpdate')).toBeLessThan(tx.indexOf("action: 'social_account.connected'"))
  })
})
