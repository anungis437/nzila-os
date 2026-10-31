import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { scanRoutes } from '../../scripts/lib/route-coverage-scan'

/**
 * The scanner's claims about audit and guard, proven on a synthetic tree so each rule is exercised on its own. DEF-0B1-NON-ATOMIC-
 * AUDIT-INTENT-OUTCOME and DEF-0B1-MANIFEST-DETECTOR.
 */
let root = ''
const put = (path: string, text: string) => {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, text)
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'route-scan-'))
  put('lib/api/crud-governance.ts', `const DENIED = ['documents'] as const\nconst READ_ONLY = ['analytics_metrics'] as const\nconst SUBJECT_OWNED = ['user_consents'] as const\nconst OPERATIONAL = ['employers'] as const\n`)
  put('db/schema/t.ts', `export const documents = pgTable("documents", {})\nexport const analyticsMetrics = pgTable("analytics_metrics", {})\nexport const userConsents = pgTable("user_consents", {})\nexport const employers = pgTable("employers", {})\n`)
  put('lib/audit/operation-audit.ts', `import { persistAtomicAudit } from './atomic-audit'\nexport async function performAuditedOperation(op, fn) { await persistAtomicAudit(); return fn() }\n`)
  put('lib/svc/two-phase.ts', `import { performAuditedOperation } from '@/lib/audit/operation-audit'\nexport const run = () => performAuditedOperation({}, async () => { db.update(x) })\n`)
  put('lib/svc/atomic.ts', `import { persistAtomicAudit } from '@/lib/audit/atomic-audit'\nexport const run = (tx) => { tx.update(x); return persistAtomicAudit(tx, {}) }\n`)
  put('app/api/two-phase/route.ts', `import { withApi } from '@/lib/api/framework'\nimport { run } from '@/lib/svc/two-phase'\nexport const POST = withApi({ auth: { required: true } }, async () => run())\n`)
  put('app/api/atomic-service/route.ts', `import { withApi } from '@/lib/api/framework'\nimport { run } from '@/lib/svc/atomic'\nexport const POST = withApi({ auth: { required: true } }, async () => run())\n`)
  put('app/api/atomic-own/route.ts', `import { withApi } from '@/lib/api/framework'\nimport { persistAtomicAudit } from '@/lib/audit/atomic-audit'\nexport const POST = withApi({ auth: { required: true } }, async ({ tx }) => { tx.insert(y); await persistAtomicAudit(tx, {}) })\n`)
  put('app/api/crud-denied/route.ts', `import { crudRoutes } from '@/lib/api/crud-factory'\nimport { documents } from '@/db/schema'\nconst { GET, POST } = crudRoutes({ table: documents, pk: 'id' })\nexport { GET, POST }\n`)
  put('app/api/crud-read-only/route.ts', `import { crudRoutes } from '@/lib/api/crud-factory'\nimport { analyticsMetrics } from '@/db/schema'\nconst { GET, POST, PATCH } = crudRoutes({ table: analyticsMetrics, pk: 'id' })\nexport { GET, POST, PATCH }\n`)
  put('app/api/crud-operational/route.ts', `import { crudRoutes } from '@/lib/api/crud-factory'\nimport { employers } from '@/db/schema'\nconst { GET, POST } = crudRoutes({ table: employers, pk: 'id' })\nexport { GET, POST }\n`)
  put('app/api/crud-subject-owned/route.ts', `import { crudRoutes } from '@/lib/api/crud-factory'\nimport { userConsents } from '@/db/schema'\nconst { GET, POST } = crudRoutes({ table: userConsents, pk: 'id', ownerColumn: 'userId' })\nexport { GET, POST }\n`)
  put('app/api/admin-inside/route.ts', `import { auth } from '@nzila/platform-auth/entra/server'\nimport { requireSystemAdmin } from '@/lib/api-auth-guard'\nexport async function POST() { await auth(); await requireSystemAdmin() }\n`)
  put('app/api/role-inside/route.ts', `import { auth } from '@nzila/platform-auth/entra/server'\nimport { hasMinRole } from '@/lib/api-auth-guard'\nexport async function POST() { await auth(); if (!(await hasMinRole('officer'))) return null }\n`)
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('route coverage scanner', () => {
  const by = () => new Map(scanRoutes(root).map((e) => [e.route.replace('/route.ts', ''), e]))

  it('does not call a performAuditedOperation route atomic: it is a two-phase intent and outcome record', () => {
    expect(by().get('two-phase')?.audit).toBe('INTENT_OUTCOME')
  })

  it('still calls an atomic audit atomic, whether the route or a service it reaches writes it', () => {
    expect(by().get('atomic-service')?.audit).toBe('ATOMIC_SERVICE')
    expect(by().get('atomic-own')?.audit).toBe('ATOMIC')
  })

  it('does not report a generic CRUD route as mutating when its table refuses every generic write', () => {
    const routes = by()
    for (const name of ['crud-denied', 'crud-read-only']) expect(routes.get(name), name).toMatchObject({ mutating: false, audit: 'READ_ONLY', guard: 'CRUD_FACTORY' })
    expect(routes.get('crud-operational')).toMatchObject({ mutating: true, audit: 'CRUD_ATOMIC' })
    expect(routes.get('crud-subject-owned')).toMatchObject({ mutating: true })
  })

  it('sees the administrator and role gates a handler applies itself', () => {
    expect(by().get('admin-inside')?.guard).toBe('ADMIN_AUTH')
    expect(by().get('role-inside')?.guard).toBe('ROLE_AUTH')
  })
})
