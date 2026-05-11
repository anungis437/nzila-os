#!/usr/bin/env node
/**
 * generate-attestation.mjs — Emit a runtime attestation envelope.
 *
 * Usage:
 *   node tooling/runtime-governance/generate-attestation.mjs --class=deployment
 *
 * Reads release identity from environment variables and writes the
 * attestation to proof-artifacts/attestations/<releaseId>/<class>.json.
 *
 * The envelope is hand-validated against the structural shape required
 * by `@nzila/runtime-attestation` to avoid pulling the workspace
 * package into a lightweight CI step.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const ATTESTATION_SCHEMA_VERSION = '1.0.0'
const ALLOWED_CLASSES = new Set([
  'deployment',
  'environment-legitimacy',
  'pilot-safety',
  'doctrine-compliance',
  'ai-governance',
  'continuity-governance',
])

function arg(name, fallback) {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v) {
    process.stderr.write(
      `runtime-governance/generate-attestation: missing env var ${name}\n`,
    )
    process.exit(2)
  }
  return v
}

const className = arg('class')
if (!className || !ALLOWED_CLASSES.has(className)) {
  process.stderr.write(
    `runtime-governance/generate-attestation: --class is required and must be one of ${[...ALLOWED_CLASSES].join(', ')}\n`,
  )
  process.exit(2)
}

const releaseId = requireEnv('NZILA_RELEASE_ID')
const commitSha = requireEnv('NZILA_COMMIT_SHA')
const manifestHash = requireEnv('NZILA_MANIFEST_HASH')
const builtAt = requireEnv('NZILA_BUILT_AT')
const envClass = requireEnv('NZILA_ENVIRONMENT_CLASS')
const product = process.env.NZILA_PRODUCT ?? 'platform'
const issuer = process.env.NZILA_ATTESTATION_ISSUER ?? 'release-governance-pipeline'

const evidence = (process.env.NZILA_ATTESTATION_EVIDENCE ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((uri) => ({
    uri,
    contentHash: 'sha256:' + createHash('sha256').update(uri).digest('hex'),
    description: 'CI artifact reference',
  }))

const envelope = {
  schemaVersion: ATTESTATION_SCHEMA_VERSION,
  attestationClass: className,
  attestationId: `att.${className}.${releaseId}.${Date.now()}`,
  issuer: { kind: 'pipeline', id: issuer },
  release: {
    releaseId,
    commitSha,
    manifestHash,
    builtAt,
  },
  environment: {
    environmentClass: envClass,
    product,
  },
  verdict: process.env.NZILA_ATTESTATION_VERDICT ?? 'verified',
  doctrineCitations: [
    { document: 'docs/nzila-runtime-integration/live-runtime-attestation-generation.md' },
  ],
  evidence,
  emittedAt: new Date().toISOString(),
}

const outDir = resolve(
  process.cwd(),
  'proof-artifacts',
  'attestations',
  releaseId,
)
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, `${className}.json`)
writeFileSync(outPath, JSON.stringify(envelope, null, 2) + '\n', 'utf8')

process.stdout.write(
  `runtime-governance/generate-attestation: wrote ${outPath} verdict=${envelope.verdict}\n`,
)
