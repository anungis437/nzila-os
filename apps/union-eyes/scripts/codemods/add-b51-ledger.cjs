const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B51-F08-SSO-CREATE-CALENDAR-TOKENS-AND-ENTITLEMENT-LIST'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/sso/__tests__/b51-sso-entitlements.test.ts'
  ledger.batches.push({
    id,
    family: 'F08: stored credentials and access configuration fail closed',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B7-PLT-SSO-CREATE-STORES-UNVALIDATED-CONFIGURATION-ENABLED-BY-DEFAULT',
        status: 'PARTIAL',
        files: [A + 'lib/sso/provider-input.ts', A + 'app/api/enterprise/sso/providers/route.ts', A + 'app/api/enterprise/sso/providers/__tests__/route.test.ts', test],
        explanation: 'The SSO provider create now accepts only saml or oidc, bounds every text field, requires https URLs without credentials for the SSO URL and issuer, requires the fields of the type when the provider is to be enabled, and creates a provider disabled and without auto-provisioning unless the administrator asks otherwise. The existing route tests pass unchanged; new unit tests cover each rule.',
        remaining: 'No unique index on organization, entity id or issuer, no proof the organization owns the identity domain, and requireGroups still cannot be set.',
      },
      {
        prefix: 'DEF-0B4-CALENDAR-TOKEN-PLAINTEXT-FALLBACK',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/external-calendar-sync/token-crypto.ts', A + 'lib/external-calendar-sync/__tests__/token-crypto.test.ts'],
        explanation: 'A provider token is never stored without an encryption key (development included; plaintext only under the test runner), and a stored value with no encryption prefix is refused unless CALENDAR_TOKEN_ALLOW_LEGACY_PLAINTEXT is set for a flagged migration window. New unit tests cover round trip, missing key in development and production, and the legacy flag.',
        remaining: 'Existing plaintext rows need a one-time re-encryption or re-authorization; none is performed here.',
      },
      {
        prefix: 'DEF-0B7-PLT-ENT-LISTS-EXPIRED-AND-UNBACKED-ENTITLEMENTS-AS-ACTIVE',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/entitlements/route.ts', test],
        explanation: 'The entitlement list now names only the feature keys that the server-side checkModuleEntitlement allows (not expired, backing contract active) and is limited to 200 rows. Contract test pins the check.',
      },
      {
        prefix: 'DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/scim/v2/[organizationId]/Users/route.ts', A + 'app/api/__tests__/scim-users.route.test.ts'],
        explanation: 'Existing implementation, verified: the list excludes removed members (deleted_at), pages in SQL with a parsed count and start index, and reports the live total; an existing test covers the SQL paging.',
      },
      {
        prefix: 'DEF-0B11-IDS-SCIM-PROVISION-BODY-IS-UNVALIDATED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/scim/v2/[organizationId]/Users/route.ts', A + 'app/api/__tests__/scim-users.route.test.ts'],
        explanation: 'Existing implementation, verified: the create parses its body with a bounded schema (400 for malformed JSON, non-array emails or over-long values); existing tests cover the non-JSON and missing userName cases.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B51 added')
