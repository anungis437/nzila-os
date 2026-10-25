/**
 * Mutation-scope ratchet (UE-CONV-K-006).
 *
 * An UPDATE or DELETE that identifies a row only by a client-supplied id must prove, in the statement itself, that the
 * row belongs to the acting organization. A preliminary read can be stale or skipped, and the deadline lifecycle once
 * matched on the deadline id alone. This scans application code for UPDATE/DELETE statements on tenant-scoped,
 * parent-owned, user-scoped and multi-party relations (by the storage-authority registry) whose WHERE clause names no
 * organization, and compares them with a committed baseline.
 *
 * In request context `db` is routed to the caller's tenant transaction, so row-level security still bounds these
 * statements; the baseline is therefore debt to convert to explicit predicates, and its purpose is that the set can
 * only shrink. Regenerate with UE_MUTATION_SCOPE_WRITE=1 only after fixing entries.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASELINE, scanUnscopedMutations } from '../../scripts/lib/mutation-scope-scan'

describe('mutation scope ratchet', () => {
  it('no tenant-scoped mutation gains an unscoped UPDATE or DELETE, and the baseline only shrinks', () => {
    const current = scanUnscopedMutations()
    if (process.env.UE_MUTATION_SCOPE_WRITE === '1') {
      const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
      writeFileSync(BASELINE, JSON.stringify({ schemaVersion: 1, note: 'Unscoped UPDATE/DELETE on tenant-scoped relations. Entries may only be removed or reduced. See UE-CONV-K-006.', entries: sorted }, null, 2) + '\n')
      return
    }
    const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries as Record<string, number>
    const regressions = Object.entries(current)
      .filter(([key, count]) => (baseline[key] ?? 0) < count)
      .map(([key, count]) => `${key}: ${count} unscoped mutation(s), baseline ${baseline[key] ?? 0}`)
    expect(regressions).toEqual([])
  })

  it('the closed defects stay closed: deadline, clause library, ingestion retry and grievance writes are scoped', () => {
    const current = scanUnscopedMutations()
    const closed = [
      'lib/services/deadline-confirmation-service.ts',
      'lib/deadline-tracking-system.ts|grievance_deadlines',
      'app/api/clause-library/[id]/route.ts',
      'app/api/admin/ingest/retry/route.ts',
      'app/api/grievances/[id]/assign/route.ts',
      'app/api/grievances/[id]/status/route.ts',
      'app/api/grievances/[id]/convert/route.ts',
    ]
    for (const prefix of closed) {
      expect(Object.keys(current).filter((k) => k.startsWith(prefix)), prefix).toEqual([])
    }
  })
})
