import { and, desc, eq, gt, isNull, lte, sql, type SQL } from 'drizzle-orm'
import { triageDesignations } from '@/db/schema/messages-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { CONVERSATION_ASSIGNEE_ROLES } from '@/lib/authority/capacity'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Triage designations: the explicit, expiring, revocable authority to see and work the unassigned queue of one
 * scope. Seniority never confers it. A designation is granted by an organization administrator to an eligible staff
 * member, lasts at most 90 days, can be revoked, and exposes only the unassigned queue of its own scope.
 */
export type TriageScope = 'messages' | 'cases'

export interface TriageActor {
  userId: string
  organizationId: string
}

export const TRIAGE_MAX_DAYS = 90

export interface Designation {
  id: string
  scope: TriageScope
  userId: string
  grantedBy: string
  grantedAt: string
  expiresAt: string
  revokedAt: string | null
}

type Deps = {
  /** True only for a live, active staff member of the actor's organization (eligibility, not access). */
  assigneeEligible: (userId: string) => Promise<boolean>
  now?: () => Date
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)
const clock = (deps: { now?: () => Date }) => (deps.now ?? (() => new Date()))()

export const isTriageScope = (value: unknown): value is TriageScope => value === 'messages' || value === 'cases'

function live(actor: TriageActor, scope: TriageScope, userId: string, now: Date) {
  return and(
    eq(triageDesignations.organizationId, actor.organizationId),
    eq(triageDesignations.scope, scope),
    eq(triageDesignations.userId, userId),
    isNull(triageDesignations.revokedAt),
    gt(triageDesignations.expiresAt, now),
  )
}

export async function hasLiveDesignation(tx: RLSTx, actor: TriageActor, scope: TriageScope, now = new Date()): Promise<boolean> {
  const [row] = await tx.select({ id: triageDesignations.id }).from(triageDesignations).where(live(actor, scope, actor.userId, now)).limit(1)
  return Boolean(row)
}

/**
 * The designation holder must still hold a live conversation-assignee membership. A designation is a grant on top of
 * membership, never a substitute for it: a removed, suspended or demoted holder loses the queue at once, without
 * waiting for the designation to be revoked. An administrator title is not an assignee capacity. Canonical V2 asks
 * public.ue_conversation_assignee_authorized; the legacy lineage reads the compatibility projection with the same
 * stored roles.
 */
function membershipStillEligible(organizationId: SQL | string, userId: SQL | string): SQL {
  if (currentStateContextEnabled()) return sql`public.ue_conversation_assignee_authorized(${userId}, ${organizationId}::uuid) IS TRUE`
  return sql`EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = ${organizationId}::uuid AND om.user_id = ${userId}
      AND om.status = 'active' AND om.deleted_at IS NULL
      AND lower(om.role) IN (${sql.join(CONVERSATION_ASSIGNEE_ROLES.map((role) => sql`${role}`), sql`, `)})
  )`
}

/** The caller's live designation, as a predicate for use inside another query (no round trip, no rank). */
export function liveDesignationExists(actor: TriageActor, scope: TriageScope): SQL {
  return sql`EXISTS (
    SELECT 1 FROM triage_designations td
    WHERE td.organization_id = ${actor.organizationId}::uuid
      AND td.scope = ${scope}
      AND td.user_id = ${actor.userId}
      AND td.revoked_at IS NULL
      AND td.expires_at > now()
  ) AND ${membershipStillEligible(actor.organizationId, actor.userId)}`
}

/** Live designation holders of a scope, excluding one user. */
export async function liveDesignees(tx: RLSTx, organizationId: string, scope: TriageScope, exceptUserId: string, now = new Date()): Promise<string[]> {
  const rows = await tx
    .select({ userId: triageDesignations.userId })
    .from(triageDesignations)
    .where(
      and(
        eq(triageDesignations.organizationId, organizationId),
        eq(triageDesignations.scope, scope),
        isNull(triageDesignations.revokedAt),
        gt(triageDesignations.expiresAt, now),
        membershipStillEligible(organizationId, sql`${triageDesignations.userId}`),
      ),
    )
    .limit(50)
  return rows.map((r) => r.userId).filter((id) => id !== exceptUserId)
}

