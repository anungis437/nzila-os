const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S01-SCHEMA-CLOSURE-OF-PARTIAL-FIXES-MIGRATION-0038'
const known = (start) => {
  for (const b of ledger.batches) for (const i of b.items) if (i.prefix.startsWith(start)) return i.prefix
  throw new Error('no earlier item ' + start)
}
if (!ledger.batches.some((x) => x.id === id)) {
  const mig = [A + 'db/migrations-platform/0038_gate0_integrity_columns.sql', A + 'db/migrations-platform/0038_gate0_integrity_columns.rollback.sql', A + 'db/__tests__/platform-0038-gate0-integrity-columns.pglite.test.ts']
  const test = A + 'lib/services/__tests__/s1-schema-closure.test.ts'
  const item = (start, files, explanation, extra = {}) => ({ prefix: known(start), status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, ...mig, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'Schema closure: the columns and indexes that let earlier partial fixes record the real fact instead of approximating it',
    evidenceCommit: null,
    items: [
      item('DEF-0B12-PLT-KPI-HEALTH-TREATS', [A + 'lib/kpi/health.ts', A + 'app/api/targets/summary/route.ts', A + 'app/api/targets/route.ts', A + 'db/schema/analytics.ts', A + 'db/schema/domains/analytics/analytics.ts'],
        'Migration 0038 adds kpi_configurations.direction (higher_is_better or lower_is_better, null for rows that predate it). A target can be created with a direction, and the summary lets a stored direction decide; only a target with none keeps the threshold-order inference. Proven on PGlite (check constraint) and by unit tests.'),
      item('DEF-0B6-EMP-CONTACT-PRIMARY-NOT-EXCLUSIVE', [A + 'app/api/employers/communications/contacts/route.ts', A + 'lib/db/unique-violation.ts', A + 'db/schema/domains/communications/employer-communications.ts'],
        'Migration 0038 adds a partial unique index so an employer has at most one active primary contact; it refuses to apply over an employer that already has two. The create keeps its in-transaction demotion and answers a lost race with 409. Proven on PGlite, including the refusal over existing duplicates.'),
      item('DEF-0B5-COMMITTEE-MINUTES-NO-SEPARATION-OF-DUTIES', [A + 'lib/services/committee-workspace-service.ts', A + 'app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts', A + 'db/schema/committee-workspace-schema.ts'],
        'Migration 0038 adds committee_meetings.minutes_recorded_by and a check that the approver is not the recorder. Recording the minutes stores the recorder and approval refuses that person (403); a meeting recorded before the column existed falls back to its last editor.'),
      item('DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR', [A + 'app/api/exit-interviews/[id]/submit/route.ts', A + 'app/api/exit-interviews/[id]/review/route.ts', A + 'db/schema/domains/infrastructure/exit-interviews.ts'],
        'Migration 0038 adds exit_interviews.submitted_by and a check that the reviewer is not the submitter. Submitting stores the submitter and review refuses that person (403), with the last-editor fallback only for earlier rows. Existing review tests pass.'),
      item('DEF-0B6-EDU-CONTENT-PUBLISH-NO-SEPARATION-OF-DUTIES', [A + 'app/api/content/templates/[id]/status/route.ts', A + 'db/schema/cms-website-schema.ts', A + 'db/schema/domains/infrastructure/cms.ts'],
        'Migration 0038 adds cms_pages.submitted_by. Moving an item to review records who did it, and publication is refused for that person, with the last-editor fallback only for earlier rows. Existing status tests pass.'),
      item('DEF-0B5-COMMS-TEMPLATE-HARD-DELETE', [A + 'lib/api/crud-factory.ts', A + 'app/api/communications/templates/[id]/route.ts', A + 'app/api/messaging/templates/[id]/route.ts', A + 'app/api/communications/templates/route.ts', A + 'app/api/messaging/templates/route.ts'],
        'No schema change was needed: the tables already carry is_active. The shared CRUD factory gains archiveColumn, so DELETE archives the template (is_active false, audited) instead of removing it, and the collections list active templates only. The B53 retain-on-delete pin was replaced by an archive pin (disclosed).'),
      item('DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL', [A + 'lib/api/crud-factory.ts', A + 'app/api/communications/distribution-lists/[id]/route.ts', A + 'app/api/communications/distribution-lists/route.ts'],
        'DELETE of a distribution list now archives it (is_active false), so the cascade that erased the subscribed, unsubscribed and unsubscribe-reason trail can no longer fire through the API; the collection lists active lists only.'),
      {
        prefix: known('DEF-0B7-PLT-SSO-CREATE-STORES-UNVALIDATED'),
        status: 'PARTIAL',
        files: [A + 'app/api/enterprise/sso/providers/route.ts', A + 'db/schema/sso-scim-schema.ts', ...mig, test],
        explanation: 'Migration 0038 adds unique partial indexes (organization and SAML entity id; organization, OIDC issuer and client id), refusing to apply over duplicates; a duplicate create answers 409. The create now accepts requireGroups (at most 50 short names). Proven on PGlite.',
        remaining: 'No proof that the organization owns the identity domain: that needs a DNS or e-mail verification process with the identity provider, which a schema cannot supply.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S01 added')
