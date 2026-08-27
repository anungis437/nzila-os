/**
 * CourtLens — Evidence Verification Script
 *
 * Reads evidence/pack.json + evidence/seal.json and verifies:
 *   1. Merkle root recomputed from artifact hashes matches seal.json
 *   2. Artifact count matches
 *   3. Pack status is 'sealed'
 *   4. If EVIDENCE_SEAL_KEY is set: verifies the HMAC signature
 *
 * Exits 1 on any failure — this is a BLOCKING CI gate.
 *
 * Usage:
 *   npx tsx scripts/evidence/verify.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, createHmac } from 'node:crypto'

const ROOT = process.cwd()
const EVIDENCE_DIR = join(ROOT, 'evidence')
const PACK_PATH = join(EVIDENCE_DIR, 'pack.json')
const SEAL_PATH = join(EVIDENCE_DIR, 'seal.json')

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function hmacSha256(key: string, content: string): string {
  return createHmac('sha256', key).update(content).digest('hex')
}

function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha256('empty')
  if (hashes.length === 1) return hashes[0]!
  const pairs: string[] = []
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i]!
    const right = hashes[i + 1] ?? left
    pairs.push(sha256(left + right))
  }
  return merkleRoot(pairs)
}

interface SealFile {
  seal: string
  merkleRoot: string
  sealedAt: string
  commitSha: string
  runId: string
  artifactCount: number
}

interface PackFile {
  status: string
  createdAt: string
  commitSha: string
  runId: string
  artifacts: { sha256: string }[]
}

function fail(msg: string): never {
  console.error(`\n❌ VERIFY FAILED: ${msg}\n`)
  process.exit(1)
}

function main() {
  console.log('🔍 CourtLens — Verifying evidence seal...\n')

  if (!existsSync(PACK_PATH)) {
    fail('evidence/pack.json not found. Run collect.ts first.')
  }
  if (!existsSync(SEAL_PATH)) {
    fail('evidence/seal.json not found. Run seal.ts first.')
  }

  let pack: PackFile
  let seal: SealFile
  try {
    pack = JSON.parse(readFileSync(PACK_PATH, 'utf-8')) as PackFile
    seal = JSON.parse(readFileSync(SEAL_PATH, 'utf-8')) as SealFile
  } catch (e) {
    fail(`Failed to parse evidence files: ${String(e)}`)
  }

  // 1 — Pack must have status 'sealed'
  if (pack.status !== 'sealed') {
    fail(`pack.json status is '${pack.status}', expected 'sealed'`)
  }
  console.log('  ✅ Pack status: sealed')

  // 2 — Artifact count must match
  const expectedCount = pack.artifacts.length
  if (seal.artifactCount !== expectedCount) {
    fail(
      `Artifact count mismatch: seal says ${seal.artifactCount}, pack has ${expectedCount}`,
    )
  }
  console.log(`  ✅ Artifact count: ${expectedCount}`)

  // 3 — Recompute Merkle root from sorted artifact hashes
  const sortedHashes = pack.artifacts.map((a) => a.sha256).sort()
  const recomputed = merkleRoot(sortedHashes)
  if (recomputed !== seal.merkleRoot) {
    fail(
      `Merkle root mismatch:\n  expected : ${seal.merkleRoot}\n  got      : ${recomputed}`,
    )
  }
  console.log(`  ✅ Merkle root verified: ${recomputed.slice(0, 16)}...`)

  // 4 — commitSha consistency
  if (pack.commitSha !== seal.commitSha) {
    fail(
      `commitSha mismatch: pack='${pack.commitSha}' seal='${seal.commitSha}'`,
    )
  }
  console.log(`  ✅ commitSha: ${pack.commitSha}`)

  // 5 — HMAC verification (if key is available)
  const sealKey = process.env.EVIDENCE_SEAL_KEY
  if (sealKey) {
    const payload = JSON.stringify({
      merkleRoot: seal.merkleRoot,
      sealedAt: seal.sealedAt,
      commitSha: seal.commitSha,
      runId: seal.runId,
      artifactCount: seal.artifactCount,
    })
    const expected = hmacSha256(sealKey, payload)
    if (expected !== seal.seal) {
      fail('HMAC signature is invalid — evidence pack has been tampered with.')
    }
    console.log('  ✅ HMAC signature verified')
  } else {
    console.log(
      '  ⚠️  EVIDENCE_SEAL_KEY not set — skipping HMAC verification (structural only)',
    )
  }

  console.log('\n✅ Evidence seal is VALID.\n')
}

main()
