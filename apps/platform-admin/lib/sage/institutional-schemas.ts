/**
 * Platform Admin — SAGE institutional action API schemas (zod)
 *
 * Browser may supply only opaque mandate/position/resource identifiers, an
 * optional commitment increment, and never verification labels, instrument
 * authority, ledger totals, or currency (those are server-loaded).
 */
import { z } from 'zod'

export const CreateInstitutionalResourceCommitRequest = z
  .object({
    mandateId: z.string().trim().min(1).max(128),
    positionId: z.string().trim().min(1).max(128),
    resourceId: z.string().trim().min(1).max(128),
    /** Commitment increment in minor units of the mandate currency (server-loaded). */
    requestedCommitMinor: z.number().int().positive().max(1_000_000_000_000),
  })
  .strict()

export type CreateInstitutionalResourceCommitRequest = z.infer<
  typeof CreateInstitutionalResourceCommitRequest
>
