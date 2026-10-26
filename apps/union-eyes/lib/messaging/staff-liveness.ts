import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { caseActionAllowed, casePolicyRole } from '@/lib/cases/case-permissions'

/**
 * Whether the person acting on a conversation as STAFF still holds a live, active, eligible membership right now, read
 * inside the caller's own transaction. A revoked, expired, suspended or removed membership therefore ends access to the
 * conversations and the triage queue at once, instead of surviving until a session or a cached actor lapses.
 *
 * This is the same eligibility the assignment path applies to a new assignee (lib/cases/case-authorization:
 * caseAssigneeEligible), applied to the actor. It is evaluated per request, never cached, and fails closed: an
 * unreadable membership or an unknown role is "not live".
 */
export async function staffMembershipLive(tx: RLSTx, actor: { userId: string; organizationId: string }): Promise<boolean> {
  const result = await (currentStateContextEnabled()
    ? tx.execute(sql`SELECT public.ue_case_assignee_authorized(${actor.userId},${actor.organizationId}::uuid) AS allowed`)
    : tx.execute(sql`SELECT role FROM public.organization_members
        WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
          AND status='active' AND deleted_at IS NULL LIMIT 1`))
  const rows = (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>
  if (currentStateContextEnabled()) return rows[0]?.allowed === true
  const role = typeof rows[0]?.role === 'string' ? casePolicyRole(rows[0].role) : null
  return !!role && caseActionAllowed('note_add_internal', role)
}
