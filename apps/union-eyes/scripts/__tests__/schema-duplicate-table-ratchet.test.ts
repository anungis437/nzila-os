/**
 * Ratchet test for CONFLICTING_SCHEMA duplicate physical-table
 * declarations (PR #752 review finding).
 *
 * scripts/schema-duplicate-table-scan.ts finds physical (schema, table)
 * keys declared by more than one `pgTable()`/schema-qualified `.table()`
 * call where a property this scanner CAN extract (column names, type,
 * nullability, PK/unique/array-ness, default presence, or a resolvable FK
 * target) genuinely disagrees — see that file's header for the full
 * CONFLICTING_SCHEMA / SAME_COLUMN_SET_UNVERIFIED / IDENTICAL_OR_PROVEN_COMPATIBLE
 * definitions. The repository's existing "Schema Drift Detection" CI job
 * does not catch this class of collision at all.
 *
 * This is NOT the same risk class as an RLS bypass: Postgres Row-Level
 * Security policies apply to the real table regardless of which TS
 * declaration a caller happens to import, so a conflicting schema
 * declaration does not by itself let a caller read another tenant's rows.
 * The real risk is data-correctness / type-safety: several of the
 * conflicts have real (non-test) production code importing the
 * NON-canonical declaration directly, bypassing the domain barrel's
 * deliberate resolution (see db/schema/domains/claims/index.ts's own
 * comments for an example) — see
 * apps/union-eyes/schema-duplicate-table-report.txt for the full,
 * regenerable list including which files bypass the barrel for which table.
 *
 * FINGERPRINT-SET RATCHET (PR #752 review, round 2): a plain count ratchet
 * can't tell "fixed table A, broke table B" apart from "no change" if the
 * totals happen to match. This asserts the CURRENT set of conflicting keys
 * is a SUBSET of an explicitly recorded baseline set — so introducing any
 * NEW conflicting table name fails immediately even if the total count
 * doesn't increase (e.g. because a different table was fixed in the same
 * change). Shrink BASELINE_CONFLICTING_TABLE_KEYS as tables are resolved
 * (stale declaration removed/consolidated, all callers redirected to the
 * canonical one); never add a key to it without an explicit, reviewed
 * reason. At full convergence for the production-relevant scope this set
 * should be empty.
 *
 * Keys are `${schema}.${tableName}` (schema is "public" unless the table is
 * declared via `pgSchema(...).table(...)`), matching scanSchemaDeclarations'
 * internal grouping key.
 */
import { describe, it, expect } from 'vitest'
import { scanSchemaDeclarations, classifyGroup } from '../schema-duplicate-table-scan'

// Recorded 2026-09-01 (round 3, after resolving grievance_transitions,
// steward_assignments' real consumers + user_sessions + employers — see
// docs/union-eyes/reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md).
// Round 4: removed 'public.campaigns' and 'public.message_log' — the only
// conflicting declaration was db/schema/phase-4-messaging-schema.ts, whose
// sole consumer (lib/workers/message-queue-processor.ts) had ZERO
// production callers (confirmed via git grep across app/, actions/, lib/,
// services/ for the module path and every exported symbol name; the
// process-messages cron route already throws ApiError.notImplemented()
// per Wave 0 finding F-01 and never called this worker). Both the worker,
// its test, and the stale schema file were deleted rather than
// canonicalized — there was no real behavior to preserve.
// Only remove keys as conflicts are resolved; never add a key to
// accommodate a newly-introduced conflict.
const BASELINE_CONFLICTING_TABLE_KEYS = new Set<string>([
  'public.ml_predictions',
  'public.insight_recommendations',
  'public.automation_rules',
  'public.reward_wallet_ledger',
  'public.clc_sync_log',
  'public.clc_webhook_log',
  'public.chart_of_accounts',
  'public.communication_preferences',
  'public.consent_records',
  'public.newsletter_list_subscribers',
  'public.steward_assignments',
  'public.gl_account_mappings',
  'public.dues_transactions',
  'public.payments',
  'public.payment_methods',
  'public.webhook_deliveries',
])

describe('duplicate physical-table declarations (ratchet, PR #752 review)', () => {
  it('current CONFLICTING_SCHEMA tables are a subset of the recorded baseline', () => {
    const byTable = scanSchemaDeclarations()
    const conflicting: string[] = []
    for (const [key, decls] of byTable) {
      if (decls.length < 2) continue
      if (classifyGroup(decls) === 'CONFLICTING_SCHEMA') conflicting.push(key)
    }

    const newKeys = conflicting.filter((key) => !BASELINE_CONFLICTING_TABLE_KEYS.has(key))

    expect(
      newKeys,
      newKeys.length > 0
        ? `New conflicting physical-table schema declaration(s) detected beyond the recorded baseline: ${newKeys.join(', ')}. ` +
          `Run scripts/schema-duplicate-table-scan.ts for the full report before adding to BASELINE_CONFLICTING_TABLE_KEYS.`
        : undefined,
    ).toEqual([])
  })
})

