#!/usr/bin/env node
/**
 * P0 production promotion: cryptographic evidence gate, fail closed.
 * This is not a grant of release authority: the GitHub production environment
 * still requires its own human approval and protected deployment identity.
 */
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, createPublicKey, verify } from 'node:crypto'
import { pathToFileURL } from 'node:url'

function deny(message) { throw new Error('PROMOTION_EVIDENCE_DENIED: ' + message) }
const canonicalUtcTimestamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value

// Run IDs are canonical decimal strings at the CLI boundary. Reject numeric
// coercion, leading zeros and IDs outside JavaScript safe integer precision.
const canonicalRunId = value => typeof value === 'string' &&
  /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) &&
  Number(value) > 0

function sha256(buf) { return createHash('sha256').update(buf).digest('hex') }
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}
export function computeSignedPayloadDigest(attestation) {
  const { signature, attestationDigest, ...payload } = attestation
  return sha256(Buffer.from(JSON.stringify(canonical(payload))))
}
export function verifyPromotionEvidence({ directory, expectedCommit, expectedRunId, publicKeyPem, sourceLockfilePath, now = new Date() }) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit ?? '')) deny('missing/invalid expected commit SHA')
  if (!canonicalRunId(expectedRunId)) deny('missing/invalid trusted staging run ID')
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) deny('independently provisioned verification key unavailable')
  // A 512-bit RSA key produces a 64-byte signature, the same length as
  // Ed25519. Signature length and crypto.verify() alone do not enforce the
  // release contract: reject an otherwise valid RSA-512 forgery.
  let verificationKey
  try { verificationKey = createPublicKey(publicKeyPem) }
  catch { deny('invalid independent attestation verification key') }
  if (verificationKey.asymmetricKeyType !== 'ed25519') {
    deny('attestation verification key must be Ed25519')
  }
  const load = name => {
    let raw
    try { raw = readFileSync(join(directory, name)) } catch { deny('missing ' + name) }
    let obj
    try { obj = JSON.parse(raw.toString('utf8')) } catch { deny('malformed ' + name) }
    return { obj, raw }
  }
  const manifestFile = load('artifact-manifest.json')
  const manifest = manifestFile.obj
  const sbom = load('sbom.json')
  const attestation = load('release-attestation.json').obj
  if (manifest.source_workflow !== 'deploy-staging' ||
      manifest.commit_sha !== expectedCommit ||
      attestation.commitSha !== expectedCommit ||
      !canonicalRunId(manifest.run_id) || manifest.run_id !== expectedRunId ||
      !canonicalRunId(attestation.stagingRunId) || attestation.stagingRunId !== expectedRunId ||
      attestation.manifestDigest !== sha256(manifestFile.raw) ||
      manifest.attestation_ref !== 'release-attestation.json' ||
      attestation.version !== '2.0' ||
      attestation.environment !== 'staging') deny('source commit or provenance does not match')
  // A signed hash of syntactically valid JSON is not proof of a usable SBOM.
  // Reject placeholder components, missing package identities and ambiguous
  // bom-ref collisions before accepting this as release evidence.
  const components = sbom.obj?.components
  const refs = Array.isArray(components)
    ? components.filter(component => typeof component?.['bom-ref'] === 'string')
        .map(component => component['bom-ref'])
    : []
  if (sbom.obj?.bomFormat !== 'CycloneDX' ||
      typeof sbom.obj.specVersion !== 'string' ||
      !/^1\.(?:[4-9]|[1-9][0-9]+)$/.test(sbom.obj.specVersion) ||
      !Array.isArray(components) || components.length === 0 ||
      components.some(component =>
        !component || typeof component !== 'object' || Array.isArray(component) ||
        typeof component.type !== 'string' || !component.type.trim() ||
        typeof component.name !== 'string' || !component.name.trim() ||
        (component['bom-ref'] !== undefined &&
          (typeof component['bom-ref'] !== 'string' || !component['bom-ref'].trim()))) ||
      new Set(refs).size !== refs.length) {
    deny('SBOM is empty, ambiguous or not a valid populated CycloneDX document')
  }
  const sbomDigest = sha256(sbom.raw)
  if (manifest.artifact_digest !== sbomDigest ||
      manifest.sbom_hash !== sbomDigest ||
      attestation.sbomDigest !== sbomDigest) deny('SBOM digest mismatch')
  const digest = computeSignedPayloadDigest(attestation)
  if (digest !== attestation.attestationDigest ||
      !/^[0-9a-f]{128}$/i.test(attestation.signature ?? '')) deny('unsigned or malformed attestation')
  let valid = false
  try {
    valid = verify(null, Buffer.from(digest, 'hex'), verificationKey, Buffer.from(attestation.signature, 'hex'))
  } catch { valid = false }
  if (!valid) deny('attestation signature verification failed')
  // A signed report with negative, fractional or unsafe severity counts is
  // not valid scan evidence, even if critical and high happen to equal zero.
  const scan = attestation.trivySummary
  const validCount = value => Number.isSafeInteger(value) && value >= 0
  if (attestation.contractTestResult !== 'pass' ||
      attestation.sloGateResult !== 'pass' ||
      attestation.secretScanSummary?.ran !== true ||
      attestation.secretScanSummary?.clean !== true ||
      !validCount(attestation.secretScanSummary?.findings) ||
      attestation.secretScanSummary.findings !== 0 ||
      scan?.ran !== true ||
      !['critical', 'high', 'medium', 'low'].every(key => validCount(scan[key])) ||
      scan.critical !== 0 || scan.high !== 0) {
    deny('mandatory recorded quality/security proof absent')
  }
  // A signed bundle list is still ambiguous when it repeats an identity:
  // downstream consumers may select the first or last digest for the same
  // name. Require unique, canonical names and safe positive file counts.
  const bundles = attestation.artifactDigests
  if (!/^[0-9a-f]{64}$/i.test(attestation.lockfileHash ?? '') ||
      !Array.isArray(bundles) || !bundles.length ||
      bundles.some(x => !x || typeof x !== 'object' || Array.isArray(x) ||
        typeof x.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(x.name) ||
        !Number.isSafeInteger(x.fileCount) || x.fileCount < 1 ||
        !/^[0-9a-f]{64}$/i.test(x.digest ?? '')) ||
      new Set(bundles.map(x => x.name)).size !== bundles.length) {
    deny('incomplete or ambiguous source/bundle digest evidence')
  }
  // A signed lockfileHash is not source provenance unless it matches the
  // independently checked-out Git commit being promoted. The production
  // workflow checks out GITHUB_SHA, which is separately matched to staging.
  // Refuse missing or unreadable source material; do not trust a supplied
  // hash or the staging artifact to define the expected source lockfile.
  if (typeof sourceLockfilePath !== 'string' || !sourceLockfilePath) {
    deny('trusted source lockfile path unavailable')
  }
  let actualLockfileHash
  try {
    actualLockfileHash = sha256(readFileSync(sourceLockfilePath))
  } catch {
    deny('trusted source lockfile unavailable')
  }
  if (actualLockfileHash !== attestation.lockfileHash) {
    deny('signed lockfile hash does not match checked-out source')
  }
  const stagedAt = canonicalUtcTimestamp(manifest.built_at) ? Date.parse(manifest.built_at) : NaN
  const attestedAt = canonicalUtcTimestamp(attestation.timestamp) ? Date.parse(attestation.timestamp) : NaN
  const current = now.getTime()
  const ttl = 7 * 24 * 60 * 60_000
  if (!Number.isFinite(stagedAt) || !Number.isFinite(attestedAt) ||
      stagedAt > current + 5 * 60_000 || attestedAt > current + 5 * 60_000 ||
      stagedAt < current - ttl || attestedAt < current - ttl) deny('staging evidence stale or from future')
  // The attestation must follow the build it signs, within a bounded window.
  // A valid signature over impossible chronology is not source provenance.
  if (attestedAt < stagedAt || attestedAt - stagedAt > 60 * 60_000) {
    deny('signed attestation chronology does not follow staging build')
  }
  // A target may carry multiple historical aliases. Checking only the
  // first truthy alias lets an immutable image mask a conflicting mutable
  // imageRef/digest that a downstream deployer might actually consume.
  // Require every supplied alias to be the same complete immutable reference.
  // The signed staging manifest must identify only the canonical Azure
  // registry and immutable image subjects that the independent OCI verifier
  // can attest. A signed foreign registry is not a promotable Nzila image.
  const pinned = ref => typeof ref === 'string' &&
    /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/.test(ref)
  // The production deployer resolves target identity by containerAppName,
  // then app, then name. Reject conflicting aliases and duplicate resolved
  // identities: otherwise a signed manifest can describe two images for the
  // same destination and a later selector may silently choose a different one.
  // Azure Container Apps destinations are canonical lowercase resource names.
  // Reject control characters, escapes, lookalikes, and ambiguous aliases even
  // when the manifest itself carries a valid signature.
  const canonicalContainerAppName = id => typeof id === 'string' &&
    /^[a-z](?!.*--)[a-z0-9-]{0,30}[a-z0-9]$/.test(id)
  const seenTargets = new Set(), seenImages = new Set()
  // The independent OCI verifier has the same bounded target budget. Refuse
  // an oversized signed manifest before accepting promotion evidence.
  if (Array.isArray(manifest.deployTargets) && manifest.deployTargets.length > 32) {
    deny('signed deployment target count exceeds 32')
  }
  if (!Array.isArray(manifest.deployTargets) || !manifest.deployTargets.length ||
      manifest.deployTargets.some(target => {
        if (!target || typeof target !== 'object' || Array.isArray(target)) return true
        const identities = ['containerAppName', 'app', 'name']
          .filter(key => target[key] !== undefined && target[key] !== null)
          .map(key => target[key])
        if (!identities.length || identities.some(id =>
          !canonicalContainerAppName(id)) || new Set(identities).size !== 1) return true
        const identity = identities[0]
        if (seenTargets.has(identity)) return true
        seenTargets.add(identity)
        const refs = ['image', 'imageRef', 'digest']
          .filter(key => target[key] !== undefined && target[key] !== null)
          .map(key => target[key])
        if (refs.length === 0 || refs.some(ref => !pinned(ref)) ||
            new Set(refs).size !== 1) return true
        // A single image must not be silently promoted under multiple
        // destinations; this matches the independently verified OCI contract.
        if (seenImages.has(refs[0])) return true
        seenImages.add(refs[0])
        return false
      })) deny('deployment target is absent, mutable or conflicting (including duplicated identities)')
  return {
    commitSha: expectedCommit,
    attestationDigest: digest,
    sbomDigest,
    targetCount: manifest.deployTargets.length,
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const directory = process.argv[2]
  const expectedCommit = process.argv[3]
  try {
    const result = verifyPromotionEvidence({
      directory, expectedCommit, expectedRunId: process.argv[4],
      publicKeyPem: process.env.ATTESTATION_VERIFY_PUBLIC_KEY,
      sourceLockfilePath: resolve('pnpm-lock.yaml'),
    })
    console.log('Signed staging evidence verified for ' + result.commitSha)
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  }
}
