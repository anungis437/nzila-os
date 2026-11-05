import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'

/**
 * Audit of an organization selection: who chose which organization to work in, and on what authority.
 *
 * The session store (or a preference cookie) cannot commit with an application audit row, so the record is written FIRST and a failure
 * refuses the selection: no session is rebound to, and no organization is returned for, a choice that left no trail. It is written
 * under the system role because the actor may not yet be bound to the organization they are selecting, and it is attributed to that
 * organization and to the actor. The organization the actor was working in before is recorded with it, when the server knows it.
 *
 * The session rebind is the effect, and it lives in the session store, so the contract is the durable two-phase one: the intent above,
 * then the outcome (recordOrganizationSelectionOutcome) once the rebind has happened or failed. An intent with no outcome is a selection
 * that did not complete.
 */
export type OrganizationSelectionAuthority = 'membership' | 'platform_administrator'

export async function recordOrganizationSelection(input: {
  organizationId: string
  userId: string
  authority: OrganizationSelectionAuthority
  mode: 'canonical_session' | 'canonical_preference' | 'legacy'
  /** The organization the session or provider was bound to before this choice; null when none or not known to the server. */
  previousOrganizationId?: string | null
}): Promise<void> {
  await withSystemContext(async (tx) => {
    await persistAtomicAudit(tx as never, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'organization.select',
      resourceType: 'organizations',
      resourceId: input.organizationId,
      details: { authority: input.authority, mode: input.mode, fromOrganizationId: input.previousOrganizationId ?? null },
    })
  })
}

/**
 * Records that a selection took effect or failed. The effect already happened (or not) in the session store, so a failure to write
 * this record cannot undo it: it is logged loudly and the selection's intent record remains the durable trail.
 */
export async function recordOrganizationSelectionOutcome(input: {
  organizationId: string
  userId: string
  outcome: 'applied' | 'failed'
  mode: 'canonical_session' | 'canonical_preference'
  previousOrganizationId?: string | null
}): Promise<boolean> {
  try {
    await withSystemContext(async (tx) => {
      await persistAtomicAudit(tx as never, {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.outcome === 'applied' ? 'organization.selected' : 'organization.select_failed',
        resourceType: 'organizations',
        resourceId: input.organizationId,
        details: { mode: input.mode, fromOrganizationId: input.previousOrganizationId ?? null },
      })
    })
    return true
  } catch (error) {
    logger.error('organization_selection_outcome_not_recorded', { organizationId: input.organizationId, outcome: input.outcome, error })
    return false
  }
}
