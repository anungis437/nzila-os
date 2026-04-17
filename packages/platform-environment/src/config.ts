/**
 * @nzila/platform-environment — Env file and artifact loading
 *
 * Loads environment-specific .env files from ops/environments/ and
 * manages deployment artifact metadata from ops/artifacts/.
 *
 * @module @nzila/platform-environment/config
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { deploymentArtifactSchema, governanceSnapshotSchema } from './schemas'
import type { EnvironmentName, DeploymentArtifact, GovernanceSnapshot } from './types'

// ── Repo Root ───────────────────────────────────────────────────────────────

function findRepoRoot(from?: string): string {
  let dir = from ?? resolve(/* turbopackIgnore: true */ (import.meta.dirname ?? __dirname), '..', '..', '..')
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(/* turbopackIgnore: true */ dir, 'pnpm-workspace.yaml'))) return dir
    dir = resolve(/* turbopackIgnore: true */ dir, '..')
  }
  return resolve(/* turbopackIgnore: true */ '.')
}

// ── Env Files ───────────────────────────────────────────────────────────────

const ENV_FILE_MAP: Record<EnvironmentName, string> = {
  LOCAL: 'local.env',
  PREVIEW: 'preview.env',
  STAGING: 'staging.env',
  PRODUCTION: 'prod.env',
}

/**
 * Load key-value pairs from an env file.
 * Ignores comments and blank lines. Does NOT set process.env.
 */
export function loadEnvFile(env: EnvironmentName, baseDir?: string): Record<string, string> {
  const root = findRepoRoot(baseDir)
  const filePath = join(root, 'ops', 'environments', ENV_FILE_MAP[env])
  if (!existsSync(filePath)) return {}

  const vars: Record<string, string> = {}
  const lines = readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    vars[key] = value
  }
  return vars
}

// ── Deployment Artifacts ────────────────────────────────────────────────────

/**
 * Save a build artifact manifest to ops/artifacts/.
 */
export function saveArtifactManifest(artifact: DeploymentArtifact, baseDir?: string): string {
  const root = findRepoRoot(baseDir)
  const dir = join(root, 'ops', 'artifacts')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const date = new Date().toISOString().slice(0, 10)
  const fileName = `build-${date}-${artifact.commit_sha.slice(0, 7)}.json`
  const filePath = join(dir, fileName)
  writeFileSync(filePath, JSON.stringify(artifact, null, 2), 'utf-8')
  return filePath
}

/**
 * Load the latest artifact manifest.
 */
export function loadLatestArtifact(baseDir?: string): DeploymentArtifact | null {
  const root = findRepoRoot(baseDir)
  const dir = join(root, 'ops', 'artifacts')
  if (!existsSync(dir)) return null

  const files = readdirSync(dir)
    .filter((f) => f.startsWith('build-') && f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length === 0) return null

  try {
    const raw = JSON.parse(readFileSync(join(dir, files[0]), 'utf-8'))
    return deploymentArtifactSchema.parse(raw) as DeploymentArtifact
  } catch {
    return null
  }
}

/**
 * Load a specific artifact by digest.
 */
export function loadArtifactByDigest(digest: string, baseDir?: string): DeploymentArtifact | null {
  const root = findRepoRoot(baseDir)
  const dir = join(root, 'ops', 'artifacts')
  if (!existsSync(dir)) return null

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      const artifact = deploymentArtifactSchema.parse(raw) as DeploymentArtifact
      if (artifact.artifact_digest === digest) return artifact
    } catch {
      continue
    }
  }
  return null
}

// ── Governance Snapshots ────────────────────────────────────────────────────

/**
 * Save a governance snapshot after deploy.
 */
export function saveGovernanceSnapshot(snapshot: GovernanceSnapshot, baseDir?: string): string {
  const root = findRepoRoot(baseDir)
  const dir = join(root, 'ops', 'governance-snapshots')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const date = new Date().toISOString().slice(0, 10)
  const envPrefix = snapshot.environment.toLowerCase()
  const fileName = `governance-snapshot-${envPrefix}-${date}.json`
  const filePath = join(dir, fileName)
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  return filePath
}

/**
 * Load governance snapshots for an environment.
 */
export function loadGovernanceSnapshots(env: EnvironmentName, baseDir?: string): GovernanceSnapshot[] {
  const root = findRepoRoot(baseDir)
  const dir = join(root, 'ops', 'governance-snapshots')
  if (!existsSync(dir)) return []

  const prefix = env.toLowerCase()
  return readdirSync(dir)
    .filter((f) => f.includes(prefix) && f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      try {
        const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
        return governanceSnapshotSchema.parse(raw) as GovernanceSnapshot
      } catch {
        return null
      }
    })
    .filter((s): s is GovernanceSnapshot => s !== null)
}
