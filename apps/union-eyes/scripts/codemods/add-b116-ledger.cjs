const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B116-F06-R5-PROVIDER-AND-INSTITUTIONAL-DEPENDENCY-ISOLATION',
  family: 'F06 R5: contracts, guarded states and specific blocked operations for SSO, integration sync, commercial acceptance, knowledge entitlement and notice',
  test: A + 'lib/services/__tests__/s55-f06-r5-dependency-isolation.test.ts',
  previousEvidence: { 'B115-F06-R4-SIGNATURE-EXPIRY-AND-OPERATION-STATE': 'a1fcacf29' },
  items: [
    {
      prefix: 'DEF-0B8-JUR-KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS-ENTITLEMENT-AND-LEAVE-NO-READ-TRACE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [
        A + 'lib/knowledge-transfer/governance/kb-entitlement.ts',
        A + 'app/api/knowledge-base/route.ts',
        A + 'app/api/knowledge-base/[id]/route.ts',
        A + 'app/api/__tests__/knowledge-base-entitlement.route.test.ts',
        A + 'lib/services/__tests__/s39-report-and-knowledge-read-records.test.ts',
      ],
      explanation: 'The union_knowledge_suite entitlement now applies to the one kind of read it can govern: a parent organization\'s shared rows reaching a child. An organization\'s own rows are read without it; a parent\'s shared rows are withheld from the list (the answer says withheld.parentShared with the reason) and, when opened by id, refused with 403 ENTITLEMENT_REQUIRED and recorded as knowledge_base.read_denied naming the policy and that it is unapproved. An entitlement that cannot be determined is not held (fail closed). The policy is explicit and provisional (approvedBy null), shaped like the authority kernel\'s document classes, so which organizations without the suite may read what their parent shares is a named decision rather than an omission. One pinned source test was adapted to the new scope helper (disclosed).',
      remaining: undefined,
    },
    {
      prefix: 'DEF-0B10-PIL-COMMERCIAL-TRANSITION-RECORDS-SIGNED-ACTIVE-CONTRACTS-AND-ISSUED-INVOICES-WITH-NO-COUNTERPART-ACCEPTANCE-AND-ADVANCES-STATE-WHEN-EFFECTS-ARE-ONLY-STAGED',
      status: 'PARTIAL',
      files: [
        A + 'lib/pilot/counterpart-acceptance.ts',
        A + 'app/api/pilot/apply/[id]/commercial-transition/route.ts',
        A + 'app/api/__tests__/pilot-commercial-transition.route.test.ts',
      ],
      explanation: 'The counterpart\'s acceptance now has a first-class evidence level that follows every effect that rests on it. A verifier seam (AcceptanceVerifier, registered per channel; none is registered and no provider is named or activated) is asked before the transaction opens, never while the pilot row is locked, and a verifier that is absent, declines or throws leaves the acceptance operator_recorded_unverified. The channel an administrator types, including e_signature_provider, is stored as a claim beside the verification detail, the policy version and its approval state. The contract, the invoice, the subscription, the stored monetization record, the audit row and the response all carry the evidence level. An explicit provisional policy (approvedBy null) decides whether an operator-recorded acceptance may activate billing; it keeps the earlier behaviour, and setting it to require provider verification refuses contract_signed, invoice_issued and subscription_active as specific blocked operations (pilot.commercial.<state>, requiring provider_verified_acceptance) with nothing changed. Five tests added.',
      remaining: 'Whether an operator-recorded acceptance may activate billing is an institutional and commercial decision that has not been made (the policy is provisional and unapproved). No signature provider or counterpart identity exists, so no acceptance can be provider-verified; a verifier for an approved provider and channel is the missing adapter.',
    },
    {
      prefix: 'DEF-0B12-WBK-ANY-MEMBER-OF-THE-CLAIMING-ORGANIZATION-CAN-READ-CHANGE-AND-DELETE-THE-NAMED-PEOPLE-WITH-NO-ROLE-FLOOR-OR-NOTICE',
      status: 'PARTIAL',
      files: [
        A + 'db/migrations-platform/0055_workbook_holder_notice.sql',
        A + 'db/migrations-platform/0055_workbook_holder_notice.rollback.sql',
        A + 'db/schema/workbook-schema.ts',
        A + 'lib/workbook/holder-notice.ts',
        A + 'app/api/workbook/[id]/memory-holders/route.ts',
        A + 'app/api/workbook/[id]/memory-holders/[holderId]/route.ts',
        A + 'lib/workbook/__tests__/holder-notice.test.ts',
        A + 'db/__tests__/migration-0055-workbook-holder-notice.postgres.test.ts',
        A + 'app/api/__tests__/workbook-memory-holders.route.test.ts',
      ],
      explanation: 'The fact of notice is now durable and visible. Each named person carries whether a notice has been RECORDED, by whom, when, through which channel and with what reference (platform 0055; every existing row starts not_recorded and a half-recorded notice is refused by a constraint), a notice is recorded only by an identified person with authority over the claimed workbook and never from the request body, and an unclaimed workbook, which has nobody to attribute it to, is refused as a specific blocked operation (NOTICE_REQUIRES_CLAIM). The list shows each holder\'s notice state and a summary count. An explicit provisional policy (approvedBy null, off by default) can condition naming a person on a notice recorded in the same request and withhold names and notes from reads until one is recorded; when on, a refusal is a specific blocked operation naming the policy. Native PostgreSQL 15 and 16 prove the migration (twice, existing rows, constraint, rollback and re-apply).',
      remaining: 'How and by whom the named people must be told, and whether naming them should be conditional on a notice, is an institutional and legal decision that has not been made (the policy is off and unapproved). Nothing sends a notice: recording that one was given is not the notice. Migration 0055 is unqualified in a deployment environment.',
    },
    {
      prefix: 'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH-AND-NO-CONSUMER',
      status: 'PARTIAL',
      files: [
        A + 'lib/reality/configuration-effect.ts',
        A + 'lib/reality/activation-guard.ts',
        A + 'app/api/extensions/[id]/route.ts',
        A + 'lib/reality/__tests__/configuration-effect.test.ts',
        A + 'lib/reality/__tests__/activation-guard.test.ts',
      ],
      explanation: 'Switching an integration on is now refused while nothing runs from it: the claim "enabled" is not stored, the refusal is a specific blocked operation (integration.sync.execute, with what it requires and who owns each requirement) and is recorded durably as integration.activate_blocked before the request is rolled back; switching off and ordinary edits still work. The read states per row what stands between its stored configuration and a synchronization, judged from the row (connection completeness and credentials present; credentials are never returned) with institutional approval and an approved adapter reported unmet because nothing records them. A creation path was again deliberately not added: it would store more configuration that nothing consumes, and the governed integration framework (integration_configs with its control-plane and sync engine) is the system that does run.',
      remaining: 'No synchronization runs from api_integrations. The consumer needs an institution\'s approval of the external system and the data it may exchange, credentials from that system, and an approved adapter; the worker and its provider qualification are the missing capability.',
    },
    {
      prefix: 'DEF-0B7-PLT-SSO-CONFIGURATION-NEVER-CONSUMED-BY-SIGN-IN',
      status: 'PARTIAL',
      files: [
        A + 'lib/reality/configuration-effect.ts',
        A + 'lib/reality/activation-guard.ts',
        A + 'app/api/enterprise/sso/providers/route.ts',
        A + 'app/api/enterprise/sso/providers/[id]/route.ts',
        A + 'app/api/enterprise/sso/providers/__tests__/route.test.ts',
        A + 'lib/reality/__tests__/configuration-effect.test.ts',
        A + 'lib/reality/__tests__/activation-guard.test.ts',
      ],
      explanation: 'A provider can no longer be created or updated as enabled or auto-provisioning while nothing reads it at sign-in: those claims are not stored, the refusal is a specific blocked operation (auth.sso.federated_sign_in) and is recorded durably as sso.provider.activate_blocked, and a provider is stored staged with its effect stated. The list judges each stored provider (SAML or OIDC completeness; secrets and certificates are checked for presence and never returned) and reports what remains: the institution\'s approval of the identity provider, verified ownership of the sign-in email domains, and platform authentication federation, each with its owner. Nothing is activated and no approval is invented.',
      remaining: 'No sign-in, token-exchange, provisioning or SCIM code reads the stored provider. The consumer needs the institution\'s approval of an identity provider for the organization, domain-ownership verification, platform authentication that federates through organization-configured providers, and a real provider to qualify against.',
    },
  ],
})
