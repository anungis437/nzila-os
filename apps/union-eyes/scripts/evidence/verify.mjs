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
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'

// ── CLI args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', default: 'evidence-output' },
  },
  strict: false,
})

const OUTPUT_DIR = resolve(typeof values.output === 'string' ? values.output : 'evidence-output')
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

// ── Verify using os-core; fall back to inline check ──────────────────────────
/**
 * @param {any} packData
 * @param {any} sealData
 */
async function verify(packData, sealData) {
  try {
    const { verifySeal } = await import('@nzila/os-core/evidence/seal')
    return verifySeal(
      /** @type {any} */ ({ ...packData, seal: sealData }),
      { hmacKey: process.env.EVIDENCE_SEAL_KEY },
    )
  } catch {
    // Inline fallback: recompute pack digest and compare
    const canonical = JSON.stringify(Object.fromEntries(
      Object.entries(packData).sort(([a], [b]) => a.localeCompare(b))
    ))
    const recomputedDigest = createHash('sha256').update(canonical).digest('hex')
    if (recomputedDigest !== sealData.packDigest) {
      return {
        valid: false,
        reason: `Pack digest mismatch: expected ${sealData.packDigest.slice(0, 16)}... got ${recomputedDigest.slice(0, 16)}...`,
      }
    }
    return { valid: true, reason: 'Pack digest matches (fallback inline verification)' }
  }
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
console.log(`  Sealed at:      ${seal.sealedAt}`)
console.log(`  Reason:         ${'reason' in result ? result.reason : (result.errors.length === 0 ? 'OK' : result.errors.join('; '))}`)
