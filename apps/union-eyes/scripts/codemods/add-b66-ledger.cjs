const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B66-S09-SMALL-PLATFORM-FIXES-AND-ROW-INTEGRITY-MIGRATION-0046'
const all = () => ledger.batches.flatMap((b) => b.items)
const earlier = (start) => all().find((i) => i.prefix.startsWith(start))
const test = A + 'lib/services/__tests__/s10-row-integrity-and-small.test.ts'
const mig = [A + 'db/migrations-platform/0046_row_integrity.sql', A + 'db/migrations-platform/0046_row_integrity.rollback.sql', A + 'db/__tests__/platform-0046-row-integrity.pglite.test.ts']

if (!ledger.batches.some((x) => x.id === id)) {
  const fresh = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
  const items = [
    fresh('DEF-0B12-PLT-VOCABULARY-LAST-UPDATED', ['packages/cupe-vocabulary/src/vocabulary.ts', 'packages/cupe-vocabulary/src/types.ts'],
      'lastUpdated is a fixed revision date and a contentDigest (a pure FNV-1a over every entry) changes whenever any entry changes, so the vocabulary no longer reports now and a constant on every call.'),
    fresh('DEF-0B12-PLT-V2-CATCH-ALL-SUNSET', [A + 'lib/api/deprecation.ts', A + 'app/api/deprecations/route.ts', A + 'app/api/v2/[...path]/route.ts'],
      'The v2 catch-all answers 410 Gone for every method (it never answers 200), the Sunset header is no longer advertised once the date has passed, and the registry route reports sunsetPassed computed from the clock through one shared helper instead of a typed string.'),
    fresh('DEF-0B12-PLT-TRIAGE-REVOKE', [A + 'app/api/triage-designations/route.ts'],
      'DELETE takes the designation id from the query string; a body of at most 1 KB is still honoured for existing callers, and an invalid id is a 400.'),
    fresh('DEF-0B8-JUR-RULES-ROUTE-ACCEPTS-ANY-CODE', [A + 'app/api/jurisdiction-rules/route.ts', A + 'app/api/__tests__/jurisdiction-rules-deadline.route.test.ts'],
      'The code is looked up with an own-key test, so constructor and __proto__ no longer select a function; an unknown code or an unknown category is a 400 instead of success with an empty list. The deadline-separation test now expects the 400 for a category the register does not hold (disclosed).'),
    fresh('DEF-0B11-PRP-JURISDICTION-PREFERENCES-HAVE-NO-UNIQUE-ROW', [A + 'app/api/precedents/jurisdiction-preferences/route.ts', A + 'db/schema/domains/member/jurisdiction-preferences.ts', A + 'app/api/__tests__/precedents-jurisdiction-preferences.route.test.ts', ...mig],
      'Migration 0046 adds a unique index on (user_id, organization_id) (fail-closed on existing duplicates); the route upserts against it, so two concurrent first saves settle on one row, and includeNational and autoApply must be booleans. The route test mock gained onConflictDoUpdate (disclosed).',
      'No precedent route reads the saved preference, so it still filters nothing on the server; applying it server-side is a product decision.'),
    fresh('DEF-0B6-EMP-REGISTRY-PARENT-COMPANY-CROSS-ORG-LINK', [A + 'app/api/employers/route.ts', A + 'app/api/employers/[id]/route.ts', ...mig],
      'The create and update hooks require parentCompanyId to be an employer of the caller organization (and not the employer itself); migration 0046 adds a trigger that refuses a parent of another organization or itself with SQLSTATE 23514, mapped to a 400.'),
    fresh('DEF-0B7-EXP-EXTERNAL-DOWNLOAD-RELEASES-LATEST', [A + 'app/api/external/documents/[id]/download/route.ts', A + 'app/api/external/grievances/[id]/documents/upload/route.ts', A + 'lib/services/external-resource-authorization-service.ts', A + 'db/schema/representation-authority-schema.ts', ...mig],
      'external_document_access_grants gains a nullable document_version_no (migration 0046). The authorization decision carries it, the download releases exactly that version, and an upload-created grant is pinned to the version it stored.',
      'Grants issued before the migration carry no pin and keep releasing the current version; pinning them needs a reviewed backfill of what each grant covered.'),
    fresh('DEF-0B8-FED-EXTERNAL-GRIEVANCE-PROJECTION', [A + 'app/api/external/grievances/[id]/route.ts'],
      'The route selects only the projected columns under the names the grievances table really has (grievance_number as the case number, description as the summary), so the case number and summary are no longer always null and no other column is read.'),
    fresh('DEF-0B7-EXP-REPORT-HARD-DELETE-AUDIT', [A + 'lib/api/crud-factory.ts', A + 'app/api/reports/[id]/route.ts'],
      'The factory gains hardDeleteAuditColumns; the report delete audit now keeps the name, type, category, visibility and author of the removed definition.'),
    fresh('DEF-0B11-PRP-PRECEDENT-ITEM-DELETE-HARD', [A + 'app/api/precedents/[id]/route.ts', A + 'app/api/__tests__/precedents-item-isolation.pglite.test.ts'],
      'A precedent with citation history is retained (409, withdraw its sharing instead) so the cascade can no longer destroy it; an uncited one is removed with an audit that keeps its case title, jurisdiction, sharing level and removed tag count. The PGlite test gained the tag and citation tables and two cases (disclosed).'),
    fresh('DEF-0B8-HS-STATS-ORGANIZATION-FILTER', [A + 'app/api/health-safety/stats/route.ts', A + 'app/api/health-safety/incidents/stats/route.ts', A + 'app/api/health-safety/hazards/stats/route.ts', A + 'app/api/health-safety/inspections/stats/route.ts', A + 'app/api/health-safety/inspections/findings/route.ts'],
      'Every aggregate refuses with a 400 when there is no organization instead of falling back to an always-true predicate; verified in source and pinned.'),
    fresh('DEF-0B8-HS-LIST-ROUTES-IGNORE-FILTERS', [A + 'lib/api/crud-factory.ts', A + 'app/api/health-safety/incidents/route.ts', A + 'app/api/health-safety/hazards/route.ts'],
      'The factory gains listFilters (enum-checked equality filters and an escaped, bounded text search); the incident list honours status, severity, incidentType and search, and the hazard list status, priority (the hazard level) and search.'),
  ]
  ledger.batches.push({ id, family: 'Small platform fixes, list filters and migration 0046 (row integrity)', evidenceCommit: null, items })

  // Upgrade an earlier partial record, in place, so the defect is counted once.
  const up = earlier('DEF-0B8-HS-ARCHIVED-ROWS')
  if (!up) throw new Error('no earlier archived-rows item')
  up.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
  delete up.remaining
  up.explanation += ' Verified later: the dashboard counts exclude archived hazards and the critical-alert count excludes archived incidents; list and item reads carry the archived exclusion on both tables.'
  up.files = [...new Set([...up.files, A + 'app/api/health-safety/dashboard/route.ts', test])]
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B66 added')
