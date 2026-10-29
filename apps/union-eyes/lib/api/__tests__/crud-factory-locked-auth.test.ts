/**
 * R-52 adversarial regression: lockedAuthCheck is an enforced write boundary, not merely
 * route configuration.  A same-org steward must not change or delete another member's
 * personal calendar.  PATCH WITHOUT beforeUpdate/mergeJsonColumns and DELETE previously
 * ignored lockedAuthCheck entirely.
 *
 * This runs the actual CRUD factory and the transaction callback.  The persistence,
 * row-lock and audit adapters are instrumented to prove the ordering; real HTTP/native
 * PostgreSQL acceptance remains separately required.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pgTable, text, uuid, timestamp, boolean, type PgTable } from 'drizzle-orm/pg-core'

const m = vi.hoisted(() => ({
  handlers: new Map<string, (ctx: Record<string, unknown>) => Promise<unknown>>(),
  lockedRow: null as Record<string, unknown> | null,
  steps: [] as string[],
  audit: vi.fn(),
  authorizer: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('../with-api', () => ({
  withApi: (opts: { openapi: { summary: string } }, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    m.handlers.set(opts.openapi.summary.split(' ')[0], handler)
    return handler
  },
}))
vi.mock('@/db/db', () => ({ db: { select: vi.fn() } }))
vi.mock('../crud-governance', () => ({
  crudGovernanceFor: () => ({ name: 'calendar', class: 'STANDARD' }),
  assertCrudRead: vi.fn(),
  assertCrudWrite: vi.fn(),
}))
vi.mock('../crud-low-role-guard', () => ({
  lowRoleModeFor: () => 'NONE',
  ownRowsScope: () => ({ condition: undefined }),
  resolveLowRoleScope: async () => ({ condition: undefined }),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: (...args: unknown[]) => { m.steps.push('audit'); return m.audit(...args) },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_scope: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    const tx: Record<string, unknown> = {}
    tx.transaction = (fn: (x: unknown) => Promise<unknown>) => { m.steps.push('transaction'); return fn(tx) }
    tx.select = () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            for: async () => { m.steps.push('lock'); return m.lockedRow ? [m.lockedRow] : [] },
          }),
        }),
      }),
    })
    tx.update = () => ({
      set: (values: unknown) => ({
        where: () => ({
          returning: async () => { m.steps.push('update'); m.update(values); return [{ id: 'cal-1' }] },
        }),
      }),
    })
    tx.delete = () => ({
      where: () => ({
        returning: async () => { m.steps.push('delete'); m.remove(); return [{ id: 'cal-1' }] },
      }),
    })
    return callback(tx)
  },
}))

const org = '11111111-1111-4111-8111-111111111111'
const user = 'steward-attacker'
const personal = pgTable('calendars', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  ownerId: text('owner_id'),
  isPersonal: boolean('is_personal'),
  title: text('title'),
})
const withStatus = pgTable('shared_calendars', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  ownerId: text('owner_id'),
  isPersonal: boolean('is_personal'),
  status: text('status'),
  updatedAt: timestamp('updated_at'),
})
const context = (body: Record<string, unknown> = { title: 'tampered' }) => ({
  params: { id: 'cal-1' }, organizationId: org, userId: user, body,
})
const auth = async (row: Record<string, unknown>, ctx: { userId?: string | null }) => {
  m.steps.push('authorize')
  return row.isPersonal && row.ownerId !== ctx.userId
    ? { ok: false as const, status: 403 as const }
    : { ok: true as const }
}
async function mount(table: PgTable = personal) {
  const { crudRoutes } = await import('../crud-factory')
  crudRoutes({ table, tags: ['Scheduling'], orgScoped: true, itemRoute: true,
    writeRole: 'steward', lockedAuthCheck: auth })
}
const handler = (name: 'Update' | 'Delete') => {
  const fn = m.handlers.get(name)
  if (!fn) throw new Error(`missing ${name} handler`)
  return fn
}

describe('R-52: lockedAuthCheck is mandatory for all generic writes', () => {
  beforeEach(() => {
    m.handlers.clear()
    m.steps.length = 0
    m.lockedRow = { id: 'cal-1', isPersonal: true, ownerId: 'victim-member' }
    m.audit.mockReset().mockResolvedValue(undefined)
    m.update.mockReset()
    m.remove.mockReset()
  })

  it('PATCH without beforeUpdate or mergeJsonColumns denies a foreign personal calendar before any write or audit', async () => {
    await mount()
    await expect(handler('Update')(context())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.steps).toEqual(['transaction', 'lock', 'authorize'])
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('DELETE without a status column denies a foreign personal calendar before delete or audit', async () => {
    await mount()
    await expect(handler('Delete')(context())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.steps).toEqual(['transaction', 'lock', 'authorize'])
    expect(m.remove).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('DELETE with a status column denies a foreign personal calendar before soft deletion', async () => {
    await mount(withStatus)
    await expect(handler('Delete')(context())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.update).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('PATCH allows the owner and audits only after locked authorization and update', async () => {
    m.lockedRow = { id: 'cal-1', isPersonal: true, ownerId: user }
    await mount()
    await handler('Update')(context())
    expect(m.steps).toEqual(['transaction', 'lock', 'authorize', 'update', 'audit'])
    expect(m.update).toHaveBeenCalledOnce()
    expect(m.audit).toHaveBeenCalledOnce()
  })

  it('DELETE allows the owner and audits only after a locked hard deletion', async () => {
    m.lockedRow = { id: 'cal-1', isPersonal: true, ownerId: user }
    await mount()
    await handler('Delete')(context())
    expect(m.steps).toEqual(['transaction', 'lock', 'authorize', 'delete', 'audit'])
    expect(m.remove).toHaveBeenCalledOnce()
  })

  it('DELETE allows a shared calendar and audits only after a locked soft deletion', async () => {
    m.lockedRow = { id: 'cal-1', isPersonal: false, ownerId: 'another-member' }
    await mount(withStatus)
    await handler('Delete')(context())
    expect(m.steps).toEqual(['transaction', 'lock', 'authorize', 'update', 'audit'])
    expect(m.update).toHaveBeenCalledOnce()
  })

  it('cannot mutate when the scoped row does not exist', async () => {
    m.lockedRow = null
    await mount()
    await expect(handler('Update')(context())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(handler('Delete')(context())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.update).not.toHaveBeenCalled()
    expect(m.remove).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
})
