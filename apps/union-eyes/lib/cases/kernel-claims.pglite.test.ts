/**
 * Claims (the case model behind /api/cases and /api/claims) decided by the authority kernel, end to end on PGlite with
 * the real kernel storage, the real loader and the real `findReadableCase`. `withRLSContext` is replaced by a
 * transaction binding the acting principal and organization as the application does. Not a staging pass.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ORG_B, seedMembership, U } from '../../db/__tests__/authority-kernel-harness'
import { freshDb, kit, minutesAgo } from '../../db/__tests__/authority-kernel-testkit'
import { assignCase, declareOwnRecusal, reassignCase, revokeCaseAssignment } from '../authority/store/lifecycle'
import { TRIAGE_DESIGNATIONS_DDL, designate } from '@/lib/triage/__tests__/fixture'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { readTransitionHistory } from './transition-history'
import { claimDetailQuery } from './claim-detail-query'
import { randomUUID } from 'node:crypto'

const m = vi.hoisted(() => ({ audit: vi.fn(), v2: { on: true } }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: vi.fn() }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn(), getUserRoleInOrganization: vi.fn() }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.audit, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => m.v2.on }))

import { CONVERSATION_ASSIGNEE_ROLES } from '@/lib/authority/capacity'
import { caseReadScope, caseTriageQueueScope, findReadableCase, type CaseActor } from './case-authorization'

let pg: PGlite
let k: ReturnType<typeof kit>
const OWN = newUuid()
const UNASSIGNED = newUuid()
const ASSIGNED = newUuid()
const FOREIGN = newUuid()
const NEW_STEWARD = 'user_steward_claims'
const actorOf = (userId: string, organizationId = ORG): CaseActor => ({ userId, organizationId, role: 'member' })

/** One transaction as `userId`, the way withRLSContext binds it. */
async function as<T>(userId: string, fn: (tx: RLSTx) => Promise<T>, org = ORG): Promise<T> {
  await pg.exec('BEGIN')
  try {
    await pg.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [org, userId])
    const out = await fn(drizzle(pg) as unknown as RLSTx)
    await pg.exec('COMMIT')
    return out
  } catch (error) {
    await pg.exec('ROLLBACK')
    throw error
  }
}

const find = (who: string, id: string, action?: Parameters<typeof findReadableCase>[4], org = ORG) =>
  as(who, (tx) => findReadableCase(tx, actorOf(who, org), id, false, action), org)

