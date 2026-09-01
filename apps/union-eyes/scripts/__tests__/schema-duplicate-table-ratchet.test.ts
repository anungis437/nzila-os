/**
 * Ratchet test for CONFLICTING_SCHEMA duplicate physical-table
 * declarations (PR #752 review finding).
 *
 * scripts/schema-duplicate-table-scan.ts found 22 physical tables declared
 * by more than one `pgTable()` call with genuinely DIFFERENT column sets
 * (as opposed to a harmless duplicate declaration with identical columns).
 * The repository's existing "Schema Drift Detection" CI job does not catch
 * this class of collision at all — it was green throughout.
 *
 * This is NOT the same risk class as an RLS bypass: Postgres Row-Level
 * Security policies apply to the real table regardless of which TS
 * declaration a caller happens to import, so a conflicting schema
 * declaration does not by itself let a caller read another tenant's rows.
 * The real risk is data-correctness / type-safety: several of the 22
 * conflicts have real (non-test) production code importing the NON-canonical
 * declaration directly, bypassing the domain barrel's deliberate
 * resolution (see db/schema/domains/claims/index.ts's own comments for an
 * example of that deliberate resolution) — see
 * apps/union-eyes/schema-duplicate-table-report.txt for the full,
 * regenerable list including which files bypass the barrel for which table.
 *
 * Fully reconciling all 22 (redirecting every bypassing import to the
 * canonical declaration, then deleting/consolidating the stale files) is a
 * bounded but nontrivial follow-up requiring per-table verification against
 * the live schema — out of scope to do blindly in one pass. This is a
 * RATCHET: it fails if the count of conflicting physical tables goes UP
 * (a new duplicate/incompatible declaration was added), but does not fail
 * CI today for the existing, disclosed baseline.
 */
import { describe, it, expect } from 'vitest'
import { scanSchemaDeclarations } from '../schema-duplicate-table-scan'

// Recorded 2026-09-01 — see file header. Only lower this as conflicts are
// resolved (stale declaration removed/consolidated, all callers redirected
// to the canonical one); never raise it without an explicit, reviewed reason.
const BASELINE_CONFLICTING_TABLE_COUNT = 22

describe('duplicate physical-table declarations (ratchet, PR #752 review)', () => {
  it('does not exceed the recorded baseline count of CONFLICTING_SCHEMA tables', () => {
    const byTable = scanSchemaDeclarations()
    const conflicting: string[] = []
    for (const [table, decls] of byTable) {
      if (decls.length < 2) continue
      const sets = decls.map((d) => new Set(d.columns))
      const first = sets[0]
      const allSame = sets.every((s) => s.size === first.size && [...s].every((c) => first.has(c)))
      if (!allSame) conflicting.push(table)
    }

    expect(
      conflicting.length,
      conflicting.length > BASELINE_CONFLICTING_TABLE_COUNT
        ? `New conflicting physical-table schema declarations detected beyond the recorded baseline of ${BASELINE_CONFLICTING_TABLE_COUNT}. ` +
          `Run scripts/schema-duplicate-table-scan.ts for the full report. New/changed tables: ${conflicting.join(', ')}`
        : undefined,
    ).toBeLessThanOrEqual(BASELINE_CONFLICTING_TABLE_COUNT)
  })
})
