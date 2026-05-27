/**
 * Rollback — reverts a protected environment to a previous known-good artifact.
 *
 * Usage: pnpm exec tsx scripts/rollback.ts <STAGING|PRODUCTION> <artifact_digest>
 *
 * The script verifies the artifact exists in ops/artifacts/, prints the
 * rollback plan, and writes a rollback record for audit purposes.
 * Actual container/infrastructure rollback is performed by CI or operator.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

type EnvironmentName = 'STAGING' | 'PRODUCTION'

interface DeploymentArtifact {
  artifact_digest: string
  sbom_hash: string
  attestation_ref: string
  commit_sha: string
  built_at: string
  source_workflow: string
}

interface RollbackRecord {
  environment: EnvironmentName
  target_digest: string
  target_commit: string
  rolled_back_at: string
  initiated_by: string
}

function loadArtifactByDigest(digest: string): DeploymentArtifact | null {
  const artifactsDir = path.join(ROOT, 'ops', 'artifacts')
  if (!fs.existsSync(artifactsDir)) return null

  const files = fs.readdirSync(artifactsDir).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    const content = fs.readFileSync(path.join(artifactsDir, file), 'utf-8')
    try {
      const artifact: DeploymentArtifact = JSON.parse(content)
      if (artifact.artifact_digest === digest) return artifact
    } catch {
      // skip malformed
    }
  }
  return null
}

function main() {
  const [env, digest] = process.argv.slice(2)

  if (!env || !digest) {
    console.error('Usage: pnpm exec tsx scripts/rollback.ts <STAGING|PRODUCTION> <artifact_digest>')
    process.exit(1)
  }

  const environment = env.toUpperCase() as EnvironmentName
  if (environment !== 'STAGING' && environment !== 'PRODUCTION') {
    console.error('Environment must be STAGING or PRODUCTION')
    process.exit(1)
  }

  console.log(`\nRollback — ${environment}`)
  console.log(`Target digest: ${digest}\n`)

  // Verify artifact exists
  const artifact = loadArtifactByDigest(digest)
  if (!artifact) {
    console.error(`✗ Artifact not found for digest: ${digest}`)
    console.error('  Ensure the artifact manifest exists in ops/artifacts/')
    process.exit(1)
  }

  console.log('Artifact found:')
  console.log(`  Commit:   ${artifact.commit_sha}`)
  console.log(`  Built:    ${artifact.built_at}`)
  console.log(`  Workflow: ${artifact.source_workflow}`)
  console.log(`  SBOM:     ${artifact.sbom_hash}`)
  console.log()

  // Write rollback record
  const record: RollbackRecord = {
    environment,
    target_digest: artifact.artifact_digest,
    target_commit: artifact.commit_sha,
    rolled_back_at: new Date().toISOString(),
    initiated_by: process.env.USER ?? process.env.USERNAME ?? 'ci',
  }

  const rollbackDir = path.join(ROOT, 'ops', 'rollbacks')
  fs.mkdirSync(rollbackDir, { recursive: true })

  const filename = `${environment.toLowerCase()}-${Date.now()}.json`
  const filePath = path.join(rollbackDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8')

  console.log(`✓ Rollback record saved: ops/rollbacks/${filename}`)
  console.log()
  console.log('To complete the rollback, deploy the target artifact:')
  console.log(`  az containerapp update --name <app> --image <acr>/<repo>@${digest}`)
}

main()
