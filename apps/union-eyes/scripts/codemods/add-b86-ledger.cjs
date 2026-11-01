const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const test = A + 'lib/services/__tests__/s30-consent-sweep-and-document-upload.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const find = (prefix) => ledger.batches.flatMap((x) => x.items).find((i) => prefix.startsWith(i.prefix) || i.prefix.startsWith(prefix))
const upgrade = (prefix, files, explanation) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = ST
  delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

upgrade(
  'DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT',
  [
    A + 'services/geofence-privacy-service.ts',
    A + 'app/api/cron/location-retention/route.ts',
    A + 'db/rls-storage-authority/organizations-membership.ts',
    A + 'db/__tests__/location-consent-expiry.pglite.test.ts',
    A + 'app/api/__tests__/cron-location-retention.route.test.ts',
    A + 'lib/operations/catalog-authority-contract.json',
  ],
  'B86: the stored status now says expired. GeofencePrivacyService.expireLapsedConsents runs inside the hourly retention transaction under the system role, one member at a time and capped like the retention sweep (named by userId and expiresAt, so the mutation-scope ratchet holds), and marks only opted-in consents whose expiry has passed. The manifest gives the system role SELECT and UPDATE on member_location_consent (the same shape as geofence_events: privileges come from the manifest-driven generator, so there is no new migration), and the catalog contract was regenerated. The retention route test was extended for the second step and a PGlite test proves the lapsed rows change, live, open-ended, withdrawn and never-asked rows do not, a user-scoped session cannot do it for other members, and a second run changes nothing (disclosed). The grant itself is unqualified until the generated grants run on native PostgreSQL.',
)
upgrade(
  'DEF-0B7-EXC-DOCUMENT-ATTACH-ACCEPTS-ANY-URL-ON-SHARED-HOST-OR-LOCALHOST',
  [
    A + 'lib/knowledge-transfer/governance/document-location.ts',
    A + 'app/api/exit-interviews/[id]/documents/upload/route.ts',
    A + 'app/api/__tests__/exit-interviews-document-upload.route.test.ts',
  ],
  'B86: the producer of the required location now exists. POST /api/exit-interviews/[id]/documents/upload (steward or owner, entitlement-gated) scans the file for malware before storing anything, stores it at interviews/<organizationId>/<interviewId>/<random>-<name> in the approved storage account, registers the unsigned object location with an atomic audit record, and removes the stored object if the record cannot be written.',
)

fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B86 ledger updated')
