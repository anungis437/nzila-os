const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const M = A + 'db/migrations-platform/'
const C = A + 'db/migrations-cache/'
addBatch({
  id: 'B106-F06-A2-LOCAL-TRANSACTION-ATOMICITY',
  family: 'F06 A2: mutation and mandatory audit record in one database transaction',
  test: A + 'lib/services/__tests__/s48-f06-a2-local-transaction-atomicity.test.ts',
  previousEvidence: { 'B105-F06-A1-AUDIT-FOUNDATION': 'b258d0938' },
  items: [
    {
      prefix: 'DEF-0B3-BILLING-AUDIT-NOT-ATOMIC',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/billing/replay-invoice/route.ts', A + 'services/platform-economics/billing-service.ts', A + 'app/api/__tests__/billing-replay-invoice.route.test.ts'],
      explanation: 'The invoice replay, the last non-atomic item, reads the invoice and its lineage and writes its access record with persistAtomicAudit in one tenant transaction, before anything is returned: if the record cannot be written the lineage is not released, and a replay of an invoice that is not found writes no record. With invoice generation and trial expiry already atomic, the three operations the defect names are now all atomic; the route manifest classifies the route ATOMIC from its own source.',
    },
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-EDIT-AND-DELETE-NO-VERSION-OR-RETENTION',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [M + '0052_shared_clause_versions.sql', C + '0042_shared_clause_versions_rls_closure.sql', A + 'db/schema/domains/agreements/shared-library.ts', A + 'db/rls-storage-authority/reference-latent.ts', A + 'lib/clause-library/version-history.ts', A + 'app/api/clause-library/[id]/route.ts', A + 'app/api/clause-library/[id]/versions/route.ts', A + 'app/api/clause-library/[id]/__tests__/route.test.ts', A + 'db/__tests__/migration-0052-shared-clause-versions.postgres.test.ts'],
      explanation: 'The text a clause had is no longer lost. Platform 0052 adds shared_clause_versions, an append-only history (no foreign key to the clause, so it outlives it; unique per clause, version and kind; SHA-256 of the text) that cache 0042 forces to the owning organization with SELECT and INSERT only. The item route writes the replaced text in the same transaction before it overwrites it, and the final text before it deletes the row (a retried request cannot record a version twice); a failed history write abandons the change. The owner reads the history at /api/clause-library/[id]/versions. Proven on native PostgreSQL 15 and 16 as the runtime and system roles.',
      remaining: 'Only the owning organization can read the prior text; an organization that compared or cited a clause sees its version number rise but cannot retrieve the earlier text, and a citation is not pinned to a version.',
    },
    {
      prefix: 'DEF-0B8-ICRA-REVIEW-AUDIT-ONLY-WHEN-A-CLAIMED-ORGANIZATION-EXISTS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/icra/report/[assessmentId]/review/route.ts', A + 'app/api/__tests__/icra-report-review.route.test.ts'],
      explanation: 'Every review decision is now audited in the decision\'s transaction. A claimed assessment is audited against the claiming organization; an unclaimed prospect assessment against the organization the reviewing platform administrator is acting in (as for any platform operation); a reviewer acting in no organization gets a 409 and no decision is made unrecorded. The reviewer\'s summary text is not copied into the audit record. The existing test that pinned the absence of an audit was replaced (disclosed).',
    },
    {
      prefix: 'DEF-0B6-SYS-RESEND-SUPPRESSION-UPDATES-ONLY-ONE-PREFERENCE-ROW',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [M + '0053_email_address_suppressions.sql', C + '0043_email_address_suppressions_rls_closure.sql', A + 'db/schema/domains/communications/email-address-suppressions.ts', A + 'db/rls-storage-authority/communications-notifications.ts', A + 'lib/communications/address-suppression.ts', A + 'lib/communications/__tests__/address-suppression.test.ts', A + 'lib/email-service.ts', A + 'lib/__tests__/email-service.test.ts', A + 'app/api/communications/webhooks/resend/route.ts', A + 'app/api/__tests__/communications-webhooks-resend.pglite.test.ts', A + 'app/api/admin/email-suppressions/route.ts', A + 'app/api/__tests__/admin-email-suppressions.route.test.ts', A + 'db/__tests__/migration-0053-email-address-suppressions.postgres.test.ts'],
      explanation: 'A complaint or provider suppression now ends the recipient\'s subscriptions to the organization\'s own distribution lists as well as its preference, and is recorded platform-wide in a governed mechanism: platform 0053 adds email_address_suppressions (SHA-256 of the address only, no plaintext; cache 0043 makes it SYSTEM_ONLY), the webhook writes it in the same transaction as the consent record and the audit entry (only when the event names exactly one recipient; several are not guessed), and the single sending function refuses a suppressed address from any organization and fails closed if the list cannot be read. It is a delivery suppression, not consent, so other organizations\' consent records are untouched. A platform administrator lifts one only through an audited route (reason required, row kept); a later complaint clears the lift. Proven on native PostgreSQL 15 and 16 and against a real SQL engine through the webhook.',
      remaining: 'Only lib/email-service.ts is gated; any other code that talks to a provider directly would bypass the list (none was found).',
    },
    {
      prefix: 'DEF-0B11-PRP-RECONCILIATION-AUDIT-IS-A-SEPARATE-EVENT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'services/platform-economics/reconciliation-service.ts', A + 'services/platform-economics/__tests__/reconciliation-service.test.ts'],
      explanation: 'runReconciliation writes its completed and critical-variance audit records with persistAtomicAudit on the run\'s own transaction, and resolveException updates the exception and writes its record in one transaction (the notes stay on the exception row and only their length reaches the audit record). A failed audit write abandons the run or leaves the exception open, and a rolled-back run leaves no audit event. This changes audit atomicity only; no financial mandate, ledger effect or principal changed (the finance freeze stands).',
    },
  ],
})