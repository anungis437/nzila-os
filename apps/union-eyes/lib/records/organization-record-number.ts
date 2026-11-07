import { sql } from 'drizzle-orm'
import { getActiveTenantDb } from '@/db/tenant-context-storage'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Server-issued record numbers, one sequence per organization.
 *
 * A record number (an incident, a hazard report, an inspection, a PPE item, an organizing campaign) is issued by the
 * server, never chosen by the caller: the next number after the highest one this organization already holds in the same
 * series. Another organization's numbers are never read and never block a number here, and the unique index on
 * (organization_id, number) (platform 0042) settles anything this allocation could still miss.
 *
 * A transaction-scoped advisory lock per organization and series serializes allocation, so two concurrent creates in one
 * organization receive distinct numbers. The lock lives as long as the transaction that will insert the row, so the
 * allocation must run in that transaction (see issueOrganizationRecordNumber).
 */
export const RECORD_NUMBER_SERIES = {
  incident: { table: 'workplace_incidents', column: 'incident_number', prefix: 'INC', yearly: true },
  hazard: { table: 'hazard_reports', column: 'report_number', prefix: 'HAZ', yearly: true },
  inspection: { table: 'safety_inspections', column: 'inspection_number', prefix: 'INS', yearly: true },
  ppe: { table: 'ppe_equipment', column: 'item_number', prefix: 'PPE', yearly: false },
  organizingCampaign: { table: 'organizing_campaigns', column: 'campaign_code', prefix: 'CMP', yearly: true },
} as const

export type RecordNumberSeries = keyof typeof RECORD_NUMBER_SERIES

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The fixed part of a number in this series, for the given moment (the year is the UTC year of issue). */
export function recordNumberPrefix(series: RecordNumberSeries, now: Date = new Date()): string {
  const spec = RECORD_NUMBER_SERIES[series]
  return spec.yearly ? `${spec.prefix}-${now.getUTCFullYear()}-` : `${spec.prefix}-`
}

/**
 * Allocates the next number of `series` for `organizationId` on `tx`. Numbers are zero-padded to four digits and keep
 * growing past them. Only numbers of the exact server shape (the prefix followed by at most 18 digits) count towards the
 * sequence, so an older random or hand-chosen value is never parsed as one, and a hand-chosen value of that shape is
 * stepped over rather than collided with.
 */
export async function allocateOrganizationRecordNumber(
  tx: Pick<RLSTx, 'execute'>,
  series: RecordNumberSeries,
  organizationId: string,
  now: Date = new Date(),
): Promise<string> {
  if (!UUID.test(organizationId)) throw new Error('A record number is issued only within an organization')
  const spec = RECORD_NUMBER_SERIES[series]
  const prefix = recordNumberPrefix(series, now)
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`record_number:${spec.table}:${organizationId}:${prefix}`}, 0))`,
  )
  const result = (await tx.execute(
    sql`SELECT COALESCE(MAX(CAST(substring(${sql.identifier(spec.column)} FROM ${prefix.length + 1}::integer) AS bigint)), 0) AS last_sequence
        FROM ${sql.identifier(spec.table)}
        WHERE organization_id = ${organizationId}::uuid
          AND ${sql.identifier(spec.column)} ~ ${`^${prefix}[0-9]{1,18}$`}`,
  )) as unknown as { last_sequence: number | string | bigint }[] | { rows: { last_sequence: number | string | bigint }[] }
  const rows = Array.isArray(result) ? result : result.rows
  const next = BigInt(rows[0]?.last_sequence ?? 0) + 1n
  return `${prefix}${next.toString().padStart(4, '0')}`
}

/**
 * Issues the next number inside the caller's tenant transaction, the one the generic create runs its insert in. Outside
 * such a transaction the lock would be released before the row exists, so the request is refused instead.
 */
export async function issueOrganizationRecordNumber(
  series: RecordNumberSeries,
  organizationId: string | null | undefined,
  now: Date = new Date(),
): Promise<string> {
  const tx = getActiveTenantDb()
  if (!tx || !organizationId) throw new Error('A record number can only be issued inside the organization transaction that creates the record')
  return allocateOrganizationRecordNumber(tx as unknown as RLSTx, series, organizationId, now)
}
