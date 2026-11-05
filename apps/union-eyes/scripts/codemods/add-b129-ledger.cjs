const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const files = [
  A + 'db/__tests__/precedent-library.postgres.test.ts',
  A + 'lib/services/precedent-service.ts',
]
for (const f of files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

// The remaining item named the shape and the proof that the library routes work against a real database. Platform 0060 (B128) supplied the shape; this
// is the proof. Every part of the frozen finding (no owner, routes returning every row whatever isPublic and accessRestrictions say, row-level security
// admitting any tenant) is now eliminated in source and shown on native PostgreSQL 15 and 16, so the item carries no remaining text. Not closed.
addBatch({
  id: 'B129-PRECEDENT-LIBRARY-NATIVE-PROOF-AND-ORDERING-DEFECTS',
  family: 'Django and Drizzle convergence: the precedent library proven on the converged arbitration_decisions under the real roles',
  test: A + 'db/__tests__/precedent-library.postgres.test.ts',
  previousEvidence: { 'B128-CONVERGENCE-TRANCHE-4-REACHABLE-STUB-SHAPE': '0d63b0163' },
  items: [
    {
      prefix: 'DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files,
      explanation:
        'B129: the proof the remaining item named. precedent-library.postgres.test.ts (14 tests, native PostgreSQL 15 and 16) runs the unmodified precedent-service and the unmodified collection and item routes of arbitration/precedents against the converged real arbitration_decisions under the real roles (the service reads as the tenant runtime role with no organization, writes in the tenant transaction), over eight decisions: public, private, restricted, pending review, owned by two organizations and by nobody. Every service read (by id, by case number, list with paging, sort and filters, search, issue type, related, statistics, most cited) returns exactly the public unrestricted decisions; both routes list the same set and answer not found for a private, restricted, pending-review or ownerless-private decision, even to its owner; the row-level-security floor agrees and refuses a tenant an insert owned by another organization or by nobody (42501) and an update or delete of what it does not own; a decision is created owned by the supplier, not public and pending review, and only the supplier changes or deletes it. Run against the real table it exposed three defects in precedent-service that no unit test could show, now fixed: search, issue-type and related results were ordered by the precedent_value enum descending, which put the least valuable decision first (it sorts high, medium, low), and getRelatedPrecedents used jsonb && jsonb (no such operator) with an array parameter cast to jsonb, so it threw for every decision that has issue types. The role floor (readRole) is outside the test because the wrapper is replaced, and the generic POST over this table, which has no owner to write, is a separate defect. Platform 0060 is registered UNQUALIFIED and has not been qualified on a staging clone; nothing here is a staging, browser or independent-reviewer result.',
    },
  ],
})

// My own B128 cross-cutting record no longer has the route-level proof outstanding.
const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const record = ledger.crossCuttingSourceEvidence.find((entry) => entry.id === 'UE-CONVERGENCE-TRANCHE-4-REACHABLE-STUB-SHAPE-20261101')
if (!record) throw new Error('the B128 cross-cutting record is missing')
const outstanding = 'Route-level native proof of the precedent library on the converged table; '
if (record.remaining.includes(outstanding)) {
  record.remaining = record.remaining.replace(outstanding, '')
  record.correction += ' Follow-up B129: the precedent library is proven on the converged table under the real roles (14 native tests, PG15 and PG16), which exposed and fixed three precedent-service defects (enum ordering, jsonb overlap).'
  record.files = [...new Set([...record.files, ...files])]
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
  console.log('B128 cross-cutting record updated')
}
