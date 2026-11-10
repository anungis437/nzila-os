import { ApiError } from '@/lib/api/errors'
import { assessMandate } from '@/lib/authority/common'
import type { Mandate } from '@/lib/authority/ontology'
import { loadHolderMandates } from '@/lib/authority/store/facts'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import type { RLSTx } from '@/lib/db/with-rls-context'

export const EQUITY_DISCLOSURE_GRANT_POWER = 'equity:disclosure:grant'

export function decideEquityDisclosureGrantAuthority(
  mandates: readonly Mandate[],
  input: { organizationId: string; userId: string },
  now: Date,
): { mandateId: string } | null {
  const mandate = mandates.find((candidate) => {
    if (candidate.kind !== 'governance_review') return false
    if (candidate.principalUserId !== input.userId) return false
    if (!candidate.powers.includes(EQUITY_DISCLOSURE_GRANT_POWER)) return false
    if (!(candidate.scope.resourceIds ?? []).includes(input.organizationId)) return false
    return assessMandate(candidate, input.organizationId, now).effective
  })
  return mandate ? { mandateId: mandate.id } : null
}

/**
 * Creating or revoking access to voluntary self-identification aggregates is an
 * institutional privacy decision. An administrator role is only an eligibility
 * floor: the actor must also hold a live governance-review mandate that names
 * the organization and this exact power.
 */
export async function requireEquityDisclosureGrantAuthority(
  tx: RLSTx,
  input: { organizationId: string; userId: string },
): Promise<{ mandateId: string }> {
  const now = new Date()
  const mandates = await loadHolderMandates(drizzleExecutor(tx), input.organizationId, input.userId)
  const decision = decideEquityDisclosureGrantAuthority(mandates, input, now)
  if (!decision) {
    throw ApiError.forbidden('A live organization-scoped equity disclosure mandate is required')
  }
  return decision
}
