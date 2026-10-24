/**
 * Case access on the authority kernel, end to end on PGlite with the real kernel storage and the real service.
 * `withRLSContext` is replaced by a transaction that binds the acting principal and organization exactly as the
 * application's context does; everything else (decisions, governed assignment, audit chain) is the production code.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ORG_B, seedMembership, U } from '../../db/__tests__/authority-kernel-harness'
import { freshDb, kit, minutesAgo, daysAhead } from '../../db/__tests__/authority-kernel-testkit'
import { assignCase } from '../authority/store/lifecycle'

const ctx = vi.hoisted(() => ({ pg: undefined as unknown, user: 'none' }))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, fn: (tx: unknown) => Promise<unknown>) => {
    const pg = ctx.pg as PGlite
    await pg.exec('BEGIN')
    try {
      await pg.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [context.organizationId, ctx.user])
      const result = await fn(drizzle(pg))
      await pg.exec('COMMIT')
      return result
    } catch (error) {
      await pg.exec('ROLLBACK')
      throw error
    }
  },
}))

import {
  getEffectiveCaseAccess,
  grantCaseAccessGuarded,
  listCaseCollaborators,
  revokeCaseAccessGuarded,
} from './case-access-service'

let pg: PGlite
let k: ReturnType<typeof kit>
const CASE = newUuid()
const OTHER_CASE = newUuid()

const as = <T>(user: string, fn: () => Promise<T>) => {
  ctx.user = user
  return fn()
}
const access = (user: string, id = CASE, org = ORG) => as(user, () => getEffectiveCaseAccess({ organizationId: org, grievanceId: id, userId: user }))
const live = () => pg.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_resource_relationships WHERE revoked_at IS NULL`).then((r) => Number(r.rows[0].n))

beforeAll(async () => {
  pg = await freshDb()
  ctx.pg = pg
  k = kit(pg)
  await k.asAdmin(async () => {
    await seedMembership(pg, 'user_steward_c', ORG, 'steward')
    await pg.query(`INSERT INTO public.grievances (id, organization_id, created_by, union_rep_id) VALUES ($1,$2,$3,$4), ($5,$2,$3,NULL)`, [CASE, ORG, U.member, '00000000-0000-4000-8000-0000000000aa', OTHER_CASE])
  })
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE, OTHER_CASE] } })
  await k.as(U.officer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, assigneeUserId: U.steward, permissions: ['read', 'comment', 'write'], effectiveAt: minutesAgo() }))
})
afterAll(async () => { await pg?.close() })

describe('who reads and changes a case is decided by the kernel alone', () => {
  it('the explicitly assigned representative is the primary owner with owner-only powers', async () => {
    const a = await access(U.steward)
    expect(a).toMatchObject({ canViewCase: true, isPrimaryOwner: true, accessRole: 'primary_owner', canEditCaseNotes: true })
    expect(a.ownerOnly.canExportSealedEvidence).toBe(true)
  })

  it('rank and the legacy union_rep_id column grant nothing', async () => {
    for (const who of [U.president, U.vp, U.chief, U.treasurer, 'user_steward_c']) {
      expect((await access(who)).canViewCase, who).toBe(false)
    }
    // The legacy column on CASE names an arbitrary id; a person holding that id gets nothing.
    expect((await access('00000000-0000-4000-8000-0000000000aa')).canViewCase).toBe(false)
  })

  it('a supervisor reads only inside their mandate scope, and a member with no relationship reads nothing', async () => {
    expect((await access(U.member)).canViewCase).toBe(false)
    expect((await access(U.steward, OTHER_CASE)).canViewCase).toBe(false)
  })

  it('another organization cannot reach the case, even as a principal with a same-looking relationship', async () => {
    expect((await access(U.steward, CASE, ORG_B)).canViewCase).toBe(false)
  })

  it('fails closed when the case does not exist', async () => {
    expect((await access(U.steward, newUuid())).canViewCase).toBe(false)
  })
})

describe('collaborator grants are governed case assignments', () => {
  const grant = (issuer: string, grantee: string, over: Record<string, unknown> = {}) =>
    as(issuer, () => grantCaseAccessGuarded({ organizationId: ORG, grievanceId: CASE, userId: grantee, grantedBy: issuer, accessRole: 'reviewer', expiresAt: daysAhead(5), ...over }))

  it('seniority and primary ownership alone cannot grant: the issuer needs case:assign authority', async () => {
    const before = await live()
    for (const issuer of [U.steward, U.president, U.chief]) {
      expect(await grant(issuer, 'user_steward_c'), issuer).toMatchObject({ ok: false, status: 403, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' })
    }
    expect(await live()).toBe(before)
  })

  it('refuses the grantor as grantee, an ineligible grantee, and a primary owner', async () => {
    expect(await grant(U.officer, U.officer)).toMatchObject({ ok: false, code: 'SELF_GRANT_FORBIDDEN' })
    expect(await grant(U.officer, U.member)).toMatchObject({ ok: false, status: 400, code: 'GRANTEE_INELIGIBLE' })
    expect(await grant(U.officer, U.steward)).toMatchObject({ ok: false, code: 'PRIMARY_OWNER_GRANT_FORBIDDEN' })
  })

  it('refuses a case outside the organization and unbounded terms', async () => {
    expect(await as(U.officer, () => grantCaseAccessGuarded({ organizationId: ORG, grievanceId: newUuid(), userId: 'user_steward_c', grantedBy: U.officer, accessRole: 'reviewer', expiresAt: daysAhead(5) }))).toMatchObject({ ok: false, status: 404, code: 'CASE_NOT_FOUND' })
    expect(await grant(U.officer, 'user_steward_c', { expiresAt: null })).toMatchObject({ ok: false, code: 'EXPIRY_REQUIRED' })
  })

  it('an authorized issuer grants a time-boxed collaborator, who then reads but does not own; revocation ends it at once', async () => {
    const granted = await grant(U.officer, 'user_steward_c')
    expect(granted).toMatchObject({ ok: true })
    if (!granted.ok) throw new Error('unreachable')
    const a = await access('user_steward_c')
    expect(a).toMatchObject({ canViewCase: true, isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'reviewer' })
    expect(a.ownerOnly.canExportSealedEvidence).toBe(false)
    const roster = await as(U.steward, () => import('@/lib/db/with-rls-context').then((m) => m.withRLSContext({ organizationId: ORG }, (tx) => listCaseCollaborators(tx as never, ORG, CASE))))
    expect(roster.map((r) => r.userId).sort()).toEqual([U.steward, 'user_steward_c'].sort())

    const revoked = await as(U.officer, () => revokeCaseAccessGuarded({ organizationId: ORG, grievanceId: CASE, assignmentId: granted.access.id, actorId: U.officer }))
    expect(revoked).toMatchObject({ ok: true })
    expect((await access('user_steward_c')).canViewCase).toBe(false)
  })

  it('every kernel mutation is audited in the canonical chain in the same transaction', async () => {
    const orphan = await k.asAdmin(() => pg.query<{ n: string }>(
      `SELECT count(*)::text n FROM ue_authority_events e WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE (a.details -> 'authorityEventIds') ? e.id::text)`,
    ))
    expect(orphan.rows[0].n).toBe('0')
  })
})
