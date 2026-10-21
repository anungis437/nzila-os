#!/usr/bin/env tsx
/**
 * verify-strike-fund-org-backfill.ts — deterministic evidence report for
 * db/migrations/20260909_strike_fund_disbursements_organization_id.sql
 * (Round 58 Phase 0, corrected).
 *
 * Read-only. Independently (not by reusing the migration's own CTEs)
 * reports, before the migration runs, how many strike_fund_disbursements
 * rows would be:
 *   - mapped (exactly one organization_members row effective at that row's
 *     own payment_date — joined_at <= payment_date AND (deleted_at IS NULL
 *     OR deleted_at > payment_date))
 *   - ambiguous (more than one such effective-at-payment-date candidate)
 *   - unmapped (zero such candidates)
 *
 * This is a per-disbursement-row, point-in-time check, NOT a present-day
 * "does this user currently belong to exactly one organization" check —
 * present-day membership is not equivalent to historical economic
 * ownership of a payment made in the past.
 *
 * The migration itself refuses to enforce NOT NULL if ambiguous+unmapped > 0
 * (see the migration file) — this script exists to surface that evidence
 * for review *before* the migration transaction runs, not to apply anything.
 *
 * Required env: DATABASE_URL (or ADMIN_DATABASE_URL). Never prints the
 * connection string.
 */
import postgres from 'postgres'

async function main() {
  const dbUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('[verify-strike-fund-org-backfill] Missing DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const sql = postgres(dbUrl, { max: 1 })
  try {
    const [{ count: totalRows }] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM strike_fund_disbursements
    `

    // Independent per-row candidate count: a correlated subquery per
    // disbursement, deliberately structured differently from the
    // migration's own set-based CTE join, so this script is not just
    // re-checking the migration's own logic against itself.
    const [column] = await sql<{ data_type: string | null }[]>`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_members'
        AND column_name = 'organization_id'
    `
    const membershipType = column?.data_type ?? null
    const currentUuid = membershipType === 'uuid'
    const historicalText = membershipType === 'text' || membershipType === 'character varying'
    if (!currentUuid && !historicalText) {
      throw new Error(
        `organization_members.organization_id is ${membershipType ?? 'missing'}. Expected uuid for the current contract.`,
      )
    }

    const rows = currentUuid
      ? await sql<{ candidate_count: string }[]>`
          SELECT (
            SELECT COUNT(DISTINCT o.id)
            FROM organization_members om
            JOIN organizations o ON o.id = om.organization_id
            WHERE om.user_id = sfd.user_id
              AND om.joined_at <= sfd.payment_date
              AND (om.deleted_at IS NULL OR om.deleted_at > sfd.payment_date)
          )::text AS candidate_count
          FROM strike_fund_disbursements sfd
        `
      : await sql<{ candidate_count: string }[]>`
          SELECT (
            SELECT COUNT(DISTINCT o.id)
            FROM organization_members om
            JOIN organizations o ON o.slug = om.organization_id
            WHERE om.user_id = sfd.user_id
              AND om.joined_at <= sfd.payment_date
              AND (om.deleted_at IS NULL OR om.deleted_at > sfd.payment_date)
          )::text AS candidate_count
          FROM strike_fund_disbursements sfd
        `

    let mappedCount = 0
    let ambiguousCount = 0
    let unmappedCount = 0
    for (const row of rows) {
      const count = Number(row.candidate_count)
      if (count === 1) mappedCount += 1
      else if (count > 1) ambiguousCount += 1
      else unmappedCount += 1
    }

    const report = {
      table: 'strike_fund_disbursements',
      schemaContract: currentUuid ? 'CURRENT_UUID' : 'HISTORICAL_TEXT_NOT_CURRENT',
      currentLifecycleCompatible: currentUuid,
      mappingSource: currentUuid
        ? 'organization_members.organization_id uuid = organizations.id, effective at each disbursement.payment_date'
        : 'HISTORICAL_TEXT_NOT_CURRENT: organizations.slug = organization_members.organization_id. This does not prove the canonical UUID schema.',
      rowCount: Number(totalRows),
      mappedCount,
      ambiguousCount,
      unmappedCount,
    }
    console.log(JSON.stringify(report, null, 2))

    if (!currentUuid) {
      console.error(
        '[verify-strike-fund-org-backfill] Membership organization_id is not uuid. The slug join is historical evidence only. The current producer is migrations-platform/0008_strike_fund_uuid_membership_provenance.sql.',
      )
      process.exit(1)
    }

    if (report.ambiguousCount > 0 || report.unmappedCount > 0) {
      console.error(
        `[verify-strike-fund-org-backfill] ${report.ambiguousCount} ambiguous + ${report.unmappedCount} unmapped row(s) — the migration will refuse to proceed until these are resolved manually. This may be an expected, correct outcome if historical provenance genuinely cannot be proven for those rows; do not add a fallback/default/current-membership shortcut.`,
      )
      process.exit(1)
    }
    console.log('[verify-strike-fund-org-backfill] All rows deterministically mappable to their historically-effective organization — safe to run the migration.')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('[verify-strike-fund-org-backfill] Failed:', err)
  process.exit(1)
})
