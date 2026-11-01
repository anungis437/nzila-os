const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B105-F06-A1-AUDIT-FOUNDATION',
  family: 'F06 A1: audit-write contract, truthful route manifest, canonical audit visibility, representation protocol capability',
  test: A + 'lib/services/__tests__/s47-f06-a1-audit-foundation.test.ts',
  items: [
    {
      prefix: 'DEF-0B1-MANIFEST-DETECTOR',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'scripts/lib/route-coverage-scan.ts', A + 'lib/__tests__/route-scan-classification.test.ts'],
      explanation: 'The scanner no longer overstates. A generic CRUD route whose table is not OPERATIONAL (read from lib/api/crud-governance.ts, the one place that decides it) refuses every write, so it is reported as not mutating with a READ_ONLY audit class (54 routes); a route that reaches performAuditedOperation is reported INTENT_OUTCOME instead of ATOMIC_SERVICE (41 routes), because operation-audit.ts contains persistAtomicAudit and every route importing it was being counted atomic; and a handler-level requireSystemAdmin( or hasMinRole( is now seen as the ADMIN_AUTH or ROLE_AUTH guard it is (it was reported as a bare session check). Each rule is exercised on a synthetic tree.',
    },
    {
      prefix: 'DEF-0B3-AUDITS-LEGACY-TABLE-NOT-CANONICAL',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/audit/audit-reader.ts', A + 'lib/audit/__tests__/audit-reader.test.ts', A + 'app/api/audits/route.ts', A + 'app/api/audits/[id]/route.ts', A + 'app/api/__tests__/audits-id.route.test.ts'],
      explanation: 'The audits list and detail routes now read through lib/audit/audit-reader.ts in the caller\'s tenant transaction: the legacy audit_security.audit_logs always, and in canonical mode the hash-chained public.audit_logs that persistAtomicAudit actually writes (including the audit.entry.read record the detail route writes). Each entry says which store it came from; the canonical store records no severity or outcome, so those are null, not invented. No details, changes, addresses or session data are returned from either store, and the page is bounded.',
      remaining: 'Proven with mocked transactions only; the canonical read has not been run against the combined PostgreSQL database.',
    },
    {
      prefix: 'DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/reality/capability-registry.ts'],
      explanation: 'The representation protocol (administrator-saved, approved by someone other than its author, every change written with persistAtomicAudit) is now owned by a named capability, UE-REP-PROTOCOL-GOVERNANCE, recorded LIMITED with its files, evidence and limits. The frozen register entry is untouched.',
      remaining: 'The Gate 0B.2 ownership ratification is an institutional decision this change cannot make; the GET read is still logged by the API audit logger rather than recorded atomically.',
    },
    {
      prefix: 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME',
      status: 'PARTIAL',
      files: [A + 'lib/audit/operation-audit.ts', A + 'lib/audit/__tests__/operation-audit.test.ts', A + 'lib/feature-flags.ts', A + 'app/api/admin/feature-flags/route.ts', A + 'app/api/__tests__/admin-feature-flags.route.test.ts', A + 'scripts/lib/route-coverage-scan.ts'],
      explanation: 'The audit-write contract is now stated in one place: performAtomicAuditedOperation writes the change and a single hash-chained audit record in one tenant transaction (a failed audit write abandons the change; a failed change records nothing; afterCommit runs only after commit), and performAuditedOperation is documented and labelled INTENT_OUTCOME as the durable two-phase record for effects our transaction cannot reach. The manifest no longer declares the two-phase routes atomic. The platform feature-flag toggle, a pure database change, moved onto the atomic contract (an undefined flag is a 404 rather than an insert the runtime role may not make).',
      remaining: 'Other operations audited as intent and outcome whose effect is only database rows (CBA source seeding and benchmark snapshot) still use the two-phase helper; they are converted in the external/multi-store batch.',
    },
  ],
})
