import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NOT_ENFORCED_SETTING_KEYS, notEnforcedKeysIn } from '@/lib/settings/unenforced-settings'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B102: truthful audit, settings and not-implemented answers', () => {
  it('reports settings that are saved but enforced by no code', () => {
    expect(notEnforcedKeysIn({ mfaEnforcement: true, timezone: 'UTC', passwordMinLength: 12 })).toEqual(['mfaEnforcement', 'passwordMinLength'])
    expect(notEnforcedKeysIn({ timezone: 'UTC' })).toEqual([])
    expect(NOT_ENFORCED_SETTING_KEYS).toContain('sessionTimeout')
    expect(src('app/api/settings/organization/route.ts')).toContain('notEnforcedKeysIn(checkedSettings)')
  })

  it('makes the external authorization record mandatory: it is written through the atomic audit and a failure throws', () => {
    const service = src('lib/services/external-resource-authorization-service.ts')
    const audit = service.slice(service.indexOf('export async function auditExternalAuthorizationDecision'))
    expect(audit).toContain('persistAtomicAudit(')
    expect(audit).not.toContain('auditLog(')
    expect(audit).not.toMatch(/catch/)
    // the middleware answers 403 when anything in the decision path throws, so an unrecorded allowed decision releases nothing
    expect(src('lib/external-resource-middleware.ts')).toMatch(/catch \(error\)[\s\S]*status: 403/)
  })

  it('tells the caller when a sync ran but its outcome record could not be written', () => {
    expect(src('lib/audit/operation-audit.ts')).toContain('op.outcomeReport.recorded = recorded')
    expect(src('app/api/integrations/framework/[id]/sync/route.ts')).toContain('auditOutcomeRecorded: auditOutcome.recorded')
  })

  it('answers the enterprise data subject request route with 501 instead of a misleading 403', () => {
    const route = src('app/api/enterprise/dsr/requests/route.ts')
    expect(route).toContain('ApiError.notImplemented(MESSAGE)')
    expect(route).not.toContain('crudRoutes')
  })
})
