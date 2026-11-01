#!/usr/bin/env node
/** P0 #1038: live Sigstore/SLSA OCI verification; never grants release authority. */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = 'anungis437/nzila-os'
const SIGNER = REPO + '/.github/workflows/gitops-deploy.yml'
const IMAGE = /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/
const deny = message => { throw new Error('OCI_PROVENANCE_DENIED: ' + message) }
const canonicalUtcTimestamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value


export function verifyOciProvenance({manifestRaw, sourceSha, repository, stagingRunId, verifier = execFileSync, now = new Date()}) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || repository !== REPO) deny('untrusted source identity')
  // Bind the receipt to EXACT signed staging bytes, not reserialized JSON.
  if (typeof manifestRaw !== 'string' && !Buffer.isBuffer(manifestRaw)) deny('signed manifest bytes required')
  const bytes = Buffer.from(manifestRaw)
  if (bytes.length < 2 || bytes.length > 2_097_152) deny('signed manifest size out of bounds')
  let manifest
  try { manifest = JSON.parse(bytes.toString('utf8')) }
  catch { deny('malformed signed staging manifest') }
  if (!/^[1-9][0-9]{0,19}$/.test(stagingRunId ?? '') ||
      manifest?.source_workflow !== 'deploy-staging' ||
      manifest.commit_sha !== sourceSha ||
      manifest.run_id !== stagingRunId ||
      manifest.attestation_ref !== 'release-attestation.json') {
    deny('signed staging manifest source/run mismatch')
  }
  const current = now.getTime()
  const builtAt = canonicalUtcTimestamp(manifest.built_at) ? Date.parse(manifest.built_at) : NaN
  if (!Number.isFinite(current) || !Number.isFinite(builtAt) ||
      builtAt > current + 5 * 60_000 ||
      builtAt < current - 7 * 24 * 60 * 60_000) {
    deny('signed staging manifest build time is missing, stale or from future')
  }
  if (!Array.isArray(manifest.deployTargets) ||
      manifest.deployTargets.length === 0) deny('missing manifest deployment targets')
  const seenNames = new Set(), seenImages = new Set(), targets = []
  for (const target of manifest.deployTargets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) deny('malformed target')
    const names = ['containerAppName','app','name']
      .filter(k => target[k] !== null && target[k] !== undefined).map(k => target[k])
    const images = ['image','imageRef','digest']
      .filter(k => target[k] !== null && target[k] !== undefined).map(k => target[k])
    if (!names.length || names.some(x => typeof x !== 'string') ||
        new Set(names).size !== 1 || !images.length ||
        new Set(images).size !== 1 || !IMAGE.test(images[0])) deny('conflicting or noncanonical OCI target')
    const name = names[0], image = images[0]
    // The promotion verifier and Azure deployer require canonical Container App
    // identities. Reject signed lookalikes, shell metacharacters and aliases
    // before minting a positive OCI receipt for a different destination.
    if (!/^[a-z](?!.*--)[a-z0-9-]{0,30}[a-z0-9]$/.test(name)) {
      deny('noncanonical OCI deployment destination')
    }
    if (seenNames.has(name) || seenImages.has(image)) deny('duplicate signed image or destination')
    seenNames.add(name); seenImages.add(image)
    const args = [
      'attestation','verify','oci://' + image,'--repo',REPO,
      '--signer-workflow',SIGNER,'--source-digest',sourceSha,
      '--source-ref','refs/heads/main','--deny-self-hosted-runners','--format','json',
    ]
    let evidence, verifiedOutput
    try {
      verifiedOutput = String(verifier('gh', args, {
        encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,maxBuffer:2097152,
      }))
      evidence = JSON.parse(verifiedOutput)
    } catch { deny('live GitHub/Sigstore verification unavailable for ' + name) }
    const [subject, digest] = image.split('@sha256:')
    if (!Array.isArray(evidence) || !evidence.some(item => {
      const v = item?.verificationResult
      return Boolean(v?.signature?.certificate) &&
        Array.isArray(v.verifiedTimestamps) && v.verifiedTimestamps.length > 0 &&
        v.statement?.predicateType === 'https://slsa.dev/provenance/v1' &&
        Array.isArray(v.statement.subject) &&
        v.statement.subject.some(s => s?.name === subject && s?.digest?.sha256 === digest)
    })) deny('cryptographically verified OCI subject or witness missing for ' + name)
    targets.push({name,image,verifiedAttestations:evidence.length,
      verifiedOutputSha256:createHash('sha256').update(verifiedOutput).digest('hex')})
  }
  return {
    schemaVersion:1,verdict:'OCI_PROVENANCE_VERIFIED',
    verifier:'github_cli_sigstore',repository:REPO,signerWorkflow:SIGNER,
    sourceSha,stagingRunId,manifestSha256:createHash('sha256').update(bytes).digest('hex'),
    verifiedAt:now.toISOString(),targets,
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [manifestPath,sourceSha,repository,receiptPath,stagingRunId] = process.argv.slice(2)
    if (!manifestPath || !receiptPath || !stagingRunId) deny('signed manifest, staging run and exclusive receipt required')
    const manifestRaw = readFileSync(manifestPath)
    const receipt = verifyOciProvenance({manifestRaw,sourceSha,repository,stagingRunId})
    writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600})
    console.log('Verified independent OCI provenance for '+receipt.targets.length+' target(s)')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'OCI provenance verification failed')
    process.exitCode=1
  }
}
