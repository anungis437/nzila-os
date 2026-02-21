/**
 * Evidence Collection Script
 *
 * Collects CI artifacts into a draft evidence pack.
 * Output: evidence/pack.json
 *
 * Usage:
 *   pnpm evidence:collect
 *   npx tsx scripts/evidence/collect.ts
 *
 * The draft is in-memory only. Run seal.ts to persist.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const EVIDENCE_DIR = join(ROOT, 'evidence')

interface Artifact {
  name: string
  type: string
  sha256: string
  collectedAt: string
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function tryReadFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function main() {
  console.log('📦 Collecting evidence artifacts...\n')

  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
  }

  const artifacts: Artifact[] = []
  const now = new Date().toISOString()

  // Collect available CI outputs
  const candidates = [
    { path: 'sbom.json', name: 'SBOM', type: 'sbom' },
    { path: 'trivy-results.json', name: 'Trivy Scan', type: 'security-scan' },
    { path: 'audit-report.json', name: 'Dependency Audit', type: 'security-scan' },
    { path: 'contract-tests.json', name: 'Contract Tests', type: 'test-results' },
    { path: 'coverage/coverage-summary.json', name: 'Test Coverage', type: 'test-results' },
  ]

  for (const c of candidates) {
    const content = tryReadFile(join(ROOT, c.path))
    if (content) {
      artifacts.push({
        name: c.name,
        type: c.type,
        sha256: sha256(content),
        collectedAt: now,
      })
      console.log(`  ✅ ${c.name} (${c.path})`)
    } else {
      console.log(`  ⏭️  ${c.name} (${c.path}) — not found, skipping`)
    }
  }

  // Build metadata
  const pack = {
    version: '1.0.0',
    status: 'draft',
    createdAt: now,
    commitSha: getCommitSha(),
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    artifacts,
  }

  const packPath = join(EVIDENCE_DIR, 'pack.json')
  writeFileSync(packPath, JSON.stringify(pack, null, 2), 'utf-8')

  console.log(`\n📄 Pack written: evidence/pack.json (${artifacts.length} artifacts)`)
  console.log('   Run `pnpm evidence:seal` to seal the pack.\n')
}

main()
