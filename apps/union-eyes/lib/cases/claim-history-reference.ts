import { sql, type SQL } from 'drizzle-orm'

/**
 * Case history rows reference the claim's internal primary key (the Django physical foreign key), never its public
 * claim_id. The lookup stays inside the caller's row-level security, and it does not depend on the bootstrap mode: the
 * legacy mode (UE_CANONICAL_BOOTSTRAP_V2=0, used by the e2e runtime) writes to the same physical schema.
 */
export function claimHistoryReference(publicClaimId: string): SQL {
  return sql`(SELECT id FROM public.claims WHERE claim_id = ${publicClaimId}::uuid LIMIT 1)`
}

/** Preserve the public case-ID contract in API results. */
export function publicClaimHistory<T extends { claimId: string }>(row: T, publicClaimId: string): T {
  return { ...row, claimId: publicClaimId }
}
