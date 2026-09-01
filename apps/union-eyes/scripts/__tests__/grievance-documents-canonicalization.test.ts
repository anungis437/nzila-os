/**
 * Regression test for the `grievance_documents` schema canonicalization
 * (PR #752 review, 2026-09-01 round 2).
 *
 * Live staging DB proved `db/schema/domains/claims/workflows.ts`'s 31-column
 * `grievanceDocuments` declaration is canonical. The stale, non-matching
 * 6-column declaration in `db/schema/domains/claims/grievance-lifecycle.ts`
 * (no organization_id, wrong FK column) has been removed, and its two real
 * production consumers (`app/api/grievances/[id]/documents/route.ts`,
 * `app/api/grievances/[id]/route.ts`) redirected to the working document
 * systems. This test guards against the stale declaration reappearing.
 */
import { describe, it, expect } from 'vitest'
import { scanSchemaDeclarations, classifyGroup } from '../schema-duplicate-table-scan'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('grievance_documents canonicalization (PR #752 review)', () => {
  it('has exactly one class of grievanceDocuments declaration left, and it is not CONFLICTING_SCHEMA', () => {
    const byTable = scanSchemaDeclarations()
    const decls = byTable.get('public.grievance_documents')
    expect(decls, 'expected grievance_documents to still be declared at least once').toBeDefined()
    if (!decls || decls.length < 2) return // fewer than 2 declarations means no conflict is even possible
    expect(classifyGroup(decls)).not.toBe('CONFLICTING_SCHEMA')
  })

  it('no longer declares a stale grievanceDocuments pgTable in grievance-lifecycle.ts', () => {
    const src = readFileSync(
      join(__dirname, '../../db/schema/domains/claims/grievance-lifecycle.ts'),
      'utf8',
    )
    expect(src).not.toMatch(/pgTable\(\s*["'`]grievance_documents["'`]/)
    expect(src).not.toContain('export const grievanceDocuments')
  })
})
