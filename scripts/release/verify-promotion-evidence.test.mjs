import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { canonical, computeSignedPayloadDigest, verifyPromotionEvidence } from './verify-promotion-evidence.mjs'

const COMMIT = 'a'.repeat(40)
const IMAGE = 'example.invalid/app@sha256:' + 'b'.repeat(64)
const hash = text => createHash('sha256').update(text).digest('hex')

function makeFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'nzila-promotion-test-'))
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const sbom = JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6',
    components: [{ name: 'test', version: '1' }] }) + '\n'
  const sbomDigest = hash(sbom)
  const now = new Date().toISOString()
  const manifest = { source_workflow: 'deploy-staging', commit_sha: COMMIT,
    attestation_ref: 'release-attestation.json', built_at: now, artifact_digest: sbomDigest,
    sbom_hash: sbomDigest, deployTargets: [{ name: 'demo', image: IMAGE }] }
  const attestation = { version: '2.0', commitSha: COMMIT,
    contractTestResult: 'pass', sloGateResult: 'pass', sbomDigest,
    secretScanSummary: { ran: true, clean: true, findings: 0 },
    trivySummary: { ran: true, critical: 0, high: 0, medium: 0, low: 0 },
    artifactDigests: [{ name: 'demo', digest: 'c'.repeat(64), fileCount: 1 }],
    lockfileHash: 'd'.repeat(64), timestamp: now, environment: 'staging' }
  function write() {
    const digest = computeSignedPayloadDigest(attestation)
    const signature = sign(null, Buffer.from(digest, 'hex'), privateKey).toString('hex')
    writeFileSync(join(directory, 'sbom.json'), sbom)
    writeFileSync(join(directory, 'artifact-manifest.json'), JSON.stringify(manifest))
    writeFileSync(join(directory, 'release-attestation.json'), JSON.stringify({
      ...attestation, attestationDigest: digest, signature,
    }))
  }
  write()
  return { directory, publicKeyPem, manifest, attestation, write,
    verify: () => verifyPromotionEvidence({ directory, expectedCommit: COMMIT, publicKeyPem }),
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
      directory: x.directory, expectedCommit: 'f'.repeat(40),
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
test('non-CycloneDX SBOM rejected', () => {
  const x = makeFixture()
  try {
    writeFileSync(join(x.directory, 'sbom.json'), '{}')
    assert.throws(() => x.verify(), /SBOM is empty/)
  } finally { x.cleanup() }
})
