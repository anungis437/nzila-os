const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B107-F06-A4-TRUTHFUL-INSTITUTIONAL-OUTCOMES',
  family: 'F06 A4: a state, status or audit record names an outcome only when the system performed or can show it',
  test: A + 'lib/services/__tests__/s49-f06-a4-truthful-institutional-outcomes.test.ts',
  previousEvidence: { 'B106-F06-A2-LOCAL-TRANSACTION-ATOMICITY': '5dae044ef' },
  items: [
    {
      prefix: 'DEF-0B10-PIL-COMMERCIAL-TRANSITION-RECORDS-SIGNED-ACTIVE-CONTRACTS',
      status: 'PARTIAL',
      files: [A + 'app/api/pilot/apply/[id]/commercial-transition/route.ts', A + 'lib/pilot/write-payloads.ts', A + 'app/api/__tests__/pilot-commercial-transition.route.test.ts', A + 'app/[locale]/dashboard/admin/pilots/page.tsx'],
      explanation: 'The transition no longer says an effect happened when it did not. Every state that writes a contract, invoice or subscription (contract_sent, contract_signed, invoice_issued, subscription_active) is refused with 409 and nothing changed when its billing account, contract or active plan is missing, where it used to push a "staged only" note and still commit the new state, status, score history and audit row. contract_signed needs counterpartAcceptance (who accepted for the other party, their role, the channel and an evidence reference), is refused unless a contract exists and is awaiting acceptance, and records the acceptance, the recording administrator and the fact that it was recorded by a platform operator in the contract; a replay does not overwrite it. An invoice is issued only against an accepted (active) contract. A pilot status of approved, active or completed is written only once platform-approved commercial terms exist. Seven existing tests were adapted (staged-only expectations became refusals) and eleven added; the admin UI collects the acceptance. Disclosed adaptations: the mocked state order in the route test now includes approved, pilot_active and pilot_complete.',
      remaining: 'The counterpart\'s acceptance is evidence an administrator records (a document or envelope reference), not a signature the system verified. Provider-verified e-signature, or an authenticated counterpart acceptance step, needs a signing provider and a counterpart identity that this release does not have.',
    },
    {
      prefix: 'DEF-0B10-PIL-ORGANIZATION-VERIFICATION-CHECKS-ONLY',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/pilot/pilot-ownership.ts', A + 'app/api/pilot/apply/[id]/verify-organization/route.ts', A + 'lib/pilot/__tests__/pilot-ownership.test.ts'],
      explanation: 'The binding now rests on what the server can check, not only on the administrator\'s selection. bindPilotOrganization compares the applicant\'s contact e-mail with the target organization\'s active member addresses and the organization name the applicant gave with the organization\'s own name, records both results in the audit record, and refuses (409, nothing written) when neither links the applicant to the organization unless the administrator resubmits with acknowledgeUncorroborated, in which case the audit record states that the verification rests on the stated basis alone. The basis (at least 20 characters) was already required. Three tests added; the bind tests were adapted to the extra reads and the test double made awaitable after limit.',
      remaining: 'An organization with no member yet and a different name can still be verified on the administrator\'s basis, by design and explicitly recorded as uncorroborated.',
    },
    {
      prefix: 'DEF-0B10-PIL-ONBOARDING-CHECKLIST-ITEMS-ARE-TOGGLED',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/pilot/onboarding-checklist-evidence.ts', A + 'lib/audit/audit-reader.ts', A + 'app/api/pilot/onboarding/route.ts', A + 'app/api/__tests__/pilot-onboarding.route.test.ts'],
      explanation: 'A step is marked complete only when the organization\'s own data shows it: the organization record exists, a member other than the caller exists, a member other than the caller holds a role above member, a collective agreement is stored, an employer exists, an integration is configured, and an export was audited (a new hasAuditedAction reads both audit stores and excludes rejected, unavailable and request-only actions). Otherwise the PATCH returns 409 naming what is missing and writes nothing; reopening needs no evidence; the counts are recorded in the audit row, no row content. The evidence SQL was checked against the real PostgreSQL 16 schema. Two tests added; existing tests adapted to a mocked verifier.',
      remaining: 'A configured integration only exists as stored configuration (UE-EXT-INTEGRATION-SYNC is NOT_IMPLEMENTED), so integrations-configured evidences configuration, not a working integration.',
    },
    {
      prefix: 'DEF-0B9-ASM-ONBOARDING-EVENTS-RECORD-CALLER-ASSERTED',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/pilot/onboarding-event-evidence.ts', A + 'app/api/onboarding/events/route.ts', A + 'app/api/onboarding/__tests__/events.route.test.ts'],
      explanation: 'The event and its audit row are written only after the organization\'s membership data shows the milestone: org_created needs the organization to exist, user_invited a named target that is a member of this organization, and role_assigned a named target that is an active member holding that role. An unverified milestone returns 409 and writes neither the event nor the audit row; the event is stamped with what it was verified against and the audit row carries the evidence. Two tests added.',
      remaining: 'user_invited is evidenced by the member row, not by a sent invitation, because an invitation record is not a single governed table.',
    },
    {
      prefix: 'DEF-0B10-PIL-PILOT-OVERVIEW-LISTS-EVERY-ENROLLED-ORGANIZATION',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'app/api/pilot/overview/route.ts', A + 'app/api/__tests__/pilot-overview.route.test.ts'],
      explanation: 'Only platform-administrator authority (isPlatformAdminUser) opens the cross-organization overview; an officer role title in the platform organization no longer does. The read is paged (default 25, at most 100, ordered), takes three queries for the whole page instead of three per organization, and is recorded with performAtomicAuditedOperation in the system scope with the page it returned; a read that cannot be audited returns nothing. The test file was rewritten (disclosed): the old legacy-platform-organization expectations were removed, and tests added for attribution between organizations, bounds, the audit and an audit failure.',
      remaining: 'The platform dashboard shows the first page only; a pager is a UI follow-up.',
    },
    {
      prefix: 'DEF-0B6-EMP-PAYROLL-POSTED-IS-STATUS-ONLY',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [A + 'lib/employer-execution/payroll-run-transitions.ts', A + 'app/api/__tests__/employer-payroll-run-id.route.test.ts', A + 'app/api/employer-execution/__tests__/execution-routes-hardening.test.ts'],
      explanation: 'A payroll run is sealed (posted) only after a remittance package has been generated for it, in the same transaction, so a posted run always means something was done with its amounts; with none the seal is refused (409) and nothing is written. The compliance event and the audit record name the remittance run, the event summary says the system makes no payment or ledger entry, and the response returns the remittance id. No finance mandate, principal or amount logic was changed.',
      remaining: 'Payment and ledger settlement are not performed by this system; the posted state means sealed after remittance, as the event states.',
    },
    {
      prefix: 'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH',
      status: 'PARTIAL',
      files: [A + 'lib/reality/configuration-effect.ts', A + 'app/api/extensions/[id]/route.ts', A + 'lib/reality/capability-registry.ts'],
      explanation: 'Every read, update and delete of an integration configuration, and its audit record, now states inEffect: false with the reason, and the capability is recorded as NOT_IMPLEMENTED (UE-EXT-INTEGRATION-SYNC), so a change is no longer presented as having affected a synchronization. A creation path was deliberately not added: it would store more configuration that nothing consumes.',
      remaining: 'No synchronization runs from the configuration, so enabling an integration, a sync frequency or an endpoint change has no effect. The worker and its provider qualification are the missing capability.',
    },
    {
      prefix: 'DEF-0B7-PLT-SSO-CONFIGURATION-NEVER-CONSUMED',
      status: 'PARTIAL',
      files: [A + 'lib/reality/configuration-effect.ts', A + 'app/api/enterprise/sso/providers/route.ts', A + 'app/api/enterprise/sso/providers/[id]/route.ts', A + 'lib/reality/capability-registry.ts'],
      explanation: 'Every provider list, create, update and delete response, and the create and update audit records, now states inEffect: false with the reason, and the capability is recorded as NOT_IMPLEMENTED (UE-SSO-SIGN-IN), so a configured provider is no longer reported as though it governed sign-in.',
      remaining: 'No sign-in, token-exchange, provisioning or SCIM code reads the stored provider; the consumer needs the identity-provider protocol work and a real provider to qualify against.',
    },
  ],
})
