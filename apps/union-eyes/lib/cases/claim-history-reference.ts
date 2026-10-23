import { sql, type SQL } from 'drizzle-orm'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'

/** Django history references the internal PK. Its parent lookup stays inside caller RLS. */
export function claimHistoryReference(publicClaimId: string): string | SQL {
  return currentStateContextEnabled()
    ? sql`(SELECT id FROM public.claims WHERE claim_id = ${publicClaimId}::uuid LIMIT 1)`
    : publicClaimId
}

/** Preserve the public case-ID contract in API results. */
export function publicClaimHistory<T extends { claimId: string }>(row: T, publicClaimId: string): T {
  return currentStateContextEnabled() ? { ...row, claimId: publicClaimId } : row
}
