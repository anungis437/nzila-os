import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { conversationAssigneeEligible } from '@/lib/authority/capacity'

/**
 * Whether the person acting on a conversation as staff still holds a live membership whose stored
 * role carries a conversation-assignee capacity (steward, chief steward, officer, or executive).
 * The caller's role label is not a fact. An organization-administrator title maps to the member
 * capacity only, so it is not staff participation. Unknown stored roles confer nothing.
 *
 * Legacy lineage reads organization_members inside the caller's transaction. Canonical V2 calls
 * public.ue_conversation_assignee_authorized. A missing function denies assignees. When the caller
 * is already in a transaction, the call sits in a savepoint so that denial does not abort the
 * member's own read.
 */
export interface StoredMembership {
  role: string
  live: boolean
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>
}

function errorChain(error: unknown): Array<{ code?: string; message?: string }> {
  const seen = new Set<unknown>()
  const chain: Array<{ code?: string; message?: string }> = []
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    chain.push(current as { code?: string; message?: string })
    current = (current as { cause?: unknown }).cause
  }
  return chain
}

const matches = (error: unknown, code: string, text: string) =>
  errorChain(error).some((item) => item.code === code || (item.message ?? '').toLowerCase().includes(text))

const isUndefinedFunction = (error: unknown) => matches(error, '42883', 'does not exist')
const isNoTransaction = (error: unknown) => matches(error, '25P01', 'transaction block')

export async function readOrganizationMembership(
  tx: RLSTx,
  actor: { userId: string; organizationId: string },
): Promise<StoredMembership | null> {
  const result = await tx.execute(sql`SELECT role, status, deleted_at FROM public.organization_members
    WHERE organization_id=${actor.organizationId}::uuid AND user_id=${actor.userId}
    ORDER BY (status='active' AND deleted_at IS NULL) DESC
    LIMIT 1`)
  const row = rowsOf(result)[0]
  if (!row || typeof row.role !== 'string') return null
  return { role: row.role, live: row.status === 'active' && (row.deleted_at === null || row.deleted_at === undefined) }
}

/** Canonical V2 attestation. False when the function is absent or the membership is not an assignee capacity. */
export async function conversationAssigneeAttested(
  tx: RLSTx,
  actor: { userId: string; organizationId: string },
): Promise<boolean> {
  let savepoint = false
  try {
    await tx.execute(sql`SAVEPOINT ue_conversation_assignee`)
    savepoint = true
  } catch (error) {
    if (!isNoTransaction(error)) throw error
  }
  try {
    const result = await tx.execute(sql`SELECT public.ue_conversation_assignee_authorized(${actor.userId},${actor.organizationId}::uuid) AS allowed`)
    if (savepoint) await tx.execute(sql`RELEASE SAVEPOINT ue_conversation_assignee`)
    return rowsOf(result)[0]?.allowed === true
  } catch (error) {
    if (savepoint) {
      await tx.execute(sql`ROLLBACK TO SAVEPOINT ue_conversation_assignee`)
      await tx.execute(sql`RELEASE SAVEPOINT ue_conversation_assignee`)
    }
    if (isUndefinedFunction(error)) return false
    throw error
  }
}

export async function staffMembershipLive(tx: RLSTx, actor: { userId: string; organizationId: string }): Promise<boolean> {
  if (currentStateContextEnabled()) return conversationAssigneeAttested(tx, actor)
  const stored = await readOrganizationMembership(tx, actor)
  return !!stored?.live && conversationAssigneeEligible(stored.role)
}
