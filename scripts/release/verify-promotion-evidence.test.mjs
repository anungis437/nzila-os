import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { canonical, computeSignedPayloadDigest, verifyPromotionEvidence } from './verify-promotion-evidence.mjs'

const COMMIT = 'a'.repeat(40)
const RUN = '123456'
const IMAGE = 'example.invalid/app@sha256:' + 'b'.repeat(64)
const hash = text => createHash('sha256').update(text).digest('hex')

function makeFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'nzila-promotion-test-'))
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const sbom = JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6',
    components: [{ name: 'test', version: '1' }] }) + '\n'
  const sbomDigest = hash(sbom)
  const sourceLockfilePath = join(directory, 'pnpm-lock.yaml')
  const lockfile = 'lockfileVersion: 9.0\n'
  writeFileSync(sourceLockfilePath, lockfile)
  const now = new Date().toISOString()
  const manifest = { source_workflow: 'deploy-staging', commit_sha: COMMIT,
    attestation_ref: 'release-attestation.json', built_at: now, run_id: RUN, artifact_digest: sbomDigest,
    sbom_hash: sbomDigest, deployTargets: [{ name: 'demo', image: IMAGE }] }
  const attestation = { version: '2.0', commitSha: COMMIT,
    stagingRunId: RUN, manifestDigest: hash(JSON.stringify(manifest)),
    contractTestResult: 'pass', sloGateResult: 'pass', sbomDigest,
    secretScanSummary: { ran: true, clean: true, findings: 0 },
    trivySummary: { ran: true, critical: 0, high: 0, medium: 0, low: 0 },
    artifactDigests: [{ name: 'demo', digest: 'c'.repeat(64), fileCount: 1 }],
    lockfileHash: hash(lockfile), timestamp: now, environment: 'staging' }
  function write() {
    attestation.manifestDigest = hash(JSON.stringify(manifest))
    const digest = computeSignedPayloadDigest(attestation)
    const signature = sign(null, Buffer.from(digest, 'hex'), privateKey).toString('hex')
    writeFileSync(join(directory, 'sbom.json'), sbom)
    writeFileSync(join(directory, 'artifact-manifest.json'), JSON.stringify(manifest))
    writeFileSync(join(directory, 'release-attestation.json'), JSON.stringify({
      ...attestation, attestationDigest: digest, signature,
    }))
  }
  write()
  return { directory, publicKeyPem, manifest, attestation, sourceLockfilePath, write,
    verify: () => verifyPromotionEvidence({ directory, expectedCommit: COMMIT, expectedRunId: RUN, publicKeyPem, sourceLockfilePath }),
    cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}
test('nested canonical hashing preserves modifications', () => {
  assert.notEqual(hash(JSON.stringify(canonical({ nested: { role: 'user' } }))),
    hash(JSON.stringify(canonical({ nested: { role: 'admin' } }))))
})
test('valid signed immutable promotion evidence passes', () => {
  const x = makeFixture()
  try { assert.equal(x.verify().commitSha, COMMIT) } finally { x.cleanup() }
})
test('tampered nested field is rejected even when outer JSON is valid', () => {
  const x = makeFixture()
  try {
    x.attestation.secretScanSummary.clean = false
    // Do not re-sign: existing signature must NOT be treated as valid.
    const good = JSON.parse(readFileSync(join(x.directory, 'release-attestation.json'), 'utf8'))
    good.secretScanSummary.clean = false
    writeFileSync(join(x.directory, 'release-attestation.json'), JSON.stringify(good))
    assert.throws(() => x.verify(), /unsigned or malformed attestation/)
  } finally { x.cleanup() }
})
test('wrong source commit is denied', () => {
  const x = makeFixture()
  try {
    assert.throws(() => verifyPromotionEvidence({
      directory: x.directory, expectedCommit: 'f'.repeat(40), expectedRunId: RUN,
      publicKeyPem: x.publicKeyPem,
    }), /source commit/)
  } finally { x.cleanup() }
})
test('blank or mutable deployment target is denied', () => {
  const x = makeFixture()
  try {
    x.manifest.deployTargets = [{ name: 'demo', image: 'repo/app:latest' }]
    x.write()
    assert.throws(() => x.verify(), /mutable/)
  } finally { x.cleanup() }
})
test('conflicting image aliases cannot hide a mutable deployment reference', () => {
  const x = makeFixture()
  try {
    x.manifest.deployTargets = [{ name: 'demo', image: IMAGE, imageRef: 'example.invalid/app:latest' }]
    x.write()
    assert.throws(() => x.verify(), /mutable or conflicting/)
    x.manifest.deployTargets = [{ name: 'demo', image: IMAGE, digest: 'example.invalid/other@sha256:' + 'f'.repeat(64) }]
    x.write()
    assert.throws(() => x.verify(), /mutable or conflicting/)
  } finally { x.cleanup() }
})
test('identical immutable aliases remain valid and malformed prefixed references are denied', () => {
  const x = makeFixture()
  try {
    x.manifest.deployTargets = [{ name: 'demo', image: IMAGE, imageRef: IMAGE }]
    x.write()
    assert.equal(x.verify().targetCount, 1)
    x.manifest.deployTargets = [{ name: 'demo', image: 'prefix?' + IMAGE }]
    x.write()
    assert.throws(() => x.verify(), /mutable or conflicting/)
  } finally { x.cleanup() }
})
test('duplicate signed deployment identities cannot choose different images for one destination', () => {
  const x = makeFixture()
  try {
    x.manifest.deployTargets = [
      { name: 'demo', image: IMAGE },
      { containerAppName: 'demo', image: 'example.invalid/other@sha256:' + 'f'.repeat(64) },
    ]
    x.write()
    assert.throws(() => x.verify(), /duplicated/)
  } finally { x.cleanup() }
})
test('conflicting target identity aliases are rejected before promotion', () => {
  const x = makeFixture()
  try {
    x.manifest.deployTargets = [{
      containerAppName: 'demo', app: 'other-destination', name: 'demo', image: IMAGE,
    }]
    x.write()
    assert.throws(() => x.verify(), /conflicting/)
    x.manifest.deployTargets = [{ containerAppName: 'demo', image: IMAGE }]
    x.write()
    assert.equal(x.verify().targetCount, 1)
    x.manifest.deployTargets = [{ name: 'demo\\nother', image: IMAGE }]
    x.write()
    assert.throws(() => x.verify(), /conflicting/)
  } finally { x.cleanup() }
})
test('signed destination identities must be canonical Azure Container App names', () => {
  const x = makeFixture()
  try {
    for (const name of [
      'demo\nother', 'demo\rother', 'demo\u0000evil', 'demo\u007fevil',
      'demo\\nother', 'Demo', 'demo/other', 'demo--other',
      '-demo', 'demo-', 'd', 'a'.repeat(33),
    ]) {
      x.manifest.deployTargets = [{ name, image: IMAGE }]
      x.write()
      assert.throws(() => x.verify(), /deployment target is absent, mutable or conflicting/, name)
    }
    x.manifest.deployTargets = [{ name: 'demo-prod-2', image: IMAGE }]
    x.write()
    assert.equal(x.verify().targetCount, 1)
  } finally { x.cleanup() }
})
test('non-CycloneDX SBOM rejected', () => {
  const x = makeFixture()
  try {
    writeFileSync(join(x.directory, 'sbom.json'), '{}')
    assert.throws(() => x.verify(), /SBOM is empty/)
  } finally { x.cleanup() }
})

