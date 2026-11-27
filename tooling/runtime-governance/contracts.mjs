import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tsImport } from 'tsx/esm/api'

// Share the actual consumer schemas and canonical payload hash. The frozen
// workspace installation supplies tsx to these Node ESM entry points.
export const { validateAttestation } = await tsImport(
  '../../packages/runtime-attestation/src/attestation.ts', import.meta.url,
)
export const { ledgerRecordSchema } = await tsImport(
  '../../packages/runtime-attestation/src/ledger.ts', import.meta.url,
)
export const { computeContentHash } = await tsImport(
  '../../packages/runtime-attestation/src/content-hash.ts', import.meta.url,
)
const { readReleaseIdentityFromEnv } = await tsImport(
  '../../packages/governance-runtime/src/release-identity.ts', import.meta.url,
)

export function requireEnv(name) {
  const value = process.env[name]
  if (!value?.trim()) throw new Error(`missing env var ${name}`)
  return value
}

export function safeIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}$/.test(value)) {
    throw new Error(`${label} must be a safe artifact identifier`)
  }
  return value
}

export function releaseIdentity() {
  const identity = readReleaseIdentityFromEnv()
  safeIdentifier(identity.releaseId, 'releaseId')
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(identity.commitSha)) {
    throw new Error('NZILA_COMMIT_SHA must be a full Git object identifier')
  }
  if (!/^sha256[-:][a-f0-9]{64}$/i.test(identity.manifestHash)) {
    throw new Error('NZILA_MANIFEST_HASH must be an actual SHA-256 digest')
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(identity.builtAt)) {
    throw new Error('NZILA_BUILT_AT must be an ISO timestamp')
  }
  const day = identity.builtAt.slice(0, 10)
  if (new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('NZILA_BUILT_AT must contain a valid calendar date')
  }
  return identity
}

function artifactBytes(id) {
  const file = id.startsWith('file:') ? fileURLToPath(id) : id
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(file)) {
    throw new Error(`evidence must resolve to a local artifact: ${id}`)
  }
  if (!statSync(file).isFile()) throw new Error(`evidence is not a regular file: ${id}`)
  return readFileSync(file)
}

export function artifactHash(id) {
  return `sha256-${createHash('sha256').update(artifactBytes(id)).digest('hex')}`
}

export function citedEvidence() {
  const ids = requireEnv('NZILA_ATTESTATION_EVIDENCE').split(',').map((id) => id.trim())
  if (ids.some((id) => !id)) throw new Error('evidence references must not be empty')
  return [...new Set(ids)].map((id) => ({
    id, contentHash: artifactHash(id), description: 'Local qualification artifact',
  }))
}

export function verifyCitedEvidence(attestation) {
  for (const evidence of attestation.citedEvidence) {
    if (artifactHash(evidence.id) !== evidence.contentHash) {
      throw new Error(`evidence content hash mismatch: ${evidence.id}`)
    }
  }
}
