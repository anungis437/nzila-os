const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B115-F06-R4-SIGNATURE-EXPIRY-AND-OPERATION-STATE',
  family: 'F06 R4: signature expiry sweep, honest evidence types, atomic database-only operations, truthful post-commit reports',
  test: A + 'lib/signature/__tests__/signature-expiry.pglite.test.ts',
  previousEvidence: { 'B114-F06-R3-PSEUDONYMOUS-WORKBOOK-AUDIT': 'cb737a972' },
  items: [
    {
      prefix: 'DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY-SIGNING-ORDER',
      // An earlier batch (B44) downgraded this defect after B18 credited it; the re-credit is a new entry after that downgrade, not an
      // edit of either earlier entry, so the history stays readable and the defect is still counted once in the totals.
      fresh: true,
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [
        A + 'lib/signature/signature-service.ts',
        A + 'app/api/cron/signature-expiry/route.ts',
        A + 'lib/operations/scheduled-jobs.json',
        A + 'db/rls-storage-authority/documents-evidence.ts',
        A + 'lib/signature/__tests__/signature-service-record-signature.test.ts',
        A + 'db/__tests__/signature-expiry.postgres.test.ts',
      ],
      explanation: 'Every stored term now operates or is refused. Expiry: besides refusing an expired attempt, a cron-authenticated sweep (every 30 minutes, registered in scheduled-jobs.json) finds overdue open internal documents across organizations by system authority (a cross-organization SELECT on signature_documents only, keyset-paged and bounded) and expires each inside its own organization in one transaction with its unsettled signers lapsed, its trail event and its platform audit record; a failing document rolls back whole, is reported (and the run answers 500) while the rest are still expired, and a provider-held document is left to the provider sync. Authentication evidence the platform cannot supply is refused in every signature action: a second-factor request is not created and is not signed; a "digital" (certificate) or "wet" (physical) signature, which would be stored under a stronger name than the evidence supports, is refused before anything is read. Proven natively on PostgreSQL 15 and 16 as the system and runtime roles: the grant and policies suffice, organizations stay isolated, and an injected audit-write fault leaves the document, its signers and its trail exactly as they were.',
      remaining: undefined,
    },
    {
      prefix: 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME',
      status: 'PARTIAL',
      files: [
        A + 'lib/audit/operation-audit.ts',
        A + 'lib/feature-flags.ts',
        A + 'app/api/admin/feature-flags/route.ts',
        A + 'app/api/admin/database/optimize/route.ts',
        A + 'lib/audit/__tests__/operation-audit.test.ts',
        A + 'lib/__tests__/feature-flags.test.ts',
        A + 'app/api/__tests__/admin-feature-flags.route.test.ts',
        A + 'app/api/__tests__/admin-database-optimize.route.test.ts',
      ],
      explanation: 'Re-examined every remaining two-phase route for a single-transaction option. The platform ANALYZE, a database-only statement that was still intent/outcome, now runs with its audit record in one system-scope transaction. It also claimed database-wide statistics were updated although the system role analyzes only tables it owns (measured natively on PostgreSQL 15 and 16: 0 of 730 tables); the answer now reports the tables analyzed and skipped, and says plainly when nothing was updated. The feature-flag cache refresh no longer reports a committed change as having taken effect when the refresh failed: the refresh throws on failure (the request path keeps serving its cache), performAtomicAuditedOperation reports a failed after-commit step through afterCommitReport and records it durably as <action>.after_commit_failed, and the route answers committed / cacheRefreshed / propagationSeconds with a warning. The remaining INTENT_OUTCOME routes act outside the transaction (AI and other providers, mail, payments, queues, calendar and integration sync, PKI signing, bulk import with per-record continuation, ANALYZE-free storage reads), which is what the two-phase contract is for.',
      remaining: 'Billing-cycle generation is finance-frozen and was not changed. Operations whose effect is outside our database remain durable two-phase records by nature. The PKI workflow cancel acts on an in-process store and is a separate capability defect. The bootstrap-v2 source-plan commitments for the changed pilot overview and database optimize routes need regenerating with the Python wheelhouse (UE_V2_WHEELHOUSE) at admission.',
    },
  ],
})
