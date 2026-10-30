#!/usr/bin/env node
/**
 * P0 production promotion: cryptographic evidence gate, fail closed.
 * This is not a grant of release authority: the GitHub production environment
 * still requires its own human approval and protected deployment identity.
 */
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, verify } from 'node:crypto'
import { pathToFileURL } from 'node:url'

function deny(message) { throw new Error('PROMOTION_EVIDENCE_DENIED: ' + message) }
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
export function verifyPromotionEvidence({ directory, expectedCommit, expectedRunId, publicKeyPem, now = new Date() }) {
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit ?? '')) deny('missing/invalid expected commit SHA')
  if (!/^[1-9][0-9]*$/.test(String(expectedRunId ?? ''))) deny('missing/invalid trusted staging run ID')
  if (!publicKeyPem || !publicKeyPem.includes('BEGIN PUBLIC KEY')) deny('independently provisioned verification key unavailable')
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
      String(manifest.run_id) !== String(expectedRunId) ||
      String(attestation.stagingRunId) !== String(expectedRunId) ||
      attestation.manifestDigest !== sha256(manifestFile.raw) ||
      manifest.attestation_ref !== 'release-attestation.json' ||
      attestation.version !== '2.0' ||
      attestation.environment !== 'staging') deny('source commit or provenance does not match')
  if (sbom.obj.bomFormat !== 'CycloneDX' ||
      typeof sbom.obj.specVersion !== 'string' ||
      !Array.isArray(sbom.obj.components) ||
      sbom.obj.components.length === 0) deny('SBOM is empty or not a valid populated CycloneDX document')
  const sbomDigest = sha256(sbom.raw)
  if (manifest.artifact_digest !== sbomDigest ||
      manifest.sbom_hash !== sbomDigest ||
      attestation.sbomDigest !== sbomDigest) deny('SBOM digest mismatch')
  const digest = computeSignedPayloadDigest(attestation)
  if (digest !== attestation.attestationDigest ||
      !/^[0-9a-f]{128}$/i.test(attestation.signature ?? '')) deny('unsigned or malformed attestation')
  let valid = false
  try {
    valid = verify(null, Buffer.from(digest, 'hex'), publicKeyPem, Buffer.from(attestation.signature, 'hex'))
  } catch { valid = false }
  if (!valid) deny('attestation signature verification failed')
  if (attestation.contractTestResult !== 'pass' ||
      attestation.sloGateResult !== 'pass' ||
      attestation.secretScanSummary?.ran !== true ||
      attestation.secretScanSummary?.clean !== true ||
      attestation.secretScanSummary?.findings !== 0 ||
      attestation.trivySummary?.ran !== true ||
      attestation.trivySummary?.critical !== 0 ||
      attestation.trivySummary?.high !== 0) deny('mandatory recorded quality/security proof absent')
  if (!/^[0-9a-f]{64}$/i.test(attestation.lockfileHash ?? '') ||
      !Array.isArray(attestation.artifactDigests) ||
      !attestation.artifactDigests.length ||
      attestation.artifactDigests.some(x => !x.name || !Number.isInteger(x.fileCount) ||
        x.fileCount < 1 || !/^[0-9a-f]{64}$/i.test(x.digest ?? ''))) {
    deny('incomplete source/bundle digest evidence')
  }
  const stagedAt = Date.parse(manifest.built_at ?? '')
  const attestedAt = Date.parse(attestation.timestamp ?? '')
  const current = now.getTime()
  const ttl = 7 * 24 * 60 * 60_000
  if (!Number.isFinite(stagedAt) || !Number.isFinite(attestedAt) ||
      stagedAt > current + 5 * 60_000 || attestedAt > current + 5 * 60_000 ||
      stagedAt < current - ttl || attestedAt < current - ttl) deny('staging evidence stale or from future')
  // A target may carry multiple historical aliases. Checking only the
  // first truthy alias lets an immutable image mask a conflicting mutable
  // imageRef/digest that a downstream deployer might actually consume.
  // Require every supplied alias to be the same complete immutable reference.
  const pinned = ref => typeof ref === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[0-9a-f]{64}$/i.test(ref)
  // The production deployer resolves target identity by containerAppName,
  // then app, then name. Reject conflicting aliases and duplicate resolved
  // identities: otherwise a signed manifest can describe two images for the
  // same destination and a later selector may silently choose a different one.
  const seenTargets = new Set()
  if (!Array.isArray(manifest.deployTargets) || !manifest.deployTargets.length ||
      manifest.deployTargets.some(target => {
        if (!target || typeof target !== 'object' || Array.isArray(target)) return true
        const identities = ['containerAppName', 'app', 'name']
          .filter(key => target[key] !== undefined && target[key] !== null)
          .map(key => target[key])
        if (!identities.length || identities.some(id =>
          typeof id !== 'string' || !id.trim() || id !== id.trim() ||
          /[\\x00-\\x1f\\x7f]/.test(id)) || new Set(identities).size !== 1) return true
        const identity = identities[0]
        if (seenTargets.has(identity)) return true
        seenTargets.add(identity)
        const refs = ['image', 'imageRef', 'digest']
          .filter(key => target[key] !== undefined && target[key] !== null)
          .map(key => target[key])
        return refs.length === 0 || refs.some(ref => !pinned(ref)) ||
          new Set(refs).size !== 1
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
    })
    console.log('Signed staging evidence verified for ' + result.commitSha)
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  }
}