test('substituted staging run ID is denied', () => {
  const x = makeFixture()
  try {
    assert.throws(() => verifyPromotionEvidence({
      directory: x.directory, expectedCommit: COMMIT,
      expectedRunId: '999999', publicKeyPem: x.publicKeyPem,
    }), /source commit or provenance/)
  } finally { x.cleanup() }
})
test('manifest target tampering is denied by signed manifest hash', () => {
  const x = makeFixture()
  try {
    const altered = { ...x.manifest, deployTargets: [{ name: 'demo', image: 'attacker.invalid/app@sha256:' + 'f'.repeat(64) }] }
    writeFileSync(join(x.directory, 'artifact-manifest.json'), JSON.stringify(altered))
    assert.throws(() => x.verify(), /source commit or provenance/)
  } finally { x.cleanup() }
})
test('signed but unsafe high-severity scan is denied', () => {
  const x = makeFixture()
  try {
    x.attestation.trivySummary.high = 1
    x.write()
    assert.throws(() => x.verify(), /mandatory recorded quality\/security proof absent/)
  } finally { x.cleanup() }
})
test('missing trusted staging run coordinate is denied', () => {
  const x = makeFixture()
  try {
    assert.throws(() => verifyPromotionEvidence({
      directory: x.directory, expectedCommit: COMMIT, publicKeyPem: x.publicKeyPem,
    }), /missing\/invalid trusted staging run ID/)
  } finally { x.cleanup() }
})

test('signed lockfile digest must match the independently checked-out source', () => {
  const x = makeFixture()
  try {
    writeFileSync(x.sourceLockfilePath, 'lockfileVersion: 9.0\\npackages: {}\\n')
    assert.throws(() => x.verify(), /signed lockfile hash does not match checked-out source/)
  } finally { x.cleanup() }
})
test('a correctly signed but forged lockfile hash cannot substitute source provenance', () => {
  const x = makeFixture()
  try {
    x.attestation.lockfileHash = 'f'.repeat(64)
    x.write()
    assert.throws(() => x.verify(), /signed lockfile hash does not match checked-out source/)
  } finally { x.cleanup() }
})
test('source lockfile path is mandatory and cannot be inferred from staging artifacts', () => {
  const x = makeFixture()
  try {
    assert.throws(() => verifyPromotionEvidence({
      directory: x.directory, expectedCommit: COMMIT, expectedRunId: RUN,
      publicKeyPem: x.publicKeyPem,
    }), /trusted source lockfile path unavailable/)
    assert.throws(() => verifyPromotionEvidence({
      directory: x.directory, expectedCommit: COMMIT, expectedRunId: RUN,
      publicKeyPem: x.publicKeyPem, sourceLockfilePath: join(x.directory, 'absent.yaml'),
    }), /trusted source lockfile unavailable/)
  } finally { x.cleanup() }
})
