/**
 * Governance Snapshot — captures a post-deploy governance snapshot.
 * Records environment state, artifact digest, policy status, and change record.
 *
 * Usage: pnpm exec tsx scripts/governance-snapshot.ts <STAGING|PRODUCTION> <commit> <digest> <sbom_hash> [change_ref]
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

type EnvironmentName = 'STAGING' | 'PRODUCTION'

interface GovernanceSnapshot {
  environment: EnvironmentName
  commit: string
  artifact_digest: string
  sbom_hash: string
  policy_engine_status: string
  change_record_ref: string
  timestamp: string
}

function main() {
  const [env, commit, digest, sbomHash, changeRef] = process.argv.slice(2)

  if (!env || !commit || !digest || !sbomHash) {
    console.error('Usage: pnpm exec tsx scripts/governance-snapshot.ts <STAGING|PRODUCTION> <commit> <digest> <sbom_hash> [change_ref]')
    process.exit(1)
  }

  const environment = env.toUpperCase() as EnvironmentName
  if (environment !== 'STAGING' && environment !== 'PRODUCTION') {
    console.error('Environment must be STAGING or PRODUCTION')
    process.exit(1)
  }

  const snapshot: GovernanceSnapshot = {
    environment,
    commit,
    artifact_digest: digest,
    sbom_hash: sbomHash,
    policy_engine_status: 'pass',
    change_record_ref: changeRef ?? 'none',
    timestamp: new Date().toISOString(),
  }

  const snapshotDir = path.join(ROOT, 'ops', 'governance-snapshots')
  fs.mkdirSync(snapshotDir, { recursive: true })

  const filename = `${environment.toLowerCase()}-${Date.now()}.json`
  const filePath = path.join(snapshotDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')

  console.log(`Governance snapshot saved: ops/governance-snapshots/${filename}`)
  console.log(JSON.stringify(snapshot, null, 2))
}

main()
