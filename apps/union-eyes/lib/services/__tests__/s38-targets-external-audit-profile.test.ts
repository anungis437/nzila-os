import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B94: KPI target bounds and external refusal audit scope', () => {
  it('stores a KPI calculation only as one named aggregation and promises no alert', () => {
    const route = src('app/api/targets/route.ts')
    expect(route).toContain("z.object({ aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']) }).strict()")
    expect(route).toContain('alertEnabled: z.literal(false).default(false)')
    expect(route).not.toContain('z.record(z.string(), z.unknown())')
  })

  it('does not write a stranger\'s refusal into the audit trail of the organization they named', () => {
    const service = src('lib/services/external-resource-authorization-service.ts')
    const audit = service.slice(service.indexOf('export async function auditExternalAuthorizationDecision'))
    expect(audit.indexOf('!params.decision.allowed && !params.decision.authorityId')).toBeGreaterThan(-1)
    expect(audit.indexOf('!params.decision.allowed && !params.decision.authorityId')).toBeLessThan(audit.indexOf('return auditLog({'))
  })
})
