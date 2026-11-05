const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B31-F03-TENANT-SCOPE-OF-SHARED-AND-CHILD-RECORDS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B31 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f03-tenant-scope.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F03: a record is read under the organization that holds it, a shared record under what its own row permits, and a platform read of other organizations is attributed and recorded first',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-EMP-REPLAY-NO-FINANCIAL-MANDATE', [A + 'app/api/employer-execution/replay/[runId]/route.ts', A + 'app/api/__tests__/employer-replay-run-id.route.test.ts', A + 'app/api/employer-execution/__tests__/execution-routes-hardening.test.ts', CONTRACT],
      'A replay first requires a live financial view mandate for the run (resource-scoped, as the run detail does) and only then reads any payroll item. Tests adapted: assertions that no transaction was opened now assert that nothing is written, because the mandate check is itself a transaction; the not-found test asserts the mandate was requested. New test: a role holder with no mandate is refused before any read.'),
    item('DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ', [A + 'app/api/employer-execution/remittance-runs/[id]/route.ts', CONTRACT],
      'The remittance run detail needs the financial roles and a live view mandate for the run, reads inside one tenant RLS transaction, and returns only the evidence manifest, never the stored CSV or JSON (existing implementation, now pinned).'),
    item('DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT', [A + 'lib/api/crud-factory.ts', A + 'app/api/arbitration/precedents/route.ts', A + 'app/api/arbitration/precedents/[id]/route.ts', A + 'lib/api/__tests__/crud-factory-staff-read.test.ts', CONTRACT],
      'A new readCondition option applies to every GET whatever the caller\'s role; both decision routes use it so a decision marked not public, or carrying an access restriction, is neither listed nor returned.',
      { status: 'PARTIAL', remaining: 'The row-level-security policy on arbitration_decisions still admits any tenant context (it needs a migration run on native PostgreSQL), and a restricted decision now has no viewing route at all.' }),
    item('DEF-0B4-CBA-CHILD-RECORDS-READ-BY-AGREEMENT-ID-ONLY', [A + 'lib/services/clause-service.ts', A + 'lib/services/bargaining-notes-service.ts', A + 'app/api/cbas/[id]/route.ts', A + 'lib/__tests__/clause-service.test.ts', A + 'lib/services/__tests__/bargaining-notes-service.test.ts', A + 'app/api/__tests__/cbas-bargaining-notes.route.test.ts', CONTRACT],
      'The clause and bargaining-note reads take the caller\'s organization as a required argument and name it beside the agreement id, so a child row written against another organization\'s agreement is never returned. Existing service tests adapted only by passing the new argument; the route test now asserts the notes read carries the organization.'),
    item('DEF-0B6-EDU-COMPLETIONS-POST-SKIPS-REGISTRATION-CHECKS', [A + 'app/api/education/completions/route.ts', CONTRACT],
      'A completion is a locked transition of an existing registration of the organization that must be attended and passed, audited in the same transaction; nothing is inserted (existing implementation, now pinned).'),
    item('DEF-0B6-SYS-INHERITANCE-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES', [A + 'app/api/continuity/inheritance/route.ts', A + 'app/api/__tests__/continuity-inheritance.route.test.ts'],
      'The path no longer mounts the generic factory over pending_profiles; it answers 501 and exposes nothing (existing implementation and test).'),
    item('DEF-0B9-ASM-ONBOARDING-ROOT-ORG-SCOPE-NO-OP-ON-PENDING-PROFILES', [A + 'app/api/onboarding/route.ts', A + 'lib/api/__tests__/roster-facades.contract.test.ts'],
      'The onboarding root answers 501 instead of mounting the factory over pending_profiles, and the roster-facade ratchet pins it.'),
    item('DEF-0B11-PRP-PRECEDENT-ITEM-ROUTE-ORGANIZATION-SCOPE-IS-A-NO-OP', [A + 'app/api/precedents/[id]/route.ts', A + 'app/api/__tests__/precedents-item-isolation.pglite.test.ts'],
      'The precedent item route reads under the caller\'s tenant context with an explicit sharing check, and PATCH and DELETE name the owning organization in their own WHERE clause and audit in the same transaction (existing implementation, existing pglite isolation test).'),
    item('DEF-0B12-PLT-ORGANIZATIONS-GET-REBINDS-EVERY-MEMBERSHIP-ROW', [A + 'app/api/users/me/organizations/route.ts', A + 'app/api/__tests__/users-me-organizations.route.test.ts'],
      'A GET never links or rewrites a membership by e-mail address or through another user id\'s profile; memberships are only those already bound to the caller (existing implementation, existing tests assert no update).'),
    item('DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ', [A + 'app/api/admin/users/route.ts', A + 'app/api/admin/stats/activity/route.ts', A + 'lib/audit/audited-platform-read.ts', A + 'lib/audit/__tests__/audited-platform-read.test.ts', A + 'app/api/__tests__/admin-users.route.test.ts', A + 'app/api/__tests__/admin-stats-activity.route.test.ts', CONTRACT],
      'The platform user directory and activity feed record the read under the system scope before running it and refuse (409) if that record cannot be written; the search term is bounded with LIKE wildcards taken literally, and the activity limit is a bounded integer.',
      { status: 'PARTIAL', remaining: 'Authority is still the platform_lead role title rather than a mandate, and both reads still return member names and e-mail addresses across every organization by design.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B31 added')