const assign = (issuer: string, assignee: string, id: string) =>
  k.as(issuer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: issuer, caseId: id, assigneeUserId: assignee, permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'], effectiveAt: minutesAgo() }))

beforeAll(async () => {
  pg = await freshDb()
  k = kit(pg)
  await k.asAdmin(async () => {
    await pg.exec(TRIAGE_DESIGNATIONS_DDL)
    await pg.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON triage_designations TO union_eyes_runtime')
    await seedMembership(pg, NEW_STEWARD, ORG, 'steward')
    await pg.exec(`
      CREATE TABLE public.grievance_transitions (
        id uuid PRIMARY KEY, organization_id uuid NOT NULL, claim_id uuid NOT NULL, from_stage_id uuid, to_stage_id uuid NOT NULL,
        reason text, notes text, transitioned_by text, transitioned_at timestamptz DEFAULT now(), visibility_scope text NOT NULL DEFAULT 'staff');
      CREATE TABLE public.organization_members (user_id text, organization_id uuid, name text, email text, phone text, role text, status text, deleted_at timestamptz);
      GRANT SELECT ON public.grievance_transitions, public.organization_members TO union_eyes_runtime;
      INSERT INTO public.organization_members (user_id, organization_id, role, status) VALUES ('${NEW_STEWARD}', '${ORG}', 'steward', 'active');
      -- TEST DOUBLE of the Canonical V2 predicate (db/auth/case-assignee-predicate.ts is not installed on PGlite): it
      -- answers from the same compatibility projection so both membership paths can be exercised here.
      CREATE FUNCTION public.ue_case_assignee_authorized(u text, o uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$
        SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = u AND m.organization_id = o
          AND m.status = 'active' AND m.deleted_at IS NULL AND m.role IN ('steward', 'chief_steward', 'officer', 'admin')) $f$;
      -- TEST DOUBLE of public.ue_conversation_assignee_authorized. Designation liveness asks this
      -- predicate, not the case-assignee predicate. Administrator is absent.
      CREATE FUNCTION public.ue_conversation_assignee_authorized(u text, o uuid) RETURNS boolean LANGUAGE sql STABLE AS $f$
        SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = u AND m.organization_id = o
          AND m.status = 'active' AND m.deleted_at IS NULL AND lower(m.role) IN (${CONVERSATION_ASSIGNEE_ROLES.map((role) => `'${role}'`).join(',')})) $f$;`)
    await pg.query(
      `INSERT INTO public.claims (claim_id, claim_number, organization_id, member_id) VALUES
         ($1,'CASE-own',$5,$6), ($2,'CASE-unassigned',$5,'someone_else'), ($3,'CASE-assigned',$5,'someone_else'), ($4,'CASE-foreign',$7,$6)`,
      [OWN, UNASSIGNED, ASSIGNED, FOREIGN, ORG, U.member, ORG_B],
    )
    for (const [claim, org] of [[OWN, ORG], [UNASSIGNED, ORG], [ASSIGNED, ORG], [FOREIGN, ORG_B]] as const) {
      await pg.query(
        `INSERT INTO public.grievance_transitions (id, organization_id, claim_id, to_stage_id, notes, transitioned_by, visibility_scope)
         VALUES ($1,$2,$3,$4,'visible to the member','steward-secret-id','member'), ($5,$2,$3,$4,'STAFF-ONLY-STRATEGY','steward-secret-id','staff'), ($6,$2,$3,$4,'unmarked','steward-secret-id','staff')`,
        [randomUUID(), org, claim, randomUUID(), randomUUID(), randomUUID()],
      )
    }
  })
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [UNASSIGNED, ASSIGNED, OWN] } })
  await assign(U.officer, U.steward, ASSIGNED)
})
afterAll(async () => { await pg?.close() })
beforeEach(() => m.audit.mockClear())

describe('the member who filed a claim', () => {
  it('reads their own claim as the member view, and a missing or foreign claim is indistinguishable (null)', async () => {
    expect(await find(U.member, OWN)).toMatchObject({ claimId: OWN, visibility: 'member_visible' })
    expect(await find(U.member, 'CASE-own')).toMatchObject({ claimId: OWN })
    expect(await find(U.member, UNASSIGNED)).toBeNull()
    expect(await find(U.member, FOREIGN)).toBeNull()
    expect(await find(U.member, newUuid())).toBeNull()
  })

  it('may comment but not work the case: a refused action on a readable case is a recorded 403, not a 404', async () => {
    expect(await find(U.member, OWN, 'case:comment')).toMatchObject({ claimId: OWN })
    for (const action of ['case:write_notes', 'case:transition', 'case:upload_evidence', 'case:export_sealed_evidence', 'case:close', 'case:assign'] as const) {
      m.audit.mockClear()
      await expect(find(U.member, OWN, action), action).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(m.audit).toHaveBeenCalledTimes(1)
    }
  })
})

describe('rank and the legacy assigned_to mirror grant nothing', () => {
  it('no officer, president, chief steward or unrelated steward reads an unassigned claim', async () => {
    for (const who of [U.president, U.vp, U.chief, U.treasurer, NEW_STEWARD]) {
      expect(await find(who, UNASSIGNED), who).toBeNull()
    }
  })

  it('a person named only in claims.assigned_to holds no authority', async () => {
    await k.asAdmin(() => pg.query(`UPDATE public.claims SET assigned_to = $2 WHERE claim_id = $1`, [UNASSIGNED, NEW_STEWARD]))
    expect(await find(NEW_STEWARD, UNASSIGNED)).toBeNull()
    await k.asAdmin(() => pg.query(`UPDATE public.claims SET assigned_to = NULL WHERE claim_id = $1`, [UNASSIGNED]))
  })
})

