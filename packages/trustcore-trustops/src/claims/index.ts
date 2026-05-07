import type { ProofOfClaimStatus } from '@nzila/trustcore-contracts'

/** Statuses considered "open" for SLA tracking + dashboard pending counts. */
export const OPEN_PROOF_OF_CLAIM_STATUSES: ReadonlySet<ProofOfClaimStatus> = new Set([
  'submitted',
  'under_review',
])

export function isOpenProofOfClaim(status: ProofOfClaimStatus): boolean {
  return OPEN_PROOF_OF_CLAIM_STATUSES.has(status)
}

export function isAdmittedProofOfClaim(status: ProofOfClaimStatus): boolean {
  return status === 'admitted' || status === 'partially_admitted'
}
