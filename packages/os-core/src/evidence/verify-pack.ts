#!/usr/bin/env node
/**
 * nzila-verify-pack — CLI tool to verify evidence pack integrity
 *
 * Reads an Evidence-Pack-Index.json file, verifies the cryptographic seal,
 * and optionally checks artifact hashes against local files.
 *
 * Usage:
 *   npx tsx packages/os-core/src/evidence/verify-pack.ts <pack-index.json> [--hmac-key <key>] [--artifacts-dir <dir>]
 *
 * Exit codes:
 *   0 — All checks passed
 *   1 — Verification failed
 *   2 — Usage error
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { verifySeal, type SealablePackIndex, type SealEnvelope } from './seal'

// ── Types ─────────────────────────────────────────────────────────────────

interface VerifyResult {
  packId: string
  sealValid: boolean
  digestMatch: boolean
  merkleMatch: boolean
  signatureVerified: boolean | 'no-key' | 'unsigned'
  artifactsChecked: number
  artifactHashErrors: string[]
  errors: string[]
  overallValid: boolean
}

// ── Core verification ───────────────────────────────────────────────────────

export function verifyPackIndex(
  indexPath: string,
  opts: { hmacKey?: string; artifactsDir?: string } = {},
): VerifyResult {
  if (!existsSync(indexPath)) {
    return {
      packId: 'unknown',
      sealValid: false,
      digestMatch: false,
      merkleMatch: false,
      signatureVerified: 'unsigned',
      artifactsChecked: 0,
      artifactHashErrors: [],
      errors: [`File not found: ${indexPath}`],
      overallValid: false,
    }
  }

  const raw = readFileSync(indexPath, 'utf-8')
  let packIndex: SealablePackIndex & { seal?: SealEnvelope; packId?: string }

  try {
    packIndex = JSON.parse(raw)
  } catch {
    return {
      packId: 'unknown',
      sealValid: false,
      digestMatch: false,
      merkleMatch: false,
      signatureVerified: 'unsigned',
      artifactsChecked: 0,
      artifactHashErrors: [],
      errors: [`Invalid JSON: ${indexPath}`],
      overallValid: false,
    }
  }

  const packId = packIndex.packId ?? 'unknown'

  // 1. Verify the cryptographic seal
  const sealResult = verifySeal(packIndex, { hmacKey: opts.hmacKey })
  const errors = [...sealResult.errors]

  // 2. Optionally verify artifact hashes against local files
  const artifactHashErrors: string[] = []
  let artifactsChecked = 0

  const artifactsDir = opts.artifactsDir ?? dirname(indexPath)
  if (packIndex.artifacts && existsSync(artifactsDir)) {
    for (const artifact of packIndex.artifacts) {
      const filename =
        (artifact as Record<string, unknown>).filename as string | undefined
      if (!filename) continue

      // Prevent path traversal — use basename to strip directory components
      const safeFilename = filename.replace(/[\\/]/g, '_')
      const filePath = join(artifactsDir, safeFilename)
      // Verify resolved path stays within artifactsDir
      const resolvedArtifacts = join(artifactsDir) // already absolute from dirname()
      if (!filePath.startsWith(resolvedArtifacts)) {
        artifactHashErrors.push(`${filename}: path traversal detected, skipping`)
        continue
      }
      if (!existsSync(filePath)) {
        // Not an error — artifact may be in blob storage
        continue
      }

      artifactsChecked++
      const fileBuffer = readFileSync(filePath)
      const computedHash = createHash('sha256').update(fileBuffer).digest('hex')
      if (computedHash !== artifact.sha256) {
        artifactHashErrors.push(
          `${filename}: expected ${artifact.sha256}, got ${computedHash}`,
        )
      }
    }
  }

  const overallValid =
    sealResult.valid && artifactHashErrors.length === 0

  return {
    packId,
    sealValid: sealResult.valid,
    digestMatch: sealResult.digestMatch,
    merkleMatch: sealResult.merkleMatch,
    signatureVerified: sealResult.signatureVerified,
    artifactsChecked,
    artifactHashErrors,
    errors: [...errors, ...artifactHashErrors],
    overallValid,
  }
}

// ── CLI entry point ─────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
nzila-verify-pack — Verify evidence pack integrity

Usage:
  nzila-verify-pack <evidence-pack-index.json> [options]

Options:
  --hmac-key <key>        HMAC key for signature verification
  --artifacts-dir <dir>   Directory containing artifact files for hash checks
  --json                  Output results as JSON
  -h, --help              Show this help message

Exit codes:
  0  All checks passed
  1  Verification failed
  2  Usage error
`)
    process.exit(args.length === 0 ? 2 : 0)
  }

  const indexPath = args[0]!
  const hmacKeyIdx = args.indexOf('--hmac-key')
  const hmacKey =
    hmacKeyIdx !== -1 ? args[hmacKeyIdx + 1] : process.env.EVIDENCE_SEAL_KEY
  const artifactsDirIdx = args.indexOf('--artifacts-dir')
  const artifactsDir =
    artifactsDirIdx !== -1 ? args[artifactsDirIdx + 1] : undefined
  const jsonOutput = args.includes('--json')

  const result = verifyPackIndex(indexPath, { hmacKey, artifactsDir })

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`\n── Evidence Pack Verification ──`)
    console.log(`  Pack ID:             ${result.packId}`)
    console.log(`  Seal Valid:          ${result.sealValid ? '✓' : '✗'}`)
    console.log(`  Digest Match:        ${result.digestMatch ? '✓' : '✗'}`)
    console.log(`  Merkle Match:        ${result.merkleMatch ? '✓' : '✗'}`)
    console.log(`  Signature Verified:  ${result.signatureVerified}`)
    if (result.artifactsChecked > 0) {
      console.log(`  Artifacts Checked:   ${result.artifactsChecked}`)
      console.log(
        `  Artifact Hashes OK:  ${result.artifactHashErrors.length === 0 ? '✓' : '✗'}`,
      )
    }
    if (result.errors.length > 0) {
      console.log(`\n  Errors:`)
      for (const err of result.errors) {
        console.log(`    - ${err}`)
      }
    }
    console.log(`\n  Overall:             ${result.overallValid ? 'PASS ✓' : 'FAIL ✗'}`)
    console.log()
  }

  process.exit(result.overallValid ? 0 : 1)
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes('verify-pack')
if (isDirectRun) {
  main()
}
