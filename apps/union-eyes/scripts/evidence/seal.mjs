#!/usr/bin/env tsx
// cSpell:ignore nzila merkle
/**
 * UnionEyes — Evidence Pack Sealer
 *
 * Loads the artifact manifest from collect.mjs, builds a canonical evidence
 * pack (pack.json), seals it with @nzila/os-core generateSeal, and writes
 * both pack.json + seal.json to the output directory.
 *
 * Usage:
 *   pnpm tsx scripts/evidence/seal.mjs [--output <dir>]
 *
 * Produces:
 *   <output>/pack.json   — canonical evidence pack index
 *   <output>/seal.json   — cryptographic seal (SHA-256 + optional HMAC)
 *
 * Environment:
 *   EVIDENCE_SEAL_KEY   — optional HMAC key (required in production)
 */
// @ts-check
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

// ── CLI args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', default: 'evidence-output' },
  },
  strict: false,
})

const OUTPUT_DIR = resolve(typeof values.output === 'string' ? values.output : 'evidence-output')
const ARTIFACTS_PATH = join(OUTPUT_DIR, 'artifacts.json')
const PACK_PATH = join(OUTPUT_DIR, 'pack.json')
const SEAL_PATH = join(OUTPUT_DIR, 'seal.json')

// ── Load artifact manifest ────────────────────────────────────────────────────
if (!existsSync(ARTIFACTS_PATH)) {
  console.error(`❌ artifacts.json not found at ${ARTIFACTS_PATH}`)
  console.error('   Run: pnpm tsx scripts/evidence/collect.mjs first')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf-8'))

// ── Build canonical pack.json ─────────────────────────────────────────────────
const pack = {
  packId: `ue-${process.env.GITHUB_RUN_ID ?? Date.now()}`,
  source: 'union-eyes',
  schemaVersion: '1.0',
  generatedAt: new Date().toISOString(),
  commitSha: manifest.commitSha ?? process.env.GITHUB_SHA ?? 'unknown',
  runId: manifest.runId ?? process.env.GITHUB_RUN_ID ?? 'local',
  artifacts: manifest.artifacts.map((/** @type {{ name: string; category: string; sha256: string; path: string; sizeBytes: number }} */ a) => ({
    name: a.name,
    category: a.category,
    sha256: a.sha256,
    path: a.path,
    sizeBytes: a.sizeBytes,
  })),
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(PACK_PATH, JSON.stringify(pack, null, 2), 'utf-8')
console.log(`📦 pack.json written: ${PACK_PATH}`)

// ── Seal with the authoritative implementation; never downgrade on failure ──
async function sealPack(/** @type {Record<string, unknown> & { artifacts: Array<{ sha256: string }> }} */ packData) {
  const key = process.env.EVIDENCE_SEAL_KEY
  if (process.env.NODE_ENV === 'production' && (!key || key.length < 32)) {
    throw new Error('EVIDENCE_SEAL_KEY of at least 32 characters is required in production')
  }
  const { generateSeal } = await import('@nzila/os-core/evidence/seal')
  const result = generateSeal(packData, { hmacKey: key })
  if (key && !result.hmacSignature) throw new Error('Configured evidence signing key did not produce an HMAC signature')
  return result
}

const seal = await sealPack(pack)
writeFileSync(SEAL_PATH, JSON.stringify(seal, null, 2), 'utf-8')
console.log(`🔏 seal.json written: ${SEAL_PATH}`)
console.log(`   Pack digest: ${seal.packDigest.slice(0, 32)}...`)
console.log(`   Artifacts:   ${seal.artifactCount}`)
if ('hmacSignature' in seal && seal.hmacSignature) {
  console.log(`   HMAC signed: yes (key id: ${'hmacKeyId' in seal ? seal.hmacKeyId : 'n/a'})`)
} else {
  console.log(`   HMAC signed: no (set EVIDENCE_SEAL_KEY for production)`)
}
