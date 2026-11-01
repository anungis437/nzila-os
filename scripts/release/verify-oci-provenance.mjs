#!/usr/bin/env node
/** P0 #1038: live Sigstore/SLSA OCI verification; never grants release authority. */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = 'anungis437/nzila-os'
const SIGNER = REPO + '/.github/workflows/gitops-deploy.yml'
const IMAGE = /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/
const deny = message => { throw new Error('OCI_PROVENANCE_DENIED: ' + message) }

export function verifyOciProvenance({manifest, sourceSha, repository, verifier = execFileSync, now = new Date()}) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha ?? '') || repository !== REPO) deny('untrusted source identity')
  if (!Number.isFinite(now.getTime()) || !Array.isArray(manifest?.deployTargets) ||
      manifest.deployTargets.length === 0) deny('missing manifest or receipt time')
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
    if (seenNames.has(name) || seenImages.has(image)) deny('duplicate signed image or destination')
    seenNames.add(name); seenImages.add(image)
    const args = [
      'attestation','verify','oci://' + image,'--repo',REPO,
      '--signer-workflow',SIGNER,'--source-digest',sourceSha,
      '--source-ref','refs/heads/main','--deny-self-hosted-runners','--format','json',
    ]
    let evidence
    try {
      evidence = JSON.parse(String(verifier('gh', args, {
        encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,maxBuffer:2097152,
      })))
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
    targets.push({name,image,verifiedAttestations:evidence.length})
  }
  return {
    schemaVersion:1,verdict:'OCI_PROVENANCE_VERIFIED',
    verifier:'github_cli_sigstore',repository:REPO,signerWorkflow:SIGNER,
    sourceSha,verifiedAt:now.toISOString(),targets,
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [manifestPath,sourceSha,repository,receiptPath] = process.argv.slice(2)
    if (!manifestPath || !receiptPath) deny('signed manifest and exclusive receipt required')
    const manifest = JSON.parse(readFileSync(manifestPath,'utf8'))
    const receipt = verifyOciProvenance({manifest,sourceSha,repository})
    writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600})
    console.log('Verified independent OCI provenance for '+receipt.targets.length+' target(s)')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'OCI provenance verification failed')
    process.exitCode=1
  }
}