describe('the governed assignment is the only way to work a claim', () => {
  it('the assigned representative works the claim with the internal view and primary-only powers', async () => {
    expect(await find(U.steward, ASSIGNED)).toMatchObject({ claimId: ASSIGNED, visibility: 'internal' })
    for (const action of ['case:read_internal', 'case:write_notes', 'case:transition', 'case:upload_evidence', 'case:modify_document', 'case:close', 'case:export_sealed_evidence'] as const) {
      expect(await find(U.steward, ASSIGNED, action), action).not.toBeNull()
    }
  })

  it('another steward of the same organization still reads nothing', async () => {
    expect(await find(NEW_STEWARD, ASSIGNED)).toBeNull()
    expect(await find(U.steward2, ASSIGNED)).toBeNull()
  })

  it('a supervisor with an assign-and-read mandate may assign but not work the claim', async () => {
    expect(await find(U.officer, UNASSIGNED, 'case:assign')).toMatchObject({ claimId: UNASSIGNED })
    await expect(find(U.officer, UNASSIGNED, 'case:write_notes')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(find(U.officer, UNASSIGNED, 'case:transition')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('reassignment moves the authority at once; revocation removes it; a recusal removes it', async () => {
    const target = newUuid()
    await k.asAdmin(() => pg.query(`INSERT INTO public.claims (claim_id, organization_id, member_id) VALUES ($1,$2,'someone_else')`, [target, ORG]))
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [target] } })
    await assign(U.officer, U.steward, target)
    expect(await find(U.steward, target, 'case:write_notes')).not.toBeNull()

    await k.as(U.officer)((t) => reassignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: target, outgoingUserId: U.steward, incomingUserId: NEW_STEWARD, effectiveAt: minutesAgo() }))
    expect(await find(U.steward, target)).toBeNull()
    expect(await find(NEW_STEWARD, target, 'case:write_notes')).not.toBeNull()

    await k.as(NEW_STEWARD)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: NEW_STEWARD, resourceType: 'case', resourceId: target, reason: 'conflict of interest' }))
    expect(await find(NEW_STEWARD, target)).toBeNull()

    const other = newUuid()
    await k.asAdmin(() => pg.query(`INSERT INTO public.claims (claim_id, organization_id, member_id) VALUES ($1,$2,'someone_else')`, [other, ORG]))
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [other] } })
    await assign(U.officer, U.steward, other)
    const live = (await k.as(U.officer)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_resource_relationships WHERE principal_user_id = $1 AND resource_id = $2 AND revoked_at IS NULL`, [U.steward, other]))).rows[0].id
    await k.as(U.officer)((t) => revokeCaseAssignment(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: other, relationshipId: live }))
    expect(await find(U.steward, other)).toBeNull()
  })
})

describe('tenant isolation', () => {
  it('an actor of another organization resolves nothing in this one, whatever the relationship', async () => {
    expect(await find(U.steward, ASSIGNED, 'case:read', ORG_B)).toBeNull()
    expect(await find(U.steward, FOREIGN, 'case:read', ORG)).toBeNull()
  })
})

const designateOnly = (over: { expiresInDays?: number; revoked?: boolean; scope?: 'messages' | 'cases' }) =>
  k.asAdmin(async () => {
    await pg.exec('TRUNCATE triage_designations')
    await designate(pg, { organizationId: ORG, scope: 'cases', userId: NEW_STEWARD, ...over })
  })

describe('list pre-filters narrow, and a triage designation exposes only the unassigned queue', () => {
  const ids = async (predicate: ReturnType<typeof sql>, who: string) =>
    (await as(who, (tx) => (tx as unknown as ReturnType<typeof drizzle>).execute(sql`SELECT c.claim_id FROM claims c WHERE ${predicate}`)) as unknown as { rows: Array<{ claim_id: string }> }).rows.map((r) => r.claim_id).sort()

  it('caseReadScope lists own claims and those with a live relationship, never the rest of the tenant', async () => {
    expect(await ids(caseReadScope(actorOf(U.member), 'c'), U.member)).toEqual([OWN])
    expect(await ids(caseReadScope(actorOf(U.steward), 'c'), U.steward)).toEqual([ASSIGNED].sort())
    expect(await ids(caseReadScope(actorOf(U.president), 'c'), U.president)).toEqual([])
  })

  it('a live cases designation lists unassigned claims in its own organization and widens no read', async () => {
    await designateOnly({})
    const queue = await ids(caseTriageQueueScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD)
    expect(queue).toContain(UNASSIGNED)
    expect(queue).not.toContain(ASSIGNED)
    expect(queue).not.toContain(FOREIGN)
    expect(await ids(caseReadScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD)).toEqual([])
    expect(await find(NEW_STEWARD, UNASSIGNED)).toBeNull()
  })

  it.each([
    ['an expired designation', { expiresInDays: -1 }],
    ['a revoked designation', { revoked: true }],
    ['a messages-scope designation', { scope: 'messages' as const }],
  ])('%s lists nothing', async (_name, over) => {
    await designateOnly(over)
    expect(await ids(caseTriageQueueScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD)).toEqual([])
  })

  it('no designation lists nothing', async () => {
    await k.asAdmin(() => pg.exec('TRUNCATE triage_designations'))
    expect(await ids(caseTriageQueueScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD)).toEqual([])
  })

  it.each([
    ['a removed member', `status = 'inactive'`],
    ['a suspended member', `status = 'suspended'`],
    ['a deleted membership', `deleted_at = now()`],
    ['a member demoted to ordinary membership', `role = 'member'`],
  ])('a live designation does not outlive membership: %s lists nothing, in both membership lineages', async (_name, change) => {
    await designateOnly({})
    for (const v2 of [true, false]) {
      m.v2.on = v2
      try {
        expect(await ids(caseTriageQueueScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD), `v2=${v2} before`).toContain(UNASSIGNED)
        await k.asAdmin(() => pg.exec(`UPDATE public.organization_members SET ${change} WHERE user_id = '${NEW_STEWARD}'`))
        expect(await ids(caseTriageQueueScope(actorOf(NEW_STEWARD), 'c'), NEW_STEWARD), `v2=${v2} after`).toEqual([])
      } finally {
        m.v2.on = true
        await k.asAdmin(() => pg.exec(`UPDATE public.organization_members SET status = 'active', role = 'steward', deleted_at = NULL WHERE user_id = '${NEW_STEWARD}'`))
      }
    }
  })
})


describe('case history, which has no row-level security of its own, follows the kernel decision', () => {
  const history = (who: string, id: string, org = ORG) => as(who, (tx) => readTransitionHistory(tx, actorOf(who, org), id), org)

  it('shows the member only member-visible transitions of their own case, and nothing staff-side', async () => {
    const rows = await history(U.member, OWN)
    expect(rows).toHaveLength(1)
    const text = JSON.stringify(rows)
    expect(text).not.toContain('STAFF-ONLY-STRATEGY')
    expect(text).not.toContain('steward-secret-id')
  })

  it('shows the assigned representative the internal view, and everyone else not found', async () => {
    expect(await history(U.steward, ASSIGNED)).toHaveLength(3)
    for (const [who, id] of [[U.member, ASSIGNED], [NEW_STEWARD, ASSIGNED], [U.president, UNASSIGNED], [U.steward, FOREIGN]] as const) {
      await expect(history(who, id), who).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
  })

  it('a triage designation exposes no history', async () => {
    await designateOnly({})
    await expect(history(NEW_STEWARD, UNASSIGNED)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('the claim detail projection is tenant-bound and takes the exact, already-decided id', () => {
  const detail = async (who: string, reference: string, org = ORG) =>
    (await as(who, (tx) => (tx as unknown as ReturnType<typeof drizzle>).execute(claimDetailQuery(actorOf(who, org), reference)), org) as unknown as { rows: Array<Record<string, unknown>> }).rows

  it('returns the case by claim id in its own organization only', async () => {
    expect((await detail(U.steward, ASSIGNED))[0]?.claimId).toBe(ASSIGNED)
    expect(await detail(U.steward, ASSIGNED, ORG_B)).toEqual([])
    expect(await detail(U.steward, FOREIGN)).toEqual([])
    expect(await detail(U.steward, 'CASE-assigned')).toEqual([])
    expect(await detail(U.steward, '')).toEqual([])
  })
})
