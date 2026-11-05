const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B55-F12-WORKFLOW-INTEGRITY-APPROVAL-LOCKS-AND-ATOMIC-UNSUBSCRIBE'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/b55-workflow-integrity.test.ts'
  const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'F12: approved records are locked, reviewers are independent, referenced members and documents are the organization own, and an unsubscribe is one transaction',
    evidenceCommit: null,
    items: [
      item('DEF-0B5-COMMITTEE-DECISIONS-EDITABLE-AFTER-APPROVAL', [A + 'lib/services/committee-workspace-service.ts'],
        'A meeting update that touches decisions, agenda items, agenda or status is conditional on the minutes not yet being approved; when they are, the update answers 409 (404 only for a missing meeting). Other fields (location, link) stay editable. Existing committee tests pass; a source-contract test pins the predicate.'),
      item('DEF-0B5-COMMITTEE-MINUTES-NO-SEPARATION-OF-DUTIES', [A + 'app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts'],
        'The person who last edited the meeting record, which includes recording the minutes, cannot approve them (403).',
        { status: 'PARTIAL', remaining: 'The table records no separate recorder, so the last editor stands in for the recorder; a recordedBy column is the proper fix.' }),
      item('DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED', [A + 'lib/services/org-member-references.ts', A + 'app/api/committees/[id]/meetings/[meetingId]/attendance/route.ts', A + 'app/api/committees/[id]/action-items/route.ts', A + 'app/api/committees/[id]/documents/route.ts'],
        'Attendance member ids and an action-item assignee must be current members of the organization (400, nothing written), and a linked documentId must be a document of the organization (404). Existing committee tests pass.',
        { status: 'PARTIAL', remaining: 'A linked fileUrl is still accepted from the body without a storage-host allow-list.' }),
      item('DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR', [A + 'app/api/exit-interviews/[id]/review/route.ts', A + 'app/api/__tests__/exit-interviews-review.route.test.ts'],
        'The person who last edited or submitted an exit interview, not only its creator, cannot review it (403). Existing review tests pass.',
        { status: 'PARTIAL', remaining: 'No submitter column exists; the last editor stands in for the submitter.' }),
      item('DEF-0B7-EXC-DOCUMENTS-ATTACHABLE-AFTER-REVIEW', [A + 'app/api/exit-interviews/[id]/documents/route.ts'],
        'Documents and transcripts can no longer be attached to an interview that is reviewed, published or archived (409), so what the reviewer approved is what is published.'),
      item('DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC', [A + 'app/api/communications/unsubscribe/[recipientId]/route.ts', A + 'app/api/__tests__/communications-unsubscribe.route.test.ts', A + 'app/api/__tests__/communications-public-mutation-isolation.pglite.test.ts'],
        'The message log, campaign stats, preference, list subscriptions and consent record are written on the one transaction handed to the callback (they used the shared connection, so there was no transaction at all). The unit-test mocks were adapted to pass the mock db as the transaction and to include the newsletter tables, and the real-SQL pglite test now creates those tables and still passes (disclosed).',
        { status: 'PARTIAL', remaining: 'The public GET still changes state; it is guarded by a signed, action-bound token.' }),
      item('DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE', [A + 'app/api/communications/unsubscribe/[recipientId]/route.ts'],
        'A campaign-link unsubscribe also marks the recipient subscriptions to the distribution lists of that organization unsubscribed, in the same transaction. Proven on real SQL (pglite) not to fail; contract test pins the update.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B55 added')
