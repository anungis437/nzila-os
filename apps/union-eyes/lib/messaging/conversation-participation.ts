import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { decide } from '@/lib/authority/kernel'
import { capacitiesForRole } from '@/lib/authority/capacity'
import type { AuthorityFacts, Membership, Recusal } from '@/lib/authority/ontology'
import { conversationAssigneeAttested, readOrganizationMembership, type StoredMembership } from '@/lib/messaging/staff-liveness'

/**
 * Conversation participation facts for decide().
 *
 * The thread row is the relationship: member_id is the subject, staff_id is the assignee.
 * This loader does not invent a mandate or a ue_authority_resource_relationships row.
 * A missing organization_members row synthesizes an active member capacity only for the
 * conversation's own member, so an owner is not required to hold a staff membership.
 * A row that exists and is not live is passed through, and the kernel denies it.
 *
 * Canonical V2 does not read the compatibility projection. The predicate attests assignee
 * eligibility as a boolean. The attested capacity set is member plus steward, which is the
 * minimum every conversation-assignee role carries, and it is not a governance or finance capacity.
 * An owner who is not attested still receives the synthetic member capacity. An inactive canonical
 * membership therefore does not yet revoke the conversation owner; it does revoke the assignee.
 */
export interface ConversationRow {
  id: string
  organizationId: string
  memberId: string
  staffId: string | null
  status: string
}

export interface ParticipationContext {
  actor: { userId: string; organizationId: string }
  stored: StoredMembership | null
  /** Null on the legacy lineage. True only when the canonical predicate attests assignee eligibility. */
  v2Attested: boolean | null
  recusals: Recusal[]
  /** The recusal table exists and this role cannot read it. Participation is denied. */
  recusalUnreadable: boolean
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>
}

async function loadRecusals(
  tx: RLSTx,
  actor: { userId: string; organizationId: string },
): Promise<{ recusals: Recusal[]; unreadable: boolean }> {
  const probe = rowsOf(await tx.execute(sql`SELECT to_regclass('public.ue_authority_recusals')::text AS rel`))
  if (!probe[0]?.rel) return { recusals: [], unreadable: false }
  const privilege = rowsOf(await tx.execute(sql`SELECT has_table_privilege(current_user, 'public.ue_authority_recusals', 'SELECT') AS readable`))
  if (privilege[0]?.readable !== true) return { recusals: [], unreadable: true }
  const loaded = rowsOf(await tx.execute(sql`SELECT id::text AS id, organization_id::text AS organization_id, principal_user_id,
      resource_id::text AS resource_id, reason, declared_at
    FROM public.ue_authority_recusals
    WHERE organization_id=${actor.organizationId}::uuid AND principal_user_id=${actor.userId}
      AND resource_type='message_thread' AND lifted_at IS NULL`))
  return {
    unreadable: false,
    recusals: loaded.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      principalUserId: String(row.principal_user_id),
      resource: { type: 'message_thread', id: String(row.resource_id), organizationId: String(row.organization_id) },
      reason: typeof row.reason === 'string' ? row.reason : 'recused',
      declaredAt: new Date(String(row.declared_at)),
      liftedAt: null,
      liftedBy: null,
    })),
  }
}

export async function loadParticipationContext(
  tx: RLSTx,
  actor: { userId: string; organizationId: string },
): Promise<ParticipationContext> {
  const recusal = await loadRecusals(tx, actor)
  if (currentStateContextEnabled()) {
    return {
      actor,
      stored: null,
      v2Attested: await conversationAssigneeAttested(tx, actor),
      recusals: recusal.recusals,
      recusalUnreadable: recusal.unreadable,
    }
  }
  return {
    actor,
    stored: await readOrganizationMembership(tx, actor),
    v2Attested: null,
    recusals: recusal.recusals,
    recusalUnreadable: recusal.unreadable,
  }
}

function membershipFor(ctx: ParticipationContext, isOwner: boolean): Membership | null {
  const base = { userId: ctx.actor.userId, organizationId: ctx.actor.organizationId }
  if (ctx.v2Attested === true) return { ...base, status: 'active', capacities: ['member', 'steward'] }
  if (ctx.v2Attested === false) return isOwner ? { ...base, status: 'active', capacities: ['member'] } : null
  if (ctx.stored?.live) return { ...base, status: 'active', capacities: [...capacitiesForRole(ctx.stored.role)] }
  if (ctx.stored) return { ...base, status: 'inactive', capacities: [] }
  return isOwner ? { ...base, status: 'active', capacities: ['member'] } : null
}

export function participationAllows(
  ctx: ParticipationContext,
  thread: ConversationRow,
  action: 'message:read' | 'message:reply' | 'message:close' | 'message:archive',
  now = new Date(),
): boolean {
  if (ctx.recusalUnreadable) return false
  if (thread.organizationId !== ctx.actor.organizationId) return false
  const isOwner = thread.memberId === ctx.actor.userId
  const membership = membershipFor(ctx, isOwner)
  const facts: AuthorityFacts = {
    principal: { userId: ctx.actor.userId, authenticated: true },
    memberships: membership ? [membership] : [],
    mandates: [],
    relationships: [],
    delegations: [],
    recusals: ctx.recusals,
    consents: [],
  }
  const decision = decide(
    {
      principalUserId: ctx.actor.userId,
      organizationId: ctx.actor.organizationId,
      action,
      resource: { type: 'message_thread', id: thread.id, organizationId: thread.organizationId },
    },
    facts,
    {
      kind: 'message_thread',
      id: thread.id,
      organizationId: thread.organizationId,
      memberUserId: thread.memberId,
      assigneeUserId: thread.staffId,
      status: thread.status === 'closed' ? 'closed' : 'open',
    },
    now,
  )
  return decision.effect === 'allow'
}
