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
  // One service module that holds an atomic operation, a two-phase provider call, a helper that reaches it and a class with both kinds of method.
  put('lib/svc/mixed.ts', [
    `import { performAuditedOperation } from '@/lib/audit/operation-audit'`,
    `import { persistAtomicAudit } from '@/lib/audit/atomic-audit'`,
    `export async function createThing(tx) { await tx.insert(things); await persistAtomicAudit(tx, {}) }`,
    `export const callProvider = () => performAuditedOperation({}, async () => fetch('https://provider.example'))`,
    `async function stage() { return callProvider() }`,
    `export const viaHelper = async () => { await stage() }`,
    `export class Sessions {`,
    `  async create(tx) { await tx.insert(sessions); await persistAtomicAudit(tx, {}) }`,
    `  async ask() { return performAuditedOperation({}, async () => fetch('https://provider.example')) }`,
    `}`,
  ].join('\n'))
  put('lib/svc/module-level.ts', `import { performAuditedOperation } from '@/lib/audit/operation-audit'\nexport const harmless = () => 1\nawait performAuditedOperation({}, async () => 0)\n`)
  put('lib/svc/comment-only.ts', `// This module used to call performAuditedOperation( directly.\nimport { persistAtomicAudit } from '@/lib/audit/atomic-audit'\nexport const save = (tx) => { tx.insert(z); return persistAtomicAudit(tx, {}) }\n`)
  const mixedRoute = (name: string, imports: string, body: string) => put(`app/api/${name}/route.ts`, `import { withApi } from '@/lib/api/framework'\n${imports}\nexport const POST = withApi({ auth: { required: true } }, async ({ tx }) => { ${body} })\n`)
  mixedRoute('mixed-atomic', `import { createThing, callProvider } from '@/lib/svc/mixed'`, 'await createThing(tx)')
  mixedRoute('mixed-two-phase', `import { createThing, callProvider } from '@/lib/svc/mixed'`, 'await callProvider()')
  mixedRoute('mixed-helper', `import { viaHelper } from '@/lib/svc/mixed'`, 'await viaHelper()')
  mixedRoute('mixed-passed-on', `import { callProvider } from '@/lib/svc/mixed'`, 'return [callProvider]')
  mixedRoute('class-atomic', `import { Sessions } from '@/lib/svc/mixed'`, 'await new Sessions().create(tx)')
  mixedRoute('class-two-phase', `import { Sessions } from '@/lib/svc/mixed'`, 'await new Sessions().ask()')
  mixedRoute('imports-but-unused', `import { callProvider } from '@/lib/svc/mixed'\nimport { persistAtomicAudit } from '@/lib/audit/atomic-audit'`, 'await persistAtomicAudit(tx, {}); tx.insert(q)')
  mixedRoute('module-level', `import { harmless } from '@/lib/svc/module-level'`, 'harmless(); tx.insert(q)')
  mixedRoute('comment-only', `import { save } from '@/lib/svc/comment-only'`, 'await save(tx)')
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

  describe('two-phase only for what a route actually invokes', () => {
    it('does not call a route two-phase because a module it imports also holds an unrelated two-phase operation', () => {
      const routes = by()
      expect(routes.get('mixed-atomic')?.audit).toBe('ATOMIC_SERVICE')
      expect(routes.get('class-atomic')?.audit).toBe('ATOMIC_SERVICE')
      expect(routes.get('imports-but-unused')?.audit).toBe('ATOMIC')
    })

    it('still calls a route two-phase when it invokes the operation, directly, through a helper, as a class method or by handing it on', () => {
      const routes = by()
      for (const name of ['mixed-two-phase', 'mixed-helper', 'mixed-passed-on', 'class-two-phase', 'two-phase']) {
        expect(routes.get(name)?.audit, name).toBe('INTENT_OUTCOME')
      }
    })

    it('stays two-phase when a reachable module calls the operation where no name can be attributed to it', () => {
      expect(by().get('module-level')?.audit).toBe('INTENT_OUTCOME')
    })

    it('does not count the operation\'s name in a comment as a call', () => {
      expect(by().get('comment-only')?.audit).toBe('ATOMIC_SERVICE')
    })
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
