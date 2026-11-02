import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { verifyDeploySelection, verifySelectionProvenance } from './verify-deploy-selection.mjs'

const image = name => 'nzilacanadaacr.azurecr.io/nzila/' + name + '@sha256:' + (name === 'alpha' ? 'a' : 'b').repeat(64)
const alpha = { containerAppName: 'alpha', image: image('alpha') }
const bravo = { containerAppName: 'bravo', image: image('bravo') }
const signed = () => ({ deployTargets: [structuredClone(alpha), structuredClone(bravo)] })
const selected = () => ({ deployTargets: [structuredClone(alpha)] })
const reject = (a,b,c) => assert.throws(() => verifyDeploySelection(a,b,c), /DEPLOY_SELECTION_DENIED/)

test('accepts exactly the approved subset of signed immutable deployment targets', () => {
  assert.deepEqual(verifyDeploySelection(signed(), selected(), 'alpha'),
    { approvedCount: 1, names: ['alpha'] })
  assert.deepEqual(verifyDeploySelection(signed(), signed(), 'bravo,alpha').names,
    ['bravo','alpha'])
})
test('denies silent partial deployments, extra targets and unknown approvals', () => {
  reject(signed(), selected(), 'alpha,bravo')
  reject(signed(), signed(), 'alpha')
  reject(signed(), selected(), 'charlie')
  reject(signed(), selected(), '')
})
test('denies modified image digests, destinations or unsigned target substitutions', () => {
  const swapped = selected(); swapped.deployTargets[0].image = image('bravo')
  reject(signed(), swapped, 'alpha')
  const alias = selected(); alias.deployTargets[0].imageRef = image('bravo')
  reject(signed(), alias, 'alpha')
  const mutated = selected(); mutated.deployTargets[0].containerAppName = 'bravo'
  reject(signed(), mutated, 'alpha')
})
test('denies duplicate approvals, duplicate signed destinations and malformed aliases', () => {
  reject(signed(), selected(), 'alpha,alpha')
  const duplicate = signed(); duplicate.deployTargets.push(structuredClone(alpha))
  reject(duplicate, selected(), 'alpha')
  const conflicting = signed(); conflicting.deployTargets[0].app = 'bravo'
  reject(conflicting, selected(), 'alpha')
  reject(signed(), selected(), 'alpha;rm -rf /')
})
test('denies empty, oversized or noncanonical target sets', () => {
  reject(signed(), { deployTargets: [] }, 'alpha')
  const many = signed(); many.deployTargets = Array.from({length:33},(_,i)=>({
    containerAppName: 'app'+i, image: image('alpha'),
  }))
  reject(many, selected(), 'alpha')
  const malformed = selected(); malformed.deployTargets[0].image = 'repo:latest'
  reject(signed(), malformed, 'alpha')
})

const SOURCE_SHA = 'c'.repeat(40)
const STAGING_RUN = '123456'
function provenanceFixture() {
  const manifest = signed()
  const raw = Buffer.from(JSON.stringify(manifest))
  const receipt = {
    schemaVersion: 1, verdict: 'OCI_PROVENANCE_VERIFIED',
    verifier: 'github_cli_sigstore', repository: 'anungis437/nzila-os',
    signerWorkflow: 'anungis437/nzila-os/.github/workflows/gitops-deploy.yml',
    sourceSha: SOURCE_SHA, stagingRunId: STAGING_RUN,
    manifestSha256: createHash('sha256').update(raw).digest('hex'),
    verifiedAt: '2026-11-01T23:00:00.000Z',
    targets: manifest.deployTargets.map(t => ({
      name: t.containerAppName, image: t.image, verifiedAttestations: 1,
      verifiedOutputSha256: 'd'.repeat(64),
    })),
  }
  return { raw, manifest, receipt }
}
const NOW = new Date('2026-11-01T23:10:00.000Z')
const denyProvenance = (raw,manifest,receipt,sha=SOURCE_SHA,run=STAGING_RUN) =>
  assert.throws(() => verifySelectionProvenance(raw,manifest,receipt,sha,run,NOW),
    /DEPLOY_SELECTION_DENIED/)

test('requires a current OCI verification receipt bound to exact staging bytes and all targets', () => {
  const {raw,manifest,receipt} = provenanceFixture()
  assert.deepEqual(verifySelectionProvenance(raw,manifest,receipt,SOURCE_SHA,STAGING_RUN,NOW),{
    manifestSha256: receipt.manifestSha256, verifiedCount: 2,
  })
  denyProvenance(Buffer.from(JSON.stringify({...manifest, source: 'substituted'})),manifest,receipt)
  denyProvenance(raw,manifest,{...receipt, sourceSha: 'f'.repeat(40)})
  denyProvenance(raw,manifest,{...receipt, stagingRunId: '123457'})
  denyProvenance(raw,manifest,{...receipt, verdict: 'PASS'})
  denyProvenance(raw,manifest,{...receipt, verifiedAt: '2026-10-31T00:00:00.000Z'})
  denyProvenance(raw,manifest,{...receipt, verifiedAt: '2026-11-02T00:00:00.000Z'})
  denyProvenance(raw,manifest,receipt,'f'.repeat(40))
  denyProvenance(raw,manifest,receipt,SOURCE_SHA,'123457')
})

test('rejects incomplete, forged, duplicated and unsigned OCI receipt target lists', () => {
  const {raw,manifest,receipt} = provenanceFixture()
  denyProvenance(raw,manifest,{...receipt, targets: receipt.targets.slice(0,1)})
  denyProvenance(raw,manifest,{...receipt, targets: [receipt.targets[0],receipt.targets[0]]})
  denyProvenance(raw,manifest,{...receipt, targets: receipt.targets.map((t,i) =>
    i === 0 ? {...t,image: image('bravo')} : t)})
  denyProvenance(raw,manifest,{...receipt, targets: receipt.targets.map((t,i) =>
    i === 0 ? {...t,verifiedAttestations:0} : t)})
  denyProvenance(raw,manifest,{...receipt, targets: receipt.targets.map((t,i) =>
    i === 0 ? {...t,verifiedOutputSha256:'not-a-digest'} : t)})
  denyProvenance(raw,manifest,{...receipt, targets: receipt.targets.map((t,i) =>
    i === 0 ? {...t,name:'unknown'} : t)})
})
