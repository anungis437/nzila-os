/**
 * Environment Health Check — validates environment configuration, isolation,
 * and deployment readiness for LOCAL, PREVIEW, STAGING, and PRODUCTION.
 *
 * Usage: pnpm exec tsx scripts/environment-health.ts [environment]
 *        e.g. pnpm exec tsx scripts/environment-health.ts STAGING
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const ALL_ENVIRONMENTS = ['LOCAL', 'PREVIEW', 'STAGING', 'PRODUCTION'] as const
type EnvironmentName = (typeof ALL_ENVIRONMENTS)[number]

interface HealthCheck {
  environment: EnvironmentName
  check: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  detail: string
}

const results: HealthCheck[] = []

function record(env: EnvironmentName, check: string, status: HealthCheck['status'], detail: string) {
  results.push({ environment: env, check, status, detail })
}

// ── 1. Environment config files exist ─────────────────

function checkEnvFiles(env: EnvironmentName) {
  const envFile = path.join(ROOT, 'ops', 'environments', `${env.toLowerCase()}.env`)
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf-8')
    if (content.includes(`ENVIRONMENT=${env}`)) {
      record(env, 'env-file', 'healthy', `${env.toLowerCase()}.env present and correct`)
    } else {
      record(env, 'env-file', 'degraded', `${env.toLowerCase()}.env exists but ENVIRONMENT value mismatch`)
    }
  } else {
    record(env, 'env-file', 'unhealthy', `${env.toLowerCase()}.env missing`)
  }
}

// ── 2. Workflow files exist for deploy environments ───

function checkWorkflows(env: EnvironmentName) {
  const workflows: Record<string, string> = {
    PREVIEW: 'preview-deploy.yml',
    STAGING: 'deploy-staging.yml',
    PRODUCTION: 'deploy-production.yml',
  }
  const workflow = workflows[env]
  if (!workflow) {
    record(env, 'workflow', 'healthy', 'No workflow required for LOCAL')
    return
  }
  const workflowPath = path.join(ROOT, '.github', 'workflows', workflow)
  if (fs.existsSync(workflowPath)) {
    record(env, 'workflow', 'healthy', `${workflow} present`)
  } else {
    record(env, 'workflow', 'unhealthy', `${workflow} missing`)
  }
}

// ── 3. Artifact directory ready ───────────────────────

function checkArtifactDir(env: EnvironmentName) {
  if (env === 'LOCAL' || env === 'PREVIEW') {
    record(env, 'artifact-dir', 'healthy', 'No artifact tracking for this environment')
    return
  }
  const artifactsDir = path.join(ROOT, 'ops', 'artifacts')
  if (fs.existsSync(artifactsDir)) {
    record(env, 'artifact-dir', 'healthy', 'ops/artifacts/ directory present')
  } else {
    record(env, 'artifact-dir', 'degraded', 'ops/artifacts/ directory missing')
  }
}

// ── 4. Governance snapshot directory ready ─────────────

function checkGovernanceDir(env: EnvironmentName) {
  if (env === 'LOCAL' || env === 'PREVIEW') {
    record(env, 'governance-dir', 'healthy', 'No governance snapshots for this environment')
    return
  }
  const govDir = path.join(ROOT, 'ops', 'governance-snapshots')
  if (fs.existsSync(govDir)) {
    record(env, 'governance-dir', 'healthy', 'ops/governance-snapshots/ directory present')
  } else {
    record(env, 'governance-dir', 'degraded', 'ops/governance-snapshots/ directory missing')
  }
}

// ── 5. Protected environment gate checks ──────────────

function checkProtectionGates(env: EnvironmentName) {
  const isProtected = env === 'STAGING' || env === 'PRODUCTION'
  if (!isProtected) {
    record(env, 'protection-gates', 'healthy', 'Environment is not protected')
    return
  }

  // Check that deploy workflow has pre-deploy-gates job
  const workflows: Record<string, string> = {
    STAGING: 'deploy-staging.yml',
    PRODUCTION: 'deploy-production.yml',
  }
  const workflowPath = path.join(ROOT, '.github', 'workflows', workflows[env]!)
  if (!fs.existsSync(workflowPath)) {
    record(env, 'protection-gates', 'unhealthy', 'Deploy workflow missing — no gate enforcement')
    return
  }
  const content = fs.readFileSync(workflowPath, 'utf-8')
  if (content.includes('pre-deploy-gates')) {
    record(env, 'protection-gates', 'healthy', 'Pre-deploy gates present in workflow')
  } else {
    record(env, 'protection-gates', 'degraded', 'Workflow exists but no pre-deploy-gates job found')
  }
}

// ── Run all checks ────────────────────────────────────

const targetEnv = process.argv[2]?.toUpperCase() as EnvironmentName | undefined
const environments = targetEnv && ALL_ENVIRONMENTS.includes(targetEnv as EnvironmentName)
  ? [targetEnv as EnvironmentName]
  : [...ALL_ENVIRONMENTS]

for (const env of environments) {
  checkEnvFiles(env)
  checkWorkflows(env)
  checkArtifactDir(env)
  checkGovernanceDir(env)
  checkProtectionGates(env)
}

// ── Report ────────────────────────────────────────────

const statusIcon = { healthy: '✓', degraded: '⚠', unhealthy: '✗' }
const grouped = new Map<EnvironmentName, HealthCheck[]>()
for (const r of results) {
  const existing = grouped.get(r.environment) ?? []
  existing.push(r)
  grouped.set(r.environment, existing)
}

let exitCode = 0
for (const [env, checks] of grouped) {
  console.log(`\n── ${env} ──`)
  for (const c of checks) {
    const icon = statusIcon[c.status]
    console.log(`  ${icon} ${c.check}: ${c.detail}`)
    if (c.status === 'unhealthy') exitCode = 1
  }
}

const total = results.length
const healthy = results.filter((r) => r.status === 'healthy').length
const degraded = results.filter((r) => r.status === 'degraded').length
const unhealthy = results.filter((r) => r.status === 'unhealthy').length

console.log(`\n── Summary: ${healthy}/${total} healthy, ${degraded} degraded, ${unhealthy} unhealthy ──`)

process.exit(exitCode)
