import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Allocates the next human-readable claim number (CLM-YYYYMMDD-NNNN) for an organization.
 * Numbering and uniqueness are organization-scoped: the database enforces
 * UNIQUE (organization_id, claim_number). A transaction-scoped advisory lock per
 * organization and day serializes allocation, so concurrent creates in one organization
 * receive distinct numbers instead of colliding on the constraint.
 */
export async function allocateClaimNumber(
  tx: RLSTx,
  organizationId: string,
  now: Date = new Date(),
): Promise<string> {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `CLM-${datePart}-`
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`claim_number:${organizationId}:${datePart}`}, 0))`,
  )
  const result = (await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(substring(claim_number FROM ${prefix.length + 1}::integer) AS integer)), 0) AS last_sequence
        FROM claims
        WHERE organization_id = ${organizationId}::uuid
          AND claim_number ~ ${`^CLM-${datePart}-[0-9]+$`}`,
  )) as unknown as { last_sequence: number }[]
  const next = Number(result[0]?.last_sequence ?? 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}
