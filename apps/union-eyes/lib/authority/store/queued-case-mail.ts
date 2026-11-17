/** A sealed queue envelope carries an opaque database-issued capability, never a substituted human session. */
import { decide } from '../kernel'
import { capacitiesForRole } from '../capacity'
import type { AuthorityFacts, CaseFacts } from '../ontology'
import { auditAuthorityMutation } from './audit'
import { mapMandate, mapRecusal, mapRelationship } from './facts'
import { AuthorityStoreError, isPrincipalId, isUuid, type SqlExecutor } from './executor'

interface Context extends Record<string, unknown> {
  unlinked?: boolean
  organizationId: string
  userId: string
  caseId?: string
  membershipRole?: string
  relationships?: Record<string, unknown>[]
  mandates?: Record<string, unknown>[]
  recusals?: Record<string, unknown>[]
  resource?: CaseFacts
  checkedAt?: string
  action?: 'case:transition' | 'case:disclose_to_member'
  recipientEmail?: string | null
}

function contextAllowed(value: unknown): value is Context {
  if (!value || typeof value !== 'object') return false
  const context = value as Context
  const checkedAt = new Date(context.checkedAt ?? '')
  if (!Number.isFinite(checkedAt.getTime())) return false
  if (!isUuid(context.organizationId) || !isPrincipalId(context.userId)) return false
  // Unlinked institutional correspondence has already been checked against its own independent approval/signature
  // contract in the bounded database loader. It confers no case action.
  if (context.unlinked === true) return true
  if (!isUuid(context.caseId) || !['case:transition','case:disclose_to_member'].includes(context.action ?? '') || !context.resource) return false
  const facts: AuthorityFacts = {
    principal: { userId: context.userId, authenticated: true },
    memberships: [{ userId: context.userId, organizationId: context.organizationId, status: 'active',
      capacities: [...capacitiesForRole(context.membershipRole)] }],
    relationships: (context.relationships ?? []).map(mapRelationship),
    mandates: (context.mandates ?? []).map(mapMandate),
    recusals: (context.recusals ?? []).map(mapRecusal), delegations: [], consents: [],
  }
  return decide({ principalUserId: context.userId, organizationId: context.organizationId,
    resource: { type: 'case', id: context.caseId, organizationId: context.organizationId },
    action: context.action! }, facts, context.resource, checkedAt).effect === 'allow'
}

/** Must run after inserting the intent and before final sealing, in the SAME authenticated tenant transaction. */
export async function issueQueuedCaseMailCapability(exec: SqlExecutor, input: { queueId: string }): Promise<string> {
  if (!isUuid(input.queueId)) throw new AuthorityStoreError('INVALID_CONTEXT', 'invalid mail queue id')
  const result = (await exec.query<{ issued: { capability: string; context: Context } }>(
    'SELECT public.ue_issue_queued_case_mail($1::uuid) AS issued', [input.queueId],
  )).rows[0]?.issued
  if (!result || !/^[a-f0-9]{64}$/.test(result.capability) || !contextAllowed(result.context)) {
    throw new AuthorityStoreError('DENIED', 'queued mail authority denied')
  }
  await auditAuthorityMutation(exec, { organizationId: result.context.organizationId, action: 'machine_intent.issue',
    resourceType: 'ue_authority_requests', resourceId: input.queueId, details: { queueId: input.queueId,
      purpose: 'bounded-case-mail', caseId: result.context.caseId ?? null } })
  return result.capability
}

/** Only the system role may invoke the SQL verifier. The token cannot be rebound to another queue, actor or resource. */
export async function queuedCaseMailContext(exec: SqlExecutor, input: { queueId: string; capability: string }): Promise<{ allowed: boolean; recipientEmail: string | null }> {
  if (!isUuid(input.queueId) || !/^[a-f0-9]{64}$/.test(input.capability)) return { allowed: false, recipientEmail: null }
  try {
    const context = (await exec.query<{ context: unknown }>(
      'SELECT public.ue_queued_case_mail_context($1::uuid,$2::text) AS context', [input.queueId, input.capability],
    )).rows[0]?.context
    if (!contextAllowed(context)) return { allowed: false, recipientEmail: null }
    return { allowed: true, recipientEmail: typeof context.recipientEmail === 'string' ? context.recipientEmail : null }
  } catch {
    // An unreadable authority source is a retryable outage, never a fictional revocation or network admission.
    throw new AuthorityStoreError('PRECONDITION', 'queued mail authority verification is unavailable')
  }
}
