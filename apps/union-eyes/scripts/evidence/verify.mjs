#!/usr/bin/env tsx
// cSpell:ignore nzila merkle
/**
 * UnionEyes — Evidence Seal Verifier
 *
 * Loads pack.json + seal.json, runs verifySeal() from @nzila/os-core, and
 * exits 1 if the seal is invalid. This script is a REQUIRED CI gate.
 *
 * Usage:
 *   pnpm tsx scripts/evidence/verify.mjs [--output <dir>]
 *
 * Exit codes:
 *   0  — seal verified OK
 *   1  — seal INVALID or files missing (CI MUST fail)
 *
 * Environment:
 *   EVIDENCE_SEAL_KEY   — HMAC key used when pack was sealed (required if HMAC-signed)
 */
// @ts-check
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'

// ── CLI args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', default: 'evidence-output' },
    'base-path': { type: 'string', default: process.cwd() },
  },
  strict: false,
})

const OUTPUT_DIR = resolve(typeof values.output === 'string' ? values.output : 'evidence-output')
const BASE_PATH = realpathSync(resolve(typeof values['base-path'] === 'string' ? values['base-path'] : process.cwd()))
const PACK_PATH = join(OUTPUT_DIR, 'pack.json')
const SEAL_PATH = join(OUTPUT_DIR, 'seal.json')

// ── Guard: both files must exist ──────────────────────────────────────────────
if (!existsSync(PACK_PATH)) {
  console.error(`❌ [VERIFY] pack.json not found at ${PACK_PATH}`)
  console.error('   CI FAILURE: evidence pack was not generated.')
  process.exit(1)
}
if (!existsSync(SEAL_PATH)) {
  console.error(`❌ [VERIFY] seal.json not found at ${SEAL_PATH}`)
  console.error('   CI FAILURE: pack exists without a seal — this is a governance violation.')
  process.exit(1)
}

const pack = JSON.parse(readFileSync(PACK_PATH, 'utf-8'))
const seal = JSON.parse(readFileSync(SEAL_PATH, 'utf-8'))

// ── Verify using os-core; failures must never select a weaker verifier ───────
/**
 * @param {any} packData
 * @param {any} sealData
 */
async function verify(packData, sealData) {
  const key = process.env.EVIDENCE_SEAL_KEY
  if (process.env.NODE_ENV === 'production' && (!key || key.length < 32)) {
    throw new Error('EVIDENCE_SEAL_KEY of at least 32 characters is required in production')
  }
  if (!sealData || sealData.sealVersion !== '1.0' || sealData.algorithm !== 'sha256' ||
      !/^[a-f0-9]{64}$/.test(sealData.packDigest) || !/^[a-f0-9]{64}$/.test(sealData.artifactsMerkleRoot) ||
      !Array.isArray(packData.artifacts) || sealData.artifactCount !== packData.artifacts.length) {
    throw new Error('Malformed or inconsistent evidence seal envelope')
  }
  if (key && (!/^[a-f0-9]{64}$/.test(sealData.hmacSignature) ||
      sealData.hmacKeyId !== createHash('sha256').update(key).digest('hex').slice(-8))) {
    throw new Error('Configured evidence key requires its matching HMAC signature and key identifier')
  }
  const { verifySeal } = await import('@nzila/os-core/evidence/seal')
  const result = verifySeal(
    /** @type {any} */ ({ ...packData, seal: sealData }),
    { hmacKey: key },
  )
  if (!result.valid) return result

  // The seal authenticates the index. Each referenced local artifact must also
  // exist and match its recorded bytes; a valid index cannot certify a changed
  // report or silently skip a missing one.
  for (const artifact of packData.artifacts) {
    if (!artifact || typeof artifact.path !== 'string' || !artifact.path ||
        artifact.path.includes('\0') || isAbsolute(artifact.path) ||
        artifact.path.split(/[\\/]/).includes('..') ||
        !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
        !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 0) {
      throw new Error('Malformed evidence artifact descriptor')
    }
    const filePath = realpathSync(resolve(BASE_PATH, artifact.path))
    const withinBase = relative(BASE_PATH, filePath)
    if (withinBase === '..' || withinBase.startsWith(`..${sep}`) || isAbsolute(withinBase)) {
      throw new Error('Evidence artifact resolves outside the artifact base path')
    }
    const bytes = readFileSync(filePath)
    if (bytes.length !== artifact.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
      throw new Error(`Evidence artifact bytes differ from the sealed index: ${artifact.path}`)
    }
  }
  return result
}

const result = await verify(pack, seal)

if (!result.valid) {
  console.error('')
  console.error('╔══════════════════════════════════════════════════════════╗')
  console.error('║  ❌ SEAL VERIFICATION FAILED — CI MUST FAIL              ║')
  console.error('╚══════════════════════════════════════════════════════════╝')
  console.error('')
  console.error(`  Reason: ${'reason' in result ? result.reason : result.errors.join('; ')}`)
  console.error(`  Pack:   ${PACK_PATH}`)
  console.error(`  Seal:   ${SEAL_PATH}`)
  console.error('')
  console.error('  NEVER accept an unverified evidence pack.')
  process.exit(1)
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════╗')
console.log('║  ✅ SEAL VERIFIED — evidence pack integrity confirmed    ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log('')
console.log(`  Pack digest:    ${seal.packDigest.slice(0, 32)}...`)
console.log(`  Merkle root:    ${seal.artifactsMerkleRoot.slice(0, 32)}...`)
console.log(`  Artifact count: ${seal.artifactCount}`)
console.log(`  Authentication: ${result.signatureVerified === true ? 'HMAC verified' : 'unsigned digest only'}`)
console.log(`  Sealed at:      ${seal.sealedAt}`)
console.log(`  Reason:         ${'reason' in result ? result.reason : (result.errors.length === 0 ? 'OK' : result.errors.join('; '))}`)
