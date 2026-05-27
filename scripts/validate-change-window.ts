/**
 * validate-change-window.ts — CLI deployment gating script
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-change-window.ts --env=STAGING --service=union-eyes
 *   pnpm exec tsx scripts/validate-change-window.ts --env=PROD --service=web --commit=abc123
 *
 * Exits with code 0 if deployment is allowed, 1 if blocked.
 */
import { validateChangeWindow } from '@nzila/platform-change-management'
import type { Environment } from '@nzila/platform-change-management/types'

// ── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(): { env: Environment; service: string; commit?: string; pr?: string } {
  const args = process.argv.slice(2)
  let env: string | undefined
  let service: string | undefined
  let commit: string | undefined
  let pr: string | undefined

  for (const arg of args) {
    if (arg.startsWith('--env=')) env = arg.split('=')[1]
    else if (arg.startsWith('--service=')) service = arg.split('=')[1]
    else if (arg.startsWith('--commit=')) commit = arg.split('=')[1]
    else if (arg.startsWith('--pr=')) pr = arg.split('=')[1]
  }

  if (!env || !service) {
    console.error('Usage: pnpm exec tsx scripts/validate-change-window.ts --env=STAGING|PROD --service=<service-name>')
    process.exit(1)
  }

  if (env !== 'STAGING' && env !== 'PROD') {
    console.error(`Invalid environment: ${env}. Must be STAGING or PROD.`)
    process.exit(1)
  }

  return { env: env as Environment, service, commit, pr }
}

// ── Main ────────────────────────────────────────────────────────────────────

const { env, service, commit, pr } = parseArgs()

console.log(`\n🔍 Validating change window for ${service} → ${env}...\n`)

const result = validateChangeWindow({
  env,
  service,
  commitSha: commit,
  prRef: pr,
})

if (result.change_id) {
  console.log(`  Change Record: ${result.change_id}`)
}

if (result.warnings.length > 0) {
  console.log('\n⚠️  Warnings:')
  for (const w of result.warnings) {
    console.log(`  - ${w}`)
  }
}

if (result.valid) {
  console.log('\n✅ Change validation PASSED — deployment may proceed.\n')
  process.exit(0)
} else {
  console.log('\n❌ Change validation FAILED:')
  for (const e of result.errors) {
    console.log(`  - ${e}`)
  }
  console.log('\nDeployment blocked. Resolve the above before deploying.\n')
  process.exit(1)
}
