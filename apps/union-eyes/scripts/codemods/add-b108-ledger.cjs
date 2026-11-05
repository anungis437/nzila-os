const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B108-F06-A3-DURABLE-OPERATION-LIFECYCLES',
  family: 'F06 A3: each state change of a multi-step operation is recorded for what it is, with the durable record that leads to it',
  test: A + 'lib/services/__tests__/s50-f06-a3-durable-operation-lifecycles.test.ts',
  previousEvidence: { 'B107-F06-A4-TRUTHFUL-INSTITUTIONAL-OUTCOMES': '0ab678010' },
  items: [
    {
      prefix: 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME',
      status: 'PARTIAL',
      files: [A + 'app/api/cba-intelligence/ingestion/seed/route.ts', A + 'app/api/cba-intelligence/benchmark/[id]/route.ts', A + 'lib/audit/operation-audit.ts', A + 'lib/audit/__tests__/operation-audit.test.ts'],
      explanation: 'The two database-only operations that were still two-phase, the CBA registry seed and the benchmark snapshot, now write the change and a single hash-chained audit record in one system-scope transaction (a failed audit write rolls the whole seed or snapshot back; the seed fails fast so a swallowed statement error cannot leave an aborted transaction reporting a partial result). performAtomicAuditedOperation and performAuditedOperation gain resultDetails, so the record carries what the work did.',
      remaining: 'Operations that act outside the database transaction stay durable two-phase records, labelled INTENT_OUTCOME in the route manifest rather than ATOMIC. Billing-cycle generation is finance-frozen and was not changed.',
    },
    {
      prefix: 'DEF-0B4-CBA-INTEL-AUDIT-NOT-ATOMIC',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/cba-intelligence/ingestion/run/route.ts', A + 'app/api/cba-intelligence/extraction/route.ts', A + 'lib/services/cba-intelligence/seed-sources.ts', A + 'lib/services/cba-intelligence/__tests__/seed-sources.test.ts', A + 'app/api/__tests__/cba-benchmark-snapshot.route.test.ts'],
      explanation: 'Source seeding is atomic (see above). Ingestion runs and extraction call external sources and an AI provider across many statements, so they cannot share one transaction and are no longer described as atomic: the manifest labels them INTENT_OUTCOME, and the outcome record now names the durable rows the run wrote (job ids and counts; extraction run ids and counts), so the audit trail leads to them.',
      remaining: 'Ingestion and extraction remain two-phase by nature; no provider was exercised in this batch.',
    },
    {
      prefix: 'DEF-0B4-CALENDAR-SYNC-AUDIT-NOT-ATOMIC',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/calendar-sync/connections/[id]/sync/route.ts', A + 'app/api/calendar-sync/connections/[id]/sync/route.test.ts'],
      explanation: 'The provider call stays inside the durable intent and outcome record, but the connection\'s own state change is now a tenant transaction that also writes its audit record: calendar_sync.connection.state_synced on success and calendar_sync.connection.sync_failed, with the connection marked failed, when the provider fails (previously a failure left the connection unchanged and unrecorded). A state change whose audit record cannot be written fails the sync instead of reporting it synced.',
      remaining: 'Events imported or exported before a later provider failure remain; the failure is recorded, not rolled back at the provider.',
    },
    {
      prefix: 'DEF-0B2-REVOCATION-MULTI-STORE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/services/member-access-revocation-service.ts', A + 'lib/services/__tests__/member-access-revocation-service.test.ts'],
      explanation: 'Revocation spans sessions, the platform-auth membership and the local row, which cannot share a transaction, so the attempt is made durable before any store is touched (member.access.deactivate_attempt or delete_attempt) and the outcome is recorded atomically with the local status change as before. A process that stops part-way leaves a visible attempt with no outcome, and a repeat is idempotent. Unlike reactivation, a revocation whose attempt cannot be recorded is still carried out, because denying access is the safe direction; the outcome record then says attemptRecorded: false and the result reports intentRecorded.',
      remaining: 'Three stores are still updated separately; a failed step still returns 502 and is completed by a retry.',
    },
    {
      prefix: 'DEF-0B7-EXP-EXTERNAL-DOWNLOAD-BEARER-LINK-NOT-BOUND-TO-GRANT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/external/documents/[id]/download/route.ts', A + 'lib/blob-client.ts', A + 'app/api/external/documents/[id]/download/route.pglite.test.ts', A + 'app/api/external/documents/[id]/download/projection.test.ts', A + 'app/api/external/__tests__/external-routes.test.ts', A + 'lib/services/__tests__/s11-cognition-and-integrity.test.ts'],
      explanation: 'No storage link leaves the server. The route reads the pinned version\'s bytes (bounded at 50 MB; larger files get 413) and serves them with attachment, no-store and nosniff headers, so the grant, its expiry and its revocation are checked on every read and cannot be bypassed by a passed-on URL. The access record is written before any byte is sent and names the bytes delivered (size, version, grant), and the bytes are withheld if it cannot be written. The two tests that pinned the five-minute link (s11, projection) were replaced with assertions that no link is issued (disclosed); the real-SQL test was rewritten for byte delivery, the 413 and the refused grant.',
      remaining: 'A grant issued before migration 0046 and not pinned to a version still releases the current version (a separate, already-recorded item).',
    },
    {
      prefix: 'DEF-0B11-PRP-DUES-PAY-POST-INITIATION-AUDIT-COMMITS-BEFORE-THE-PROCESSOR-CALL',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/dues/dues-payment-service.ts', A + 'lib/dues/__tests__/dues-initiation-single-open.pglite.test.ts'],
      explanation: 'The initiation record now says a payment was opened, and what the provider then did is recorded as its own state change in its own transaction: dues.payment_provider_intent_linked with the processor id, dues.payment_cancelled with the reason (provider_intent_not_created, superseded_by_new_balance). A cancellation that cannot be written is logged, never discarded, and leaves the row pending, which is safe because a repeat reuses an open payment of the same amount and the provider call is idempotent on the payment id. A payment whose intent the provider created is no longer cancelled when only the local link failed (that left a chargeable intent whose settlement would be refused): it stays pending and a repeat reuses it. Four real-SQL tests added. No finance mandate, amount, principal or settlement logic was changed.',
      remaining: 'The provider call is still outside the transaction by nature.',
    },
    {
      prefix: 'DEF-0B11-SOC-POST-DELETE-REMOVES-THE-PLATFORM-POST-BEFORE-THE-LOCAL-ROW',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/social-media/posts/route.ts', A + 'lib/social-media/social-media-service.ts', A + 'app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts'],
      explanation: 'The two effects are separated and each is recorded for what it is. Removal from the platform is a durable intent and outcome (with whether it was already gone); the row then reads deleted in one transaction with social.post.deleted. A platform failure now returns 502 PLATFORM_REMOVAL_FAILED with the row still published (true: the post is still live); a failure of the local step returns 502 LOCAL_STATE_PENDING, never "deleted", and repeating the deletion completes it because a platform answer that the post is already gone counts as removed. deletePost keeps its contract for other callers.',
      remaining: 'The already-removed detection reads the platform error text, since the platform clients expose no typed not-found.',
    },
    {
      prefix: 'DEF-0B10-OPL-10',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/auth/organization-selection-audit.ts', A + 'lib/auth/canonical-organization-selection.ts', A + 'lib/auth/__tests__/organization-selection-audit.test.ts'],
      explanation: 'The selection record (B103) now names the organization the actor was working in before (from the session or provider), and the canonical selection records its outcome after the session store has been changed or has refused (organization.selected, organization.select_failed). An intent with no outcome is a selection that did not complete.',
      remaining: 'The session store cannot commit with an audit row, so the pair is two-phase; the legacy path keeps no server-side previous organization and records null.',
    },
  ],
})
