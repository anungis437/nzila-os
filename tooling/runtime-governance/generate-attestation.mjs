#!/usr/bin/env node
/** Emit the canonical runtime attestation schema, bound to actual artifact bytes. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  citedEvidence, releaseIdentity, requireEnv, validateAttestation,
} from './contracts.mjs'

try {
  const className = process.argv.find((arg) => arg.startsWith('--class='))?.slice('--class='.length)
  const release = releaseIdentity()
  const environment = requireEnv('NZILA_ENVIRONMENT_CLASS')
  const product = requireEnv('NZILA_PRODUCT')
  const issuer = requireEnv('NZILA_ATTESTATION_ISSUER')
  const rationale = requireEnv('NZILA_ATTESTATION_RATIONALE')
  const issuedAt = new Date().toISOString()
  const envelope = validateAttestation({
    id: `att.${className}.${release.releaseId}.${Date.now()}`,
    schemaVersion: '1.0.0',
    class: className,
    releaseId: release.releaseId,
    environment,
    subject: { kind: 'release', id: `${product}:${release.commitSha}` },
    verdict: process.env.NZILA_ATTESTATION_VERDICT || 'unverified',
    rationale: `${rationale} Manifest: ${release.manifestHash}; builtAt: ${release.builtAt}.`,
    citedEvidence: citedEvidence(),
    issuedBy: issuer,
    issuedAt,
    window: { start: release.builtAt, end: issuedAt },
  })
  if (Date.parse(envelope.window.start) > Date.parse(envelope.window.end)) {
    throw new Error('attestation window starts in the future')
  }
  const directory = resolve(process.cwd(), 'proof-artifacts', 'attestations', release.releaseId)
  mkdirSync(directory, { recursive: true })
  const path = resolve(directory, `${envelope.class}.json`)
  writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`runtime-governance/generate-attestation: wrote ${path} verdict=${envelope.verdict}\n`)
} catch (error) {
  process.stderr.write(`runtime-governance/generate-attestation: ${error.message}\n`)
  process.exitCode = 2
}
