const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B91-TOKEN-SEALING-OUTBOUND-RESOLUTION'
const test = A + 'lib/services/__tests__/s35-token-sealing-outbound-resolution.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const fresh = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
const upgrade = (prefix, status, files, explanation, remaining) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = status
  if (remaining) found.remaining = remaining
  else delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Provider token sealing, resolved outbound fetch guard, verified analytics suppression',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B11-SOC-OAUTH-ACCESS-AND-REFRESH-TOKENS-ARE-STORED-AS-PLAINTEXT',
        ST,
        [
          A + 'lib/social-media/token-vault.ts',
          A + 'lib/social-media/__tests__/token-vault.test.ts',
          A + 'lib/social-media/social-media-service.ts',
          A + 'app/api/social-media/accounts/route.ts',
          A + 'app/api/social-media/accounts/callback/route.ts',
          A + 'app/api/__tests__/round37-oauth-callback.test.ts',
          A + 'app/api/__tests__/round37-social-media-accounts-boundary.test.ts',
          A + 'app/api/__tests__/social-media-accounts.route.test.ts',
          A + 'lib/social-media/__tests__/round37-cross-org-account-boundary.test.ts',
          A + 'lib/social-media/__tests__/social-media-service.test.ts',
        ],
        'Provider access and refresh tokens are sealed with the Key-Vault-backed secret service (enc:v1: marker) when the OAuth callback stores them and whenever a refresh rewrites them, and opened only at the point a provider client is built. A token written before sealing existed has no marker, is used as it is, and becomes sealed the next time it is rewritten, so connected accounts keep working. Sealing fails closed: if the secret service is unavailable the token is not stored. Five existing test files now mock the secret service and two storage assertions expect the sealed form (disclosed).',
        'Existing plaintext tokens stay plaintext until each account is refreshed or reconnected; a one-off backfill needs the production secret service and was not run.',
      ),
    ],
  })
}

upgrade(
  'DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS',
  ST,
  [A + 'lib/security/outbound-url.ts', A + 'lib/security/__tests__/outbound-url-resolved.test.ts', A + 'lib/services/cba-intelligence/adapters/base-adapter.ts', A + 'app/api/cba-intelligence/sources/[id]/route.ts'],
  'B91: the fetch guard now also resolves the host name and refuses a name that resolves to a private, loopback, link-local or reserved address, or does not resolve (assertPublicHttpUrlResolved, used by the base adapter before every fetch and redirect hop); the source update route applies the same public-address rule as registration; the oversized-body refusals are in the adapter tests. Seven adapter test files mock DNS because their fixtures use names that do not exist, and the f08 outbound contract pin reads the resolving guard (disclosed). A name that changes between the lookup and the connection is still the egress policy\'s to stop.',
)
upgrade(
  'DEF-0B9-ORG-ANALYTICS-ZERO-AND-HUNDRED-PERCENT-DEFAULTS',
  ST,
  [A + 'app/api/organizations/[id]/analytics/route.ts', A + 'lib/organizations/analytics-privacy.ts'],
  'Verified on source in B91: the route applies a minimum group size to the member and claim families together (null, not zero, with the suppression flags), the resolution average is null when nothing has resolved, and the route is at the officer floor.',
)

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B91 added')
