import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { withSystemContext } from '@/lib/db/with-rls-context'

/**
 * Audit of an organization selection: who chose which organization to work in, and on what authority.
 *
 * The session store (or a preference cookie) cannot commit with an application audit row, so the record is written FIRST and a failure
 * refuses the selection: no session is rebound to, and no organization is returned for, a choice that left no trail. It is written
 * under the system role because the actor may not yet be bound to the organization they are selecting, and it is attributed to that
 * organization and to the actor.
 */
export type OrganizationSelectionAuthority = 'membership' | 'platform_administrator'

export async function recordOrganizationSelection(input: {
  organizationId: string
  userId: string
  authority: OrganizationSelectionAuthority
  mode: 'canonical_session' | 'canonical_preference' | 'legacy'
}): Promise<void> {
  await withSystemContext(async (tx) => {
    await persistAtomicAudit(tx as never, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'organization.select',
      resourceType: 'organizations',
      resourceId: input.organizationId,
      details: { authority: input.authority, mode: input.mode },
    })
  })
}
