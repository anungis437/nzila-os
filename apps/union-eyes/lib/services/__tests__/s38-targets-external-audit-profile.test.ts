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
    expect(audit.indexOf('!params.decision.allowed && !params.decision.authorityId')).toBeLessThan(audit.indexOf('persistAtomicAudit('))
  })

  // DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT
  it('asks whether the caller holds an authority, with no organization context, before opening the named organization\'s transaction', () => {
    const middleware = src('lib/external-resource-middleware.ts')
    const precheck = middleware.indexOf('withPrincipalOnlyContext((tx) => holdsExternalAuthority(')
    expect(precheck).toBeGreaterThan(-1)
    expect(precheck).toBeLessThan(middleware.indexOf('withRLSContext({ organizationId: resource.organizationId }'))
    const policy = src('db/migrations-cache/0056_external_authority_principal_precheck.sql')
    expect(policy).toContain("coalesce(current_setting('app.current_org_id', true), '') = ''")
    expect(policy).toContain('"representative_user_id"::text = current_setting(\'app.current_user_id\', true)')
    expect(policy).toContain('FOR SELECT TO "union_eyes_runtime"')
    const context = src('lib/db/with-rls-context.ts')
    const helper = context.slice(context.indexOf('export async function withPrincipalOnlyContext'))
    expect(helper.slice(0, helper.indexOf('\n}\n'))).toContain("set_config('app.current_org_id', '', true)")
  })
})
