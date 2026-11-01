const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B90-LIFECYCLE-ROUTES-AND-MINIMUM-COHORT'
const test = A + 'lib/services/__tests__/s34-lifecycle-routes-and-minimum-cohort.test.ts'
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
    family: 'Lifecycle routes (health-safety close, SSO provider) and minimum cohort for satisfaction figures',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B8-HS-RESOLUTION-TIME',
        ST,
        [A + 'app/api/health-safety/incidents/[id]/close/route.ts', A + 'app/api/health-safety/hazards/[id]/transition/route.ts', A + 'app/api/__tests__/health-safety-close-transition.route.test.ts'],
        'The generic PATCH may not set a status or date, so there was no route that did. POST /api/health-safety/incidents/[id]/close (administrator) moves a reported or investigating incident to closed and stamps the closed and investigation-completed dates, and POST /api/health-safety/hazards/[id]/transition (resolve or close) moves an open hazard on and stamps the resolution date, and the closed date on close. The dates come from the database clock, the change is conditional on the prior status, and the transition is audited in the same transaction. The statistics routes already compute the resolution time from these dates and from no other.',
        'The incident statistics still count a status of resolved that the incident schema does not define; that counter is always zero.',
      ),
      fresh(
        'DEF-0B11-IDS-SATISFACTION-ANONYMITY',
        'PARTIAL',
        [A + 'lib/services/satisfaction-service.ts', A + 'lib/services/__tests__/satisfaction-service.test.ts'],
        'B90: a representative with fewer than five completed responses is returned without any figure (suppressed: true, all averages zero) and is listed after the ranked ones, so a steward who knows which claim the representative handled can no longer read one response back as an average.',
        'The survey row still keeps member_id, the free text and isAnonymous that nothing reads, and anonymous and named responses are still aggregated together; honoring the flag needs the member link removed from anonymous rows by a migration.',
      ),
      fresh(
        'DEF-0B7-PLT-SSO-NO-UPDATE-DISABLE-OR-DELETE-ROUTE',
        ST,
        [A + 'app/api/enterprise/sso/providers/[id]/route.ts', A + 'app/api/__tests__/enterprise-sso-provider-lifecycle.route.test.ts', A + 'db/rls-storage-authority/reference-latent.ts', A + 'lib/operations/catalog-authority-contract.json'],
        'PATCH /api/enterprise/sso/providers/[id] (administrator) changes, enables, disables or rotates the client secret of one provider of the organization, and DELETE removes it. Unknown fields are refused, a role mapping may only assign roles a tenant administrator can already assign, the merged configuration must be complete for its type to be enabled, a rotated secret is encrypted with the same service as at creation, and every change is audited in the same transaction with the names of the fields and never a credential value. The manifest grants the tenant runtime UPDATE and DELETE on sso_providers (the manifest-driven generator issues the grants, so there is no hand-written migration) and the catalog contract was regenerated; the grants are unqualified until run on native PostgreSQL.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B90 added')
