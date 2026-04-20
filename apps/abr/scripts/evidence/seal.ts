/**
 * FAIRCASE — Evidence Seal Script
 *
 * Reads evidence/pack.json (draft), computes a SHA-256 seal over
 * the ordered artifact hashes, and writes:
 *   evidence/seal.json   — { seal, merkleRoot, sealedAt, ... }
 *   evidence/pack.json   — status updated to "sealed"
 *
 * Requires EVIDENCE_SEAL_KEY environment variable.
 *
 * Usage:
 *   npx tsx scripts/evidence/seal.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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

function main() {
  if (!existsSync(PACK_PATH)) {
    console.error('❌ evidence/pack.json not found. Run collect.ts first.')
    process.exit(1)
  }

  const pack = JSON.parse(readFileSync(PACK_PATH, 'utf-8'))

  if (pack.status === 'sealed') {
    console.log('⚠️  Pack is already sealed.')
    process.exit(0)
  }

  const sealKey = process.env.EVIDENCE_SEAL_KEY
  if (!sealKey) {
    console.error('❌ EVIDENCE_SEAL_KEY environment variable is required.')
    process.exit(1)
  }

  const hashes = (pack.artifacts as { sha256: string }[])
    .map((a) => a.sha256)
    .sort()

  const root = merkleRoot(hashes)
  const sealedAt = new Date().toISOString()

  const payload = JSON.stringify({
    merkleRoot: root,
    sealedAt,
    commitSha: pack.commitSha,
    runId: pack.runId,
    artifactCount: hashes.length,
  })

  const seal = hmacSha256(sealKey, payload)

  writeFileSync(
    SEAL_PATH,
    JSON.stringify({ seal, merkleRoot: root, sealedAt, commitSha: pack.commitSha, runId: pack.runId, artifactCount: hashes.length }, null, 2),
    'utf-8',
  )

  pack.status = 'sealed'
  pack.sealedAt = sealedAt
  writeFileSync(PACK_PATH, JSON.stringify(pack, null, 2), 'utf-8')

  console.log('🔏 FAIRCASE evidence sealed.')
  console.log(`   Merkle root : ${root}`)
  console.log(`   Seal        : ${seal}`)
  console.log(`   Artifacts   : ${hashes.length}\n`)
}

main()
