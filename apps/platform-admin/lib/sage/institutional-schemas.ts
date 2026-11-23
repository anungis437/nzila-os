/**
 * Platform Admin — SAGE institutional action API schemas (zod)
 *
 * Browser may supply opaque mandate/resource identifiers, an optional
 * position *claim*, and a commitment increment. Verification labels,
 * instrument authority, ledger totals, currency, conflict/recusal facts and
 * authoritative office/position are never accepted from the browser.
 */
import { z } from 'zod'

export const CreateInstitutionalResourceCommitRequest = z
  .object({
    mandateId: z.string().trim().min(1).max(128),
    resourceId: z.string().trim().min(1).max(128),
    /** Optional claim; must match the locked mandate office after server resolution. */
    claimedPositionId: z.string().trim().min(1).max(128).optional(),
    /** Commitment increment in minor units of the mandate currency (server-loaded). */
    requestedCommitMinor: z.number().int().positive().max(1_000_000_000_000),
  })
  .strict()

export type CreateInstitutionalResourceCommitRequest = z.infer<
  typeof CreateInstitutionalResourceCommitRequest
>
