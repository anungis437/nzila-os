const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B117-F06-R6-EVIDENCE-AND-REGRESSION-INTEGRITY',
  family: 'F06 R6: earlier credited evidence verified against the real schema, roles and failure modes',
  test: A + 'db/__tests__/audit-reader.postgres.test.ts',
  previousEvidence: { 'B116-F06-R5-PROVIDER-AND-INSTITUTIONAL-DEPENDENCY-ISOLATION': '9cf25c94a' },
  items: [
    {
      prefix: 'DEF-0B3-AUDITS-LEGACY-TABLE-NOT-CANONICAL',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'db/migrations-cache/0045_audit_security_runtime_read.sql', A + 'db/migrations-cache/0045_audit_security_runtime_read.rollback.sql'],
      explanation: 'R6 re-check of the credited audit reader on real PostgreSQL as union_eyes_runtime: the credit rested on mocked transactions, and natively the legacy audit_security.audit_logs half failed with "permission denied" (the table was reconciled to an INSERT-only runtime sink), as did the activities, ai-usage, compliance audit-log and case-export readers that read it. Cache migration 0045 adds an organization-scoped SELECT policy and grant for the runtime role (rows without an organization stay invisible; UPDATE and DELETE stay ungranted). A native test now runs list, read-by-id and has-action against both stores as the runtime role on PG15 and PG16, including cross-organization reads and the append-only refusal.',
      remaining: 'Other readers of audit_security.audit_logs were not individually re-qualified natively beyond the grant they now have. The legacy store cannot hold a system-actor row from the runtime role (its insert policy requires user_id = the current user), so system-attributed audit in non-canonical mode relies on the canonical ledger.',
    },
    {
      prefix: 'DEF-0B11-SOC-SIGNATURE-AUDIT-TRAIL-HAS-NO-HASH-CHAIN',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/signature/audit-chain.ts', A + 'lib/signature/seal-witness.ts', A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/audit-chain.test.ts', A + 'lib/signature/__tests__/audit-chain.pglite.test.ts'],
      explanation: 'R6 re-check of the chain claims: a shortened chain still verified, the seal was checked only against the same table, and a completed document with no seal was described as "not complete". The seal the platform audit log already held is now read back (both stores, head and count only) and the trail is checked against it: events removed from the end, a rewritten and rechained trail, and a removed seal event are each reported, and the document is not called sealed. A read that fails is reported as unavailable (inside a savepoint), never as intact; a missing platform record is reported as "could not be checked", not corroboration; a completed unsealed document says it has no seal. Tail deletion, rewrite-and-rechain, seal removal and the savepoint behaviour are tested on PGlite, and the read-back and the runtime role\'s inability to update or delete the trail on PG15 and PG16.',
      remaining: 'A trail is still checkable only from its seal: removal of the newest events of a document that has not been sealed is undetectable, because no earlier head is recorded elsewhere. Someone who can rewrite both the trail and the platform audit log can still forge both.',
    },
    {
      prefix: 'DEF-0B6-SYS-RESEND-SUPPRESSION-UPDATES-ONLY-ONE-PREFERENCE-ROW',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/communications/address-suppression.ts', A + 'lib/email-service.ts', A + 'lib/email/report-email-templates.ts', A + 'lib/communications/__tests__/address-suppression.test.ts', A + 'lib/email/__tests__/report-email-templates.test.ts'],
      explanation: 'R6 privacy and false-negative review of the address suppression. The stored digest was an unkeyed SHA-256, reversible by hashing candidate addresses; new suppressions are now HMAC-SHA-256 under EMAIL_SUPPRESSION_HASH_KEY when it is set, and lookups and lifts try both the keyed and the plain digest so nothing recorded earlier becomes deliverable. Normalization now covers Unicode form and internationalized domains (punycode, trailing dot); plus-addressing and dots are deliberately not folded. The scheduled-report mailer had a SendGrid path that bypassed the suppression list and, because it swallowed every error with no fall-through, reported success when it sent nothing; it and the unknown-provider branch now fail instead, leaving the one screened sending function.',
      remaining: 'Set EMAIL_SUPPRESSION_HASH_KEY; until then new suppressions use the unkeyed digest (a warning is logged once). Hard bounces are not recorded platform-wide, and a complaint on a multi-recipient message cannot be attributed to one address, so is not recorded. Plus-addressed variants are separate mailboxes. A suppression recorded under a key is not found if the key is later removed.',
    },
  ],
})
