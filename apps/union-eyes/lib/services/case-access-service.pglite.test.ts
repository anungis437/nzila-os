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
import { insertRelationship } from '../authority/store/mutations'

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
  assignPrimaryRepresentative,
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
  await k.as(U.officer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, assigneeUserId: U.steward, permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'], effectiveAt: minutesAgo() }))
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

describe('capabilities are separate: no permission implies another', () => {
  const GCASE = newUuid()
  const decideCaseAction = (user: string, action: string, id = GCASE) =>
    as(user, () => import('@/lib/db/with-rls-context').then((m) => m.withRLSContext({ organizationId: ORG }, async (tx) => {
      const { decideCase } = await import('../authority/store/route-adapter')
      return (await decideCase(tx as never, { userId: user, organizationId: ORG, caseId: id, action: action as never })).effect
    })))
  const grantTo = (grantee: string, over: Record<string, unknown>) =>
    as(U.officer, () => grantCaseAccessGuarded({ organizationId: ORG, grievanceId: GCASE, userId: grantee, grantedBy: U.officer, accessRole: 'secondary_lro', expiresAt: daysAhead(5), ...over }))
  const UPLOADER = 'user_uploader_only'
  const EDITOR = 'user_all_editing'

  beforeAll(async () => {
    await k.asAdmin(async () => {
      await seedMembership(pg, UPLOADER, ORG, 'steward')
      await seedMembership(pg, EDITOR, ORG, 'steward')
      await pg.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [GCASE, ORG, U.member])
    })
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [GCASE] } })
    await k.as(U.officer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: GCASE, assigneeUserId: U.steward, permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'], effectiveAt: minutesAgo() }))
  })

  it('a grant that names only evidence upload allows exactly that', async () => {
    expect(await grantTo(UPLOADER, { canUploadDocuments: true })).toMatchObject({ ok: true })
    const a = await access(UPLOADER, GCASE)
    expect(a).toMatchObject({ canViewCase: true, canUploadDocuments: true, canEditCaseNotes: false, canDraftActions: false, canModifyDocuments: false, canViewPrivateDocuments: false })
    expect(await decideCaseAction(UPLOADER, 'case:upload_evidence')).toBe('allow')
    for (const action of ['case:write_notes', 'case:draft_action', 'case:modify_document', 'case:disclose_to_member', 'case:close', 'case:export_sealed_evidence', 'case:assign', 'case:read_third_party_restricted']) {
      expect(await decideCaseAction(UPLOADER, action), action).toBe('deny')
    }
  })

  it('even a collaborator holding every editing permission cannot disclose, close or export sealed evidence', async () => {
    expect(await grantTo(EDITOR, { canEditCaseNotes: true, canDraftActions: true, canUploadDocuments: true, canModifyDocuments: true, canViewPrivateDocuments: true })).toMatchObject({ ok: true })
    for (const action of ['case:write_notes', 'case:draft_action', 'case:upload_evidence', 'case:modify_document', 'case:read_third_party_restricted']) {
      expect(await decideCaseAction(EDITOR, action), action).toBe('allow')
    }
    for (const action of ['case:disclose_to_member', 'case:close', 'case:export_sealed_evidence', 'case:assign']) {
      expect(await decideCaseAction(EDITOR, action), action).toBe('deny')
    }
    const a = await access(EDITOR, GCASE)
    expect(a.canDiscloseToMember).toBe(false)
    expect(a.ownerOnly).toEqual({ canReassignPrimary: false, canCloseCase: false, canRemovePrimaryAccess: false, canExportSealedEvidence: false })
  })

  it('the primary representative holds the primary-only capabilities and the editing ones', async () => {
    for (const action of ['case:disclose_to_member', 'case:close', 'case:export_sealed_evidence', 'case:write_notes', 'case:modify_document']) {
      expect(await decideCaseAction(U.steward, action), action).toBe('allow')
    }
    expect((await access(U.steward, GCASE)).ownerOnly).toMatchObject({ canCloseCase: true, canExportSealedEvidence: true })
  })

  it('the retired generic write permission and the primary-only names cannot be stored on a collaborator grant', async () => {
    const rule = (await k.asAdmin(() => pg.query<{ id: string }>(`SELECT id::text id FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = 'case_assignment' AND operation = 'issue' AND status = 'active'`, [ORG]))).rows[0].id
    const store = (permissions: string[]) => k.as(U.officer)((t) => insertRelationship(t, { organizationId: ORG, principalUserId: 'user_steward_c', resourceType: 'case', resourceId: GCASE, relation: 'collaborator', permissions, origin: 'explicit', grantedBy: U.officer, issuanceRuleId: rule, effectiveAt: minutesAgo() }))
    for (const bad of [['read', 'write'], ['read', 'close'], ['read', 'disclose_to_member'], ['read', 'export_sealed_evidence']]) {
      await expect(store(bad), bad.join()).rejects.toThrow(/POWERS_EXCEED_RULE/)
    }
  })

  it('the service refuses to widen scope: an editing flag on a non-LRO role is rejected', async () => {
    expect(await grantTo('user_steward_c', { accessRole: 'reviewer', canModifyDocuments: true })).toMatchObject({ ok: false, code: 'SCOPE_EXCEEDS_ROLE' })
  })
})

