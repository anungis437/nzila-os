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
import { BASELINE, scanUnscopedMutations, unscopedMutationsInSource } from '../../scripts/lib/mutation-scope-scan'

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

describe('mutation scope comment detection', () => {
  const variables = { pilotApplications: 'pilot_applications', rows: 'rows', workbooks: 'workbooks' }
  const classes = {
    pilot_applications: 'TENANT_RLS_REQUIRED',
    rows: 'TENANT_RLS_REQUIRED',
    workbooks: 'USER_RLS_REQUIRED',
  }
  const count = (source: string) => unscopedMutationsInSource('fixture.ts', source, variables, classes)
  const comment = '/* ' + 'x'.repeat(700) + ' */'

  it('treats a comment-padded organization predicate as scoped', () => {
    const source = `db.update(pilotApplications).set({ a: 1, ${comment} }).where(and(eq(pilotApplications.id, id), eq(pilotApplications.verifiedOrganizationId, previousOrganizationId)))`
    expect(count(source)).toEqual({})
  })

  it('keeps a comment-padded id-only predicate unscoped', () => {
    const source = `db.update(rows).set({ a: 1, ${comment} }).where(eq(rows.id, id))`
    expect(count(source)).toEqual({ 'fixture.ts|rows': 1 })
  })

  it('does not accept an organization token that exists only in a comment', () => {
    const source = `db.update(rows).set({ a: 1 }).where(eq(rows.id, id) /* organizationId */)`
    expect(count(source)).toEqual({ 'fixture.ts|rows': 1 })
  })

  it('does not let a commented where hide an unscoped statement', () => {
    const source = `db.update(rows).set({ a: 1 }) /* .where(eq(rows.organizationId, org)) */ .where(eq(rows.id, id))`
    expect(count(source)).toEqual({ 'fixture.ts|rows': 1 })
  })

  it('does not let whitespace inside a comment join a scope token', () => {
    const source = `db.update(rows).set({ a: 1 }).where(eq(rows.id, id) /* organization */ /* Id */)`
    expect(count(source)).toEqual({ 'fixture.ts|rows': 1 })
  })

  it('still accepts a real user predicate on a user-owned relation', () => {
    const source = `db.update(workbooks).set({ a: 1, ${comment} }).where(and(eq(workbooks.id, id), isNull(workbooks.claimedByUserId)))`
    expect(count(source)).toEqual({})
  })
})
