// Appends batch B14 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B14-F03-OWN-ORGANIZATION-SCOPE'
if (ledger.batches.some((b) => b.id === ID)) {
  console.log('B14 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })

ledger.batches.push({
  id: ID,
  family: 'F03: a route reads and writes the caller\'s own organization; a target taken from the request is the caller\'s own or not found',
  evidenceCommit: null,
  items: [
    item('DEF-0B9-ASM-PEER-BENCHMARKS-AND-CLAUSE-SUGGESTIONS-TAKE-THE-TARGET-ORGANIZATION-FROM-THE-REQUEST', [A + 'app/api/onboarding/peer-benchmarks/route.ts', A + 'app/api/onboarding/suggest-clauses/route.ts', A + 'scripts/codemods/f03-onboarding-own-org.cjs', A + 'app/api/__tests__/onboarding-peer-benchmarks.route.test.ts', A + 'app/api/__tests__/onboarding-suggest-clauses.route.test.ts'],
      'Both routes compare or suggest for the caller\'s own organization. A target named in the query or body that is not the caller\'s reads as 404 and nothing is read; a caller with no organization is refused. Peer benchmarks now work without naming a target. The peer-benchmarks test that required an organizationId parameter was replaced by three tests of the new behavior; the suggest-clauses fixtures use the caller\'s organization.'),
    item('DEF-0B9-ORG-ROSTER-GET-INCLUDES-REMOVED-MEMBERS-AND-IS-UNBOUNDED', [A + 'app/api/organizations/[id]/members/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The roster excludes removed members and is read a page at a time (default and maximum 200) in a stable order; proven on real SQL, including that consecutive pages do not overlap.'),
    item('DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS-ACTIVE', [A + 'app/api/scim/v2/[organizationId]/Users/route.ts', A + 'app/api/__tests__/scim-users.route.test.ts'],
      'The SCIM list excludes removed members, counts and pages in SQL from the requested start index, and no longer loads the whole roster.'),
    item('DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID', [A + 'app/api/scim/v2/[organizationId]/Users/route.ts', A + 'app/api/__tests__/scim-users.route.test.ts'],
      'Provisioning creates a pending membership, not an active one, so naming a user grants no access until the person accepts.',
      { status: 'PARTIAL', remaining: 'The userName string is still stored as the membership user id; binding it to a verified identity needs the identity-to-profile mapping.' }),
    item('DEF-0B11-IDS-SATISFACTION-PENDING-LIST-HAS-NO-ORGANIZATION-PREDICATE', [A + 'lib/services/satisfaction-service.ts', A + 'app/api/satisfaction/route.ts', A + 'lib/services/__tests__/satisfaction-service.test.ts'],
      'The pending list is bound to the caller\'s organization as well as the member; the route refuses a caller with no organization.'),
    item('DEF-0B8-HS-TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT', [A + 'app/api/health-safety/incidents/trends/route.ts', A + 'app/api/__tests__/health-safety-incidents-trends-tenant.route.test.ts'],
      'The trends read the authenticated organization only, as predicate and RLS binding; upstream\'s change, covered by an existing test.'),
    item('DEF-0B9-ML-OPERATIONAL-METRICS-COUNT-EVERY-ORGANIZATIONS-CLAIMS', [A + 'app/api/metrics/operational/route.ts', A + 'app/api/__tests__/metrics-operational.route.test.ts'],
      'Platform-wide counters are for a platform administrator or the service key only; upstream\'s change, covered by an existing test.'),
    item('DEF-0B9-ML-OPERATIONAL-METRICS-SERVICE-KEY-COMPARED-WITH-EQUALITY', [A + 'app/api/metrics/operational/route.ts', A + 'app/api/__tests__/metrics-operational.route.test.ts'],
      'The service key is compared in constant time and no error text is returned; upstream\'s change, covered by an existing test.'),
    item('DEF-0B9-ML-CHURN-RESOLVES-A-SECOND-IDENTITY', [A + 'app/api/ml/predictions/churn-risk/route.ts', A + 'app/api/__tests__/ml-churn-risk.route.test.ts'],
      'The churn route answers 501 and reads no claims (batch B10), so its second identity resolution and unscoped claim read no longer exist.'),
    item('DEF-0B9-ML-ALERTS-ACKNOWLEDGEMENT-JOIN-HAS-NO-ORGANIZATION-PREDICATE', [A + 'app/api/ml/monitoring/alerts/route.ts', A + 'app/api/__tests__/ae-audit-misc.route.test.ts'],
      'The alerts route answers 501 and reads nothing (batch B10).'),
    item('DEF-0B9-ASM-FEDERATION-DISCOVERY-LISTS-FEDERATIONS-AND-CONGRESSES', [A + 'lib/utils/smart-onboarding.ts'],
      'Discovery already lists federations only for an officer-floor caller and (batch B12) now scores the sector.',
      { status: 'PARTIAL', remaining: 'It remains a directory of federations by name and member count, readable by any organization\'s officer; whether that directory may be shown to every organization is an institutional decision.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B14 added')