describe('the primary representative is assigned through the kernel', () => {
  const NEW_CASE = newUuid()
  const assignAs = (issuer: string, assignee: string, id = NEW_CASE) =>
    as(issuer, () => import('@/lib/db/with-rls-context').then((m) => m.withRLSContext({ organizationId: ORG }, (tx) =>
      assignPrimaryRepresentative(tx as never, { organizationId: ORG, grievanceId: id, issuerUserId: issuer, assigneeUserId: assignee }))))

  beforeAll(async () => {
    await k.asAdmin(async () => {
      await pg.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [NEW_CASE, ORG, U.member])
    })
    await k.grantMandate('supervisory', U.chief, ['read', 'assign'], { scope: { resourceIds: [NEW_CASE] } })
  })

  it('refuses an officer who holds no case:assign authority, and writes nothing', async () => {
    const before = await live()
    await expect(assignAs(U.president, U.steward)).rejects.toThrow()
    expect(await live()).toBe(before)
    expect((await access(U.steward, NEW_CASE)).canViewCase).toBe(false)
  })

  it('refuses an assignee who is not an eligible representative', async () => {
    await expect(assignAs(U.chief, U.member)).rejects.toThrow()
    expect((await access(U.member, NEW_CASE)).isPrimaryOwner).toBe(false)
  })

  it('a first assignment makes the assignee the primary representative', async () => {
    expect(await assignAs(U.chief, U.steward)).toEqual({ previousUserId: null })
    expect(await access(U.steward, NEW_CASE)).toMatchObject({ canViewCase: true, isPrimaryOwner: true })
  })

  it('assigning the same person again changes nothing', async () => {
    const before = await live()
    expect(await assignAs(U.chief, U.steward)).toEqual({ previousUserId: U.steward })
    expect(await live()).toBe(before)
  })

  it('a reassignment ends the outgoing representative and starts the incoming one in one step', async () => {
    expect(await assignAs(U.chief, 'user_steward_c')).toEqual({ previousUserId: U.steward })
    expect((await access(U.steward, NEW_CASE)).canViewCase).toBe(false)
    expect(await access('user_steward_c', NEW_CASE)).toMatchObject({ canViewCase: true, isPrimaryOwner: true })
  })

  it('a refused reassignment leaves the current representative in place', async () => {
    await expect(assignAs(U.president, U.steward)).rejects.toThrow()
    expect((await access('user_steward_c', NEW_CASE)).isPrimaryOwner).toBe(true)
  })

  it('every assignment is audited in the canonical chain in the same transaction', async () => {
    const orphan = await k.asAdmin(() => pg.query<{ n: string }>(
      `SELECT count(*)::text n FROM ue_authority_events e WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE (a.details -> 'authorityEventIds') ? e.id::text)`,
    ))
    expect(orphan.rows[0].n).toBe('0')
  })
})
