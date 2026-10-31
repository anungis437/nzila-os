const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B27-F05-F06-COMMERCIAL-BOUNDS-AUDIT-AND-RETENTION'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B27 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const C5 = A + 'lib/api/__tests__/f05-commercial-bounds.contract.test.ts'
const C6 = A + 'lib/api/__tests__/f06-controls.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F05/F06: inputs are typed and bounded, commercial data is read by those who administer it, effects are audited with their record, and retained records are ended rather than deleted',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED', [A + 'app/api/contracts/route.ts', A + 'lib/api/org-references.ts', C5],
      'A contract create checks that its billing account and subscription belong to the caller\'s organization (400 malformed, 404 otherwise) before anything is written; a contract provisions entitlements from its lines.',
      { status: 'PARTIAL', remaining: 'Contract line items still provision entitlements from administrator-typed feature keys with no catalogue check.' }),
    item('DEF-0B6-CMP-CONTRACT-READ-AT-MEMBER-FLOOR', [A + 'app/api/contracts/route.ts', A + 'app/api/contracts/[id]/clauses/route.ts', C5],
      'Contract list and line items are read at the officer floor.'),
    item('DEF-0B3-SUBSCRIPTION-ROLE-TITLE-AND-MEMBER-READ', [A + 'app/api/billing/subscriptions/route.ts', A + 'app/api/billing/subscriptions/[id]/route.ts', C5],
      'Subscriptions are read at the officer floor and paused or resumed by an administrator (was a steward).',
      { status: 'PARTIAL', remaining: 'Authority is still a role title with the financial-mandate check only on reconciliation; subscription changes need the live financial mandate.' }),
    item('DEF-0B6-EMP-TIMESHEET-INGEST-STEWARD-FLOOR-UNBOUNDED', [A + 'app/api/employer-execution/timesheets/route.ts', C5],
      'The list is officer-level and bounded to 200 batches; a new batch needs calendar dates in order, a file name of at most 255 characters and a CSV of at most 2,000,000 characters. Its employer, worksite and unit references were already checked against the organization.',
      { status: 'PARTIAL', remaining: 'The ingest still sits at the steward floor rather than a financial mandate, and no behavioural test of the route exists (contract test only).' }),
    item('DEF-0B7-EXC-SEARCH-LIMITS-BEFORE-FILTERING-BY-SENSITIVITY', [A + 'lib/knowledge-transfer/search/hybrid-search.ts', A + 'lib/knowledge-transfer/search/__tests__/hybrid-search.test.ts'],
      'The keyword search puts the sensitivity floor in the query so the limit counts only readable interviews, treats LIKE wildcards in the query as literals, and reads nothing when no level is allowed. Test disclosure: the drizzle mock gained inArray and one test was added.'),
    item('DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER', [A + 'app/api/pension/trustee-meetings/route.ts', A + 'app/api/__tests__/pension-trustee-meeting-confidentiality.route.test.ts'],
      'List and item reads are restricted to the pension financial administrator role, bound to the tenant, paginated and audited (upstream\'s change, existing test). This is an engineering restriction, not an issued trustee mandate.'),
    item('DEF-0B10-PEN-TRUSTEE-MEETING-MINUTES-CAN-BE-REWRITTEN-OR-DELETED-WITHOUT-HISTORY', [A + 'app/api/pension/trustee-meetings/[id]/route.ts', A + 'app/api/__tests__/pension-trustee-meeting-confidentiality.route.test.ts'],
      'Amendment and deletion of trustee meetings are refused until a versioned amendment and retention workflow exists (upstream\'s change, existing test).'),
    item('DEF-0B10-PEN-T4A-POST-STORES-AN-ADMINISTRATOR-TYPED-INCOME-AS-A-GENERATED-TAX-RECORD', [A + 'app/api/pension/t4a/route.ts', A + 'app/api/__tests__/pension-t4a-no-fabrication.route.test.ts'],
      'T4A generation answers 501 and stores nothing (upstream\'s change, existing test).'),
    item('DEF-0B10-PEN-PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT', [A + 'app/api/pension/plans/[id]/route.ts', A + 'app/api/__tests__/pension-plan-terminate.route.test.ts', C6],
      'DELETE now terminates the plan (status and time) and keeps the row and its enrolments, contributions and claims; a repeat is 409 and a foreign plan 404, audited in the same transaction. Test disclosure: the route had no test, so none was replaced.'),
    item('DEF-0B12-PLT-VOICE-TRANSCRIBE-HAS-NO-RATE-LIMIT-ENTITLEMENT-OR-AUDIT', [A + 'app/api/voice/transcribe/route.ts', A + 'app/api/__tests__/voice-transcribe.route.test.ts', C6],
      'Transcription is rate limited per caller, requires an organization context, and records the disclosure (language, size, type; never the audio or text) before the recording leaves; if the audit cannot be written nothing is sent.',
      { status: 'PARTIAL', remaining: 'There is no entitlement or consent decision for sending a recording to the external service.' }),
    item('DEF-0B12-WBK-MEMORY-HOLDER-ROUTES-ACCEPT-READS-AND-WRITES-ON-THE-BEARER-ID-OF-AN-UNCLAIMED-WORKBOOK-WITH-NO-LIMIT-AND-NO-AUDIT', [A + 'app/api/workbook/[id]/memory-holders/route.ts', C6],
      'The collection reads and writes run through the public-intake guard (rate limit; body cap on writes). Claimed-workbook writes were already audited.',
      { status: 'PARTIAL', remaining: 'The per-holder item route is not yet behind the guard, there is no per-workbook holder cap, and unclaimed-workbook reads are not audited.' }),
    item('DEF-0B5-COMMS-SUBSCRIBER-EMAILS-READ-BY-ANY-MEMBER', [A + 'app/api/communications/distribution-lists/[id]/subscribers/route.ts', A + 'app/api/communications/distribution-lists/route.ts', A + 'app/api/communications/distribution-lists/[id]/route.ts', C6],
      'Distribution lists and their subscriber e-mail addresses are read at the steward floor, and the subscriber list is bounded to 5000 rows. Test disclosure: the subscribers route test\'s mock chain gained limit.'),
    item('DEF-0B7-PLT-EXT-PATCH-STEWARD-FLOOR-REWRITES-ENDPOINT-AND-MAPPING', [A + 'app/api/extensions/[id]/route.ts', C6],
      'Rewriting an integration\'s endpoint and field mapping needs an administrator, as the delete already did.'),
    item('DEF-0B6-CMP-CONTRACT-AUDIT-NOT-ATOMIC', [A + 'services/platform-economics/contract-service.ts', A + 'services/platform-economics/__tests__/contract-service.test.ts', C6],
      'Contract create, activate and terminate write their audit record in the same transaction (persistAtomicAudit) instead of a separate best-effort logger call. Test disclosure: the service test now mocks persistAtomicAudit in place of the logger.'),
    item('DEF-0B8-JUR-KNOWLEDGE-BASE-ITEM-GET-INCREMENTS-VIEW-COUNT-IN-SYSTEM-CONTEXT-WITHOUT-ORG-PREDICATE', [A + 'app/api/knowledge-base/[id]/route.ts', C6],
      'The system-context counter update names the organization of the row that was read.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B27 added')
