#!/usr/bin/env node
/** #1038: fail closed if production omits or substitutes an approved signed target. */
import { createHash } from 'node:crypto'
import { readBoundedPromotionArtifact } from './verify-promotion-evidence.mjs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const deny = message => { throw new Error('DEPLOY_SELECTION_DENIED: ' + message) }
const NAME = /^[a-z](?!.*--)[a-z0-9-]{0,30}[a-z0-9]$/
const IMAGE = /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

function indexedTargets(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      !Array.isArray(manifest.deployTargets) || !manifest.deployTargets.length ||
      manifest.deployTargets.length > 32) deny('invalid signed or selected target set')
  const indexed = new Map()
  for (const target of manifest.deployTargets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) deny('malformed target')
    const ids = ['containerAppName', 'app', 'name']
      .filter(key => target[key] !== null && target[key] !== undefined)
      .map(key => target[key])
    const images = ['image', 'imageRef', 'digest']
      .filter(key => target[key] !== null && target[key] !== undefined)
      .map(key => target[key])
    if (!ids.length || ids.some(id => typeof id !== 'string' || !NAME.test(id)) ||
        new Set(ids).size !== 1 || !images.length ||
        images.some(image => typeof image !== 'string' || !IMAGE.test(image)) ||
        new Set(images).size !== 1 || indexed.has(ids[0])) deny('ambiguous signed target')
    indexed.set(ids[0], target)
  }
  return indexed
}

export function verifyDeploySelection(signedManifest, filteredManifest, approvedCsv) {
  if (typeof approvedCsv !== 'string') deny('approved target input missing')
  const approved = approvedCsv.split(',')
  if (!approved.length || approved.length > 32 ||
      approved.some(name => !NAME.test(name)) ||
      new Set(approved).size !== approved.length) deny('approved target identities invalid or duplicated')
  const signed = indexedTargets(signedManifest)
  const selected = indexedTargets(filteredManifest)
  if (selected.size !== approved.length) deny('approved target count does not match selection')
  for (const name of approved) {
    if (!signed.has(name) || !selected.has(name) ||
        !equal(signed.get(name), selected.get(name))) {
      deny('approved target absent or modified relative to signed staging manifest: ' + name)
    }
  }
  return Object.freeze({ approvedCount: approved.length, names: Object.freeze([...approved]) })
}

/**
 * The OCI verifier writes a run-scoped receipt before the production deploy
 * step. Rebind the EXACT staging manifest bytes and every signed target to
 * that receipt at the final selection boundary. A passing prior step alone
 * cannot authorize a manifest substituted between verification and deploy.
 * This is local continuity checking, NOT independent release authorization.
 */
export function verifySelectionProvenance(manifestRaw, signedManifest, receipt, sourceSha, stagingRunId, now = new Date()) {
  if (!Buffer.isBuffer(manifestRaw) || manifestRaw.length < 2 || manifestRaw.length > 2_097_152 ||
      typeof sourceSha !== 'string' || !/^[0-9a-f]{40}$/.test(sourceSha) ||
      typeof stagingRunId !== 'string' || !/^[1-9][0-9]*$/.test(stagingRunId) ||
      !Number.isSafeInteger(Number(stagingRunId)) || !Number.isFinite(now?.getTime?.())) {
    deny('trusted provenance coordinates or manifest bytes invalid')
  }
  const digest = createHash('sha256').update(manifestRaw).digest('hex')
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
      receipt.schemaVersion !== 1 || receipt.verdict !== 'OCI_PROVENANCE_VERIFIED' ||
      receipt.verifier !== 'github_cli_sigstore' ||
      receipt.repository !== 'anungis437/nzila-os' ||
      receipt.signerWorkflow !== 'anungis437/nzila-os/.github/workflows/gitops-deploy.yml' ||
      receipt.sourceSha !== sourceSha || receipt.stagingRunId !== stagingRunId ||
      receipt.manifestSha256 !== digest || !Array.isArray(receipt.targets)) {
    deny('OCI receipt does not bind exact signed staging bytes and source run')
  }
  const verifiedAt = Date.parse(receipt.verifiedAt ?? '')
  if (!Number.isFinite(verifiedAt) || verifiedAt > now.getTime() + 300_000 ||
      verifiedAt < now.getTime() - 4 * 60 * 60_000) {
    deny('OCI receipt verification time is missing, stale or from future')
  }
  const signed = indexedTargets(signedManifest)
  if (receipt.targets.length !== signed.size) deny('OCI receipt target count mismatch')
  const verified = new Map()
  const images = new Set()
  for (const item of receipt.targets) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.name !== 'string' || !NAME.test(item.name) ||
        typeof item.image !== 'string' || !IMAGE.test(item.image) ||
        !Number.isSafeInteger(item.verifiedAttestations) || item.verifiedAttestations < 1 ||
        typeof item.verifiedOutputSha256 !== 'string' ||
        !/^[0-9a-f]{64}$/.test(item.verifiedOutputSha256) ||
        verified.has(item.name) || images.has(item.image)) {
      deny('OCI receipt contains missing, duplicate or unverified subject')
    }
    verified.set(item.name, item.image)
    images.add(item.image)
  }
  for (const [name, target] of signed) {
    const image = target.image ?? target.imageRef ?? target.digest
    if (verified.get(name) !== image) {
      deny('OCI receipt subject differs from signed staging target: ' + name)
    }
  }
  return Object.freeze({ manifestSha256: digest, verifiedCount: verified.size })
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [signedPath, selectedPath, approvedCsv, receiptPath, sourceSha, stagingRunId] = process.argv.slice(2)
    if (!signedPath || !selectedPath || !approvedCsv || !receiptPath || !sourceSha || !stagingRunId) {
      deny('signed, selected, approved and independently verified OCI receipt inputs required')
    }
    // Descriptor-based bounded reads reject symlinks, special files and
    // concurrent mutation before any JSON parsing or digest comparison.
    const signedRaw = readBoundedPromotionArtifact(signedPath, 2_097_152, 'signed staging manifest')
    const selectedRaw = readBoundedPromotionArtifact(selectedPath, 2_097_152, 'selected production manifest')
    const receiptRaw = readBoundedPromotionArtifact(receiptPath, 1_048_576, 'OCI provenance receipt')
    const signed = JSON.parse(signedRaw.toString('utf8'))
    const selected = JSON.parse(selectedRaw.toString('utf8'))
    const receipt = JSON.parse(receiptRaw.toString('utf8'))
    verifySelectionProvenance(signedRaw, signed, receipt, sourceSha, stagingRunId)
    const result = verifyDeploySelection(signed, selected, approvedCsv)
    // Only machine-readable verified bytes go to stdout. The deployment
    // process must hash-check the SAME filtered bytes at its own read boundary.
    console.error('Exact signed-to-approved production selection verified for ' + result.approvedCount + ' target(s)')
    process.stdout.write(createHash('sha256').update(selectedRaw).digest('hex') + '\n')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'production selection verification failed')
    process.exitCode = 1
  }
}
