const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B88-AUDIT-RECORDS-ONBOARDING-SOCIAL-SYNC'
const test = A + 'lib/services/__tests__/s32-audit-records-onboarding-social.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const fresh = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Audit records: onboarding reads, social connection, integration sync',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B9-ASM-ONBOARDING-AUDIT-EVENTS-ARE-EMITTED',
        ST,
        [
          A + 'lib/utils/onboarding-read-audit.ts',
          A + 'app/api/onboarding/discover-federation/route.ts',
          A + 'app/api/onboarding/peer-benchmarks/route.ts',
          A + 'app/api/onboarding/suggest-clauses/route.ts',
          A + 'app/api/__tests__/onboarding-discover-federation.route.test.ts',
          A + 'app/api/__tests__/onboarding-peer-benchmarks.route.test.ts',
          A + 'app/api/__tests__/onboarding-suggest-clauses.route.test.ts',
        ],
        'The three onboarding reads no longer emit to an in-process bus with no subscriber. Each awaits recordOnboardingRead, a canonical audit row (onboarding.federation_discovery, onboarding.peer_benchmarks, onboarding.clause_suggestions) in the acting organization, before the result is returned, and a failed record fails the request. Federation discovery now also requires an organization context. The three route tests were adapted from the bus assertion to the audit writer (disclosed).',
      ),
      fresh(
        'DEF-0B8-ICRA-SYNC-DRY-RUN-IS-ACCEPTED',
        ST,
        [A + 'app/api/integrations/framework/[id]/sync/route.ts'],
        'No sync engine or adapter performs a dry run, so the route schema accepts dryRun only as false: a request for a dry run is refused with a validation error instead of running a real sync that the audit row calls a dry run.',
      ),
      fresh(
        'DEF-0B11-SOC-CONNECT-AUDIT-IS-A-LOG-LINE',
        ST,
        [A + 'app/api/social-media/accounts/route.ts', A + 'app/api/social-media/accounts/callback/route.ts', A + 'app/api/__tests__/social-media-accounts.route.test.ts'],
        'Listing and initiating a connection now write canonical audit rows (social_account.list, social_account.connect_initiated) and completing one writes social_account.connected in the same transaction as the credential upsert, so a connection with no record is not kept. The log-line helper, which dropped the action, organization and platform, is no longer used by either route. The list test asserts the audit row (disclosed), and the social_accounts importer census gained the review route that earlier batch B85 added.',
      ),
      fresh(
        'DEF-0B11-SOC-OAUTH-CALLBACK-IS-A-GET',
        'PARTIAL',
        [A + 'app/api/social-media/accounts/callback/route.ts'],
        'The completion audit is now an atomic row committed with the credential upsert (social_account.connected).',
        'The callback is still a GET that clears its state cookies before validating the request, so a forged request can clear a pending connection; changing the verb or the cookie order needs a coordinated change with the provider redirect registration.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B88 added')
