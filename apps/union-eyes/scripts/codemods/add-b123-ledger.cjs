const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'

const scimCore = [
  A + 'db/migrations-cache/0049_scim_provisioning_functions.sql',
  A + 'db/migrations-cache/0049_scim_provisioning_functions.rollback.sql',
  A + 'lib/scim/provisioned-members.ts',
  A + 'lib/scim/responses.ts',
  A + 'lib/scim/filter.ts',
  A + 'lib/scim/patch.ts',
  A + 'lib/scim/user-operations.ts',
  A + 'lib/scim/route-support.ts',
  A + 'lib/api/with-api.ts',
  A + 'app/api/scim/v2/[organizationId]/Users/route.ts',
  A + 'app/api/scim/v2/[organizationId]/Users/[id]/route.ts',
  A + 'app/api/scim/v2/[organizationId]/ServiceProviderConfig/route.ts',
  A + 'lib/api/__tests__/with-api-machine.test.ts',
  A + 'lib/scim/__tests__/provisioned-members.test.ts',
  A + 'lib/scim/__tests__/scim-patch.test.ts',
  A + 'lib/scim/__tests__/scim-filter-responses.test.ts',
  A + 'lib/scim/__tests__/session-less-caller.test.ts',
  A + 'app/api/__tests__/scim-users.route.test.ts',
  A + 'app/api/__tests__/scim-user-by-id.route.test.ts',
]

addBatch({
  id: 'B123-F03-C-SCIM-USER-LIFECYCLE',
  family: 'F03-C: SCIM user lifecycle through a session-less machine credential, with provisioned members confined to the identity-provider stream',
  test: A + 'db/__tests__/scim-provisioning.postgres.test.ts',
  previousEvidence: { 'B122-F03-B-TENANT-BOUNDARIES-AND-SHARED-DATA-AUTHORITY': 'a93226754' },
  items: [
    {
      prefix: 'DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION',
      status: 'PARTIAL',
      files: scimCore,
      explanation:
        'F03-C: the SCIM surface is now a full user lifecycle for an identity provider. GET one user, PATCH, PUT and DELETE exist next to list and create, with ServiceProviderConfig, and every answer is an RFC 7644 message (the error body, the string status and the list envelope) emitted through a machine-credential mode in withApi that reads no browser session and attaches no user (it refuses to combine with required, roles, minRole or cron). The organization still comes from the bearer token and never from the path. deprovision_action is consumed in the database: suspend, archive or delete is a state change on the roster row (delete is a soft delete plus a revoked status, no row is removed), an already inactive member is reported as unchanged, and a restoration is allowed only for a deprovision this stream made. SCIM sees and changes only members it provisioned (scim:-keyed rows), so an identity-provider call can never remove an account holder. Only effective changes are audited (scim.user.update, .reactivate, .deprovision), with field names and no values, in the same transaction as the change. Eight SECURITY DEFINER functions (cache 0049, rollback shipped) are executable by the system role only, with PUBLIC revoked. Proven on native PostgreSQL 15 and 16 (17 tests: the real route, real token authentication, the real functions, the real audit chain and the system role; the migration applied twice and rolled back to zero functions). Replaced test, disclosed: scim-users.route.test.ts was rewritten from the framework envelope to the SCIM wire format.',
      remaining:
        'No scim_events_log row is written per provisioning event: the physical relation is a four-column Django stub with no row security and no grants, so its shape is a separate schema change. There is no Groups resource: mapping identity-provider groups to roles is an institutional authority decision that is not made (a role in a SCIM payload is refused today). The attribute mapping is stored but not consumed. Real HTTP acceptance and independent review are outstanding. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID',
      status: 'PARTIAL',
      files: scimCore,
      explanation:
        'F03-C: the identity-provider subject is now read and kept (externalId), one live person per externalId per organization is enforced under an advisory lock because the native table has no unique index, a removed member with the same key is revived rather than answering 409, and a deprovision this stream made can be reversed while a suspension the organization made is left alone (outcome held). A provisioned person is still created pending with role member and no status or role from the payload.',
      remaining:
        'A provisioned person is not yet linked to that person\'s own account. The key scim:<organization>:<userName> can never equal a session user id, so a provisioned person has no access until a linking and acceptance rule exists. An e-mail match is deliberately not that rule (users/me/organizations documents why), and the identity-provider federation that would carry a verified subject is not implemented. The open decision is recorded as the blocked operation UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY (SCIM_MEMBER_LINK) and is not invented. No CLOSED credit.',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: scimCore,
      explanation:
        'F03-C: the list and its count now run in ue_scim_list_members and ue_scim_member_total, confined to live scim:-keyed members, with the page cut in SQL from a startIndex that is at least 1 and a count clamped to 0-100 (RFC 7644: a value that is not a number or is negative reads as 0, which returns the total only), and a filter that supports only userName eq and externalId eq (anything else is a 400 invalidFilter).',
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-PROVISION-BODY-IS-UNVALIDATED',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: scimCore,
      explanation:
        'F03-C: create, replace and patch bodies are parsed by bounded parsers (parseScimUserResource and parseScimPatch, including Entra-style capitalised operations and string booleans, Okta path-less value objects and the emails[type eq "work"].value path). Malformed, oversized or unsupported input is a 400 SCIM error naming the problem (invalidSyntax, invalidPath or invalidValue) with nothing written or audited.',
    },
  ],
})