const toDesignation = (r: typeof triageDesignations.$inferSelect): Designation => ({
  id: r.id,
  scope: r.scope as TriageScope,
  userId: r.userId,
  grantedBy: r.grantedBy,
  grantedAt: iso(r.grantedAt)!,
  expiresAt: iso(r.expiresAt)!,
  revokedAt: iso(r.revokedAt),
})

export type GrantResult =
  | { kind: 'ok'; designation: Designation }
  | { kind: 'invalid_expiry' }
  | { kind: 'ineligible' }
  | { kind: 'self_grant' }
  | { kind: 'conflict' }

/** The caller must already be authorized to grant (an organization administrator); this records the decision. */
export async function grantDesignation(
  tx: RLSTx,
  actor: TriageActor,
  input: { scope: TriageScope; userId: string; expiresAt: Date },
  deps: Deps,
): Promise<GrantResult> {
  const now = clock(deps)
  const limit = new Date(now.getTime() + TRIAGE_MAX_DAYS * 86_400_000)
  if (!(input.expiresAt.getTime() > now.getTime()) || input.expiresAt.getTime() > limit.getTime()) return { kind: 'invalid_expiry' }
  if (input.userId === actor.userId) return { kind: 'self_grant' }
  if (!(await deps.assigneeEligible(input.userId))) return { kind: 'ineligible' }

  // A designation that has already lapsed must not block a fresh grant: record its end first.
  await tx
    .update(triageDesignations)
    .set({ revokedAt: now, revokedBy: 'system:expiry' })
    .where(
      and(
        eq(triageDesignations.organizationId, actor.organizationId),
        eq(triageDesignations.scope, input.scope),
        eq(triageDesignations.userId, input.userId),
        isNull(triageDesignations.revokedAt),
        lte(triageDesignations.expiresAt, now),
      ),
    )
  const [existing] = await tx.select({ id: triageDesignations.id }).from(triageDesignations).where(live(actor, input.scope, input.userId, now)).limit(1)
  if (existing) return { kind: 'conflict' }

  const [row] = await tx
    .insert(triageDesignations)
    .values({
      organizationId: actor.organizationId,
      scope: input.scope,
      userId: input.userId,
      grantedBy: actor.userId,
      grantedAt: now,
      expiresAt: input.expiresAt,
    })
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'triage.designation.grant',
    resourceType: 'triage_designations',
    resourceId: row.id,
    details: { scope: input.scope, designatedUserId: input.userId, expiresAt: input.expiresAt.toISOString() },
  })
  return { kind: 'ok', designation: toDesignation(row) }
}

export type RevokeResult = { kind: 'ok' } | { kind: 'not_found' }

export async function revokeDesignation(tx: RLSTx, actor: TriageActor, designationId: string, deps: Pick<Deps, 'now'> = {}): Promise<RevokeResult> {
  const now = clock(deps)
  if (!UUID.test(designationId)) return { kind: 'not_found' }
  const [row] = await tx
    .update(triageDesignations)
    .set({ revokedAt: now, revokedBy: actor.userId })
    .where(and(eq(triageDesignations.id, designationId), eq(triageDesignations.organizationId, actor.organizationId), isNull(triageDesignations.revokedAt)))
    .returning()
  if (!row) return { kind: 'not_found' }
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'triage.designation.revoke',
    resourceType: 'triage_designations',
    resourceId: row.id,
    details: { scope: row.scope, designatedUserId: row.userId },
  })
  return { kind: 'ok' }
}

export async function listDesignations(tx: RLSTx, actor: TriageActor): Promise<Designation[]> {
  const rows = await tx
    .select()
    .from(triageDesignations)
    .where(eq(triageDesignations.organizationId, actor.organizationId))
    .orderBy(desc(triageDesignations.grantedAt))
    .limit(200)
  return rows.map(toDesignation)
}
