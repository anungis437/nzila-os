/**
 * drift-env.ts
 *
 * Audits environment variable drift in the staging configuration.
 * Compares declared vars in infrastructure/gitops/environments/staging.yml
 * against the known required-var manifest per app, flags deprecated vars
 * (legacy Clerk keys, etc.), and produces a drift report.
 *
 * Note: this script runs locally from repo sources — it does NOT call AZ CLI.
 * For live env var auditing against deployed Container Apps, run with --live
 * (requires az CLI + AZURE_CREDENTIALS or active `az login` session).
 *
 * Usage:
 *   pnpm exec tsx scripts/release/drift-env.ts --env staging
 *   pnpm tsx scripts/release/drift-env.ts [--env staging] [--live]
 *
 * Output:
 *   ops/drift/env-drift-<env>-latest.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const STAGING_YAML = path.join(ROOT, 'infrastructure', 'gitops', 'environments', 'staging.yml')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')

// ── Known required env vars per app category ─────────────────────────────────
// These are the RUNTIME env vars each category of app needs to function.
// NEXT_PUBLIC_* vars baked at build time are NOT listed here (those are build args).
// Secrets are marked with secretRef: true — they must exist as secret refs, not plaintext.

type VarSpec = {
  name: string
  secretRef?: boolean // must be a secret reference, not plaintext value
  optional?: boolean  // nice-to-have, not required for readiness
  deprecated?: boolean
  replacedBy?: string
  description?: string
}

const GLOBAL_REQUIRED: VarSpec[] = [
  { name: 'NODE_ENV', description: 'Runtime environment mode' },
  { name: 'AUTH_SECRET', secretRef: true, description: 'NextAuth session secret' },
  { name: 'AZURE_AD_CLIENT_ID', secretRef: true, description: 'Entra app client ID' },
  { name: 'AZURE_AD_CLIENT_SECRET', secretRef: true, description: 'Entra app client secret' },
  { name: 'AZURE_AD_TENANT_ID', secretRef: true, description: 'Entra tenant ID' },
]

const DATABASE_REQUIRED: VarSpec[] = [
  { name: 'DATABASE_URL', secretRef: true, description: 'PostgreSQL connection string' },
]

const QUEUE_REQUIRED: VarSpec[] = [
  { name: 'QUEUE_URL', secretRef: true, optional: true, description: 'Queue service URL (optional if feature-flagged)' },
]

const STORAGE_REQUIRED: VarSpec[] = [
  { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: true, optional: true, description: 'Azure Blob Storage connection string' },
]

const OTEL_OPTIONAL: VarSpec[] = [
  { name: 'OTEL_ENABLED', optional: true, description: 'Enable OpenTelemetry' },
  { name: 'OTEL_SERVICE_NAME', optional: true, description: 'OTEL service name' },
  { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', optional: true, description: 'OTEL collector endpoint' },
]

// ── Deprecated / forbidden vars ───────────────────────────────────────────────
const DEPRECATED_VARS: VarSpec[] = [
  { name: 'CLERK_SECRET_KEY', deprecated: true, replacedBy: 'AUTH_SECRET + AZURE_AD_*', description: 'Clerk legacy auth key — removed in platform-auth migration' },
  { name: 'CLERK_PUBLISHABLE_KEY', deprecated: true, replacedBy: 'AZURE_AD_CLIENT_ID', description: 'Clerk legacy publishable key' },
  { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', deprecated: true, replacedBy: 'AZURE_AD_CLIENT_ID', description: 'Clerk frontend key' },
  { name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL', deprecated: true, replacedBy: '/auth/signin', description: 'Clerk sign-in URL' },
  { name: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL', deprecated: true, replacedBy: '/auth/signup', description: 'Clerk sign-up URL' },
  { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', deprecated: true, replacedBy: 'AUTH_REDIRECT', description: 'Clerk post sign-in redirect' },
]

// ── Per-app required var manifest ────────────────────────────────────────────
const APP_REQUIREMENTS: Record<string, VarSpec[]> = {
  web: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED],
  console: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...STORAGE_REQUIRED],
  partners: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED],
  'union-eyes': [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...QUEUE_REQUIRED, ...OTEL_OPTIONAL],
  cfo: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...STORAGE_REQUIRED],
  flow: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...STORAGE_REQUIRED],
  abr: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...STORAGE_REQUIRED],
  zonga: [...GLOBAL_REQUIRED, ...DATABASE_REQUIRED, ...QUEUE_REQUIRED, ...OTEL_OPTIONAL],
  'orchestrator-api': [...DATABASE_REQUIRED, ...QUEUE_REQUIRED],
}

// ── Staging.yml parser ────────────────────────────────────────────────────────
// We parse the YAML by hand (regex-based, no dep on js-yaml in scripts dir).
// This is intentionally minimal — we only need the apps.*.env section.

function parseStagingYaml(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}

  // Split into app sections by looking for "  appname:" (2-space indent at top level)
  const lines = content.split('\n')
  let currentApp: string | null = null
  let inEnvBlock = false
  let envIndent = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect app names under "apps:" block: "  appname:" at 2-space indent
    const appMatch = line.match(/^  ([a-z][a-z0-9-]+):$/)
    if (appMatch) {
      currentApp = appMatch[1]
      inEnvBlock = false
      if (!result[currentApp]) result[currentApp] = {}
      continue
    }

    // Detect env: block under an app: "    env:" at 4-space indent
    if (currentApp && line.match(/^    env:$/)) {
      inEnvBlock = true
      envIndent = 4
      continue
    }

    // Parse env entries: "      - name: KEY" / "        value: VAL"
    if (currentApp && inEnvBlock) {
      const nameMatch = line.match(/^\s+- name:\s+(.+)$/)
      const valueMatch = line.match(/^\s+value:\s+(.+)$/)

      if (nameMatch) {
        const key = nameMatch[1].trim()
        // Look ahead for value
        const nextLine = lines[i + 1] ?? ''
        const nextValue = nextLine.match(/^\s+value:\s+(.+)$/)
        if (nextValue) {
          result[currentApp][key] = nextValue[1].trim()
        } else {
          result[currentApp][key] = '__secretref__'
        }
      } else if (!line.trim().startsWith('-') && !line.trim().startsWith('name:') && !line.trim().startsWith('value:') && line.trim() !== '' && !line.match(/^\s+\w+:/)) {
        // Stopped caring about value-only lines, they're handled by look-ahead
      }

      // Detect leaving env block
      if (line.match(/^    \w/) && !line.match(/^    env:/) && !line.match(/^      /)) {
        inEnvBlock = false
      }
    }
  }

  return result
}

type EnvDriftItem = {
  varName: string
  status: 'declared' | 'missing' | 'deprecated' | 'deprecated_present' | 'optional_missing'
  secretRef?: boolean
  value?: string  // only for non-secret vars; redacted for secretRef
  description?: string
  replacedBy?: string
}

type AppEnvDrift = {
  app: string
  declaredVarCount: number
  requiredVarsCount: number
  missingRequired: string[]
  missingOptional: string[]
  deprecatedPresent: string[]
  items: EnvDriftItem[]
  envDriftScore: number  // 0-100
  hasBlockingGaps: boolean
}

function parseArg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required argument: ${name}`)
}

function flagExists(name: string): boolean {
  return process.argv.includes(name)
}

async function fetchLiveEnvVars(app: string, rg: string): Promise<Record<string, string> | null> {
  try {
    const caName = `nzila-os-${app}`
    const raw = child_process.execSync(
      `az containerapp show --name ${caName} --resource-group ${rg} --query "properties.template.containers[0].env" -o json`,
      { encoding: 'utf8', timeout: 15000 },
    )
    const entries = JSON.parse(raw) as Array<{ name: string; value?: string; secretRef?: string }>
    const result: Record<string, string> = {}
    for (const entry of entries) {
      result[entry.name] = entry.secretRef ? `__secretref:${entry.secretRef}__` : (entry.value ?? '')
    }
    return result
  } catch {
    return null
  }
}

async function main() {
  const env = parseArg('--env', 'staging')
  const liveMode = flagExists('--live')
  const rg = `nzila-canada-${env}-rg`

  const yamlContent = fs.readFileSync(STAGING_YAML, 'utf8')
  const declaredEnvByApp = parseStagingYaml(yamlContent)

  const appsToAudit = Object.keys(APP_REQUIREMENTS)

  console.log(`\nEnvironment Drift Audit — ${env.toUpperCase()}`)
  console.log(`Mode: ${liveMode ? 'LIVE (AZ CLI)' : 'STATIC (staging.yml only)'}`)
  console.log(`Apps: ${appsToAudit.join(', ')}\n`)

  const appResults: AppEnvDrift[] = []

  for (const app of appsToAudit) {
    const requirements = APP_REQUIREMENTS[app] ?? []
    let envVars: Record<string, string>

    if (liveMode) {
      const live = await fetchLiveEnvVars(app, rg)
      envVars = live ?? declaredEnvByApp[app] ?? {}
      if (!live) {
        console.log(`  ⚠️  ${app}: could not fetch live env vars — falling back to staging.yml`)
      }
    } else {
      envVars = declaredEnvByApp[app] ?? {}
    }

    const items: EnvDriftItem[] = []
    const missingRequired: string[] = []
    const missingOptional: string[] = []
    const deprecatedPresent: string[] = []

    // Check required vars
    for (const spec of requirements) {
      const present = Object.prototype.hasOwnProperty.call(envVars, spec.name) || envVars[spec.name] !== undefined
      if (spec.deprecated) continue // deprecated handled separately

      if (present) {
        const rawVal = envVars[spec.name] ?? ''
        items.push({
          varName: spec.name,
          status: 'declared',
          secretRef: spec.secretRef,
          value: spec.secretRef ? '[secret]' : rawVal,
          description: spec.description,
        })
      } else if (spec.optional) {
        missingOptional.push(spec.name)
        items.push({
          varName: spec.name,
          status: 'optional_missing',
          secretRef: spec.secretRef,
          description: spec.description,
        })
      } else {
        missingRequired.push(spec.name)
        items.push({
          varName: spec.name,
          status: 'missing',
          secretRef: spec.secretRef,
          description: spec.description,
        })
      }
    }

    // Check deprecated vars
    for (const dep of DEPRECATED_VARS) {
      const present = Object.prototype.hasOwnProperty.call(envVars, dep.name)
      if (present) {
        deprecatedPresent.push(dep.name)
        items.push({
          varName: dep.name,
          status: 'deprecated_present',
          description: dep.description,
          replacedBy: dep.replacedBy,
        })
      }
    }

    const totalRequired = requirements.filter((r) => !r.optional && !r.deprecated).length
    const totalPresent = items.filter((i) => i.status === 'declared').length
    const envDriftScore = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 100
    const hasBlockingGaps = missingRequired.length > 0

    const icon = hasBlockingGaps ? '✗' : deprecatedPresent.length > 0 ? '⚠' : '✓'
    const depLabel = deprecatedPresent.length > 0 ? `  deprecated=${deprecatedPresent.length}` : ''
    const missingLabel = missingRequired.length > 0 ? `  MISSING=${missingRequired.join(',')}` : ''
    console.log(`  ${icon}  ${app.padEnd(18)} score=${envDriftScore}%${depLabel}${missingLabel}`)

    appResults.push({
      app,
      declaredVarCount: Object.keys(envVars).length,
      requiredVarsCount: totalRequired,
      missingRequired,
      missingOptional,
      deprecatedPresent,
      items,
      envDriftScore,
      hasBlockingGaps,
    })
  }

  const allGreen = appResults.every((r) => !r.hasBlockingGaps)
  const totalDeprecated = appResults.reduce((s, r) => s + r.deprecatedPresent.length, 0)
  const totalMissing = appResults.reduce((s, r) => s + r.missingRequired.length, 0)
  const overallScore = Math.round(
    appResults.reduce((s, r) => s + r.envDriftScore, 0) / (appResults.length || 1),
  )

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Overall Env Drift Score: ${overallScore}%`)
  console.log(`Blocking gaps:           ${totalMissing} missing required var(s)`)
  console.log(`Deprecated vars present: ${totalDeprecated}`)
  console.log(`Apps with blocking gaps: ${appResults.filter((r) => r.hasBlockingGaps).map((r) => r.app).join(', ') || 'none'}`)

  if (!liveMode) {
    console.log(`\nNOTE: This audit is based on staging.yml static config only.`)
    console.log(`      Secret-ref vars (DATABASE_URL, AUTH_SECRET, etc.) must be audited`)
    console.log(`      against live Container Apps using: pnpm exec tsx scripts/release/drift-env.ts --env staging --live`)
  }

  const report = {
    timestamp: new Date().toISOString(),
    environment: env,
    mode: liveMode ? 'live' : 'static',
    overallEnvDriftScore: overallScore,
    totalMissingRequired: totalMissing,
    totalDeprecatedPresent: totalDeprecated,
    hasBlockingGaps: !allGreen,
    apps: appResults,
  }

  const outDir = path.join(ROOT, 'ops', 'drift')
  fs.mkdirSync(outDir, { recursive: true })
  const timestampedPath = path.join(outDir, `env-drift-${env}-${Date.now()}.json`)
  const latestPath = path.join(outDir, `env-drift-${env}-latest.json`)
  fs.writeFileSync(timestampedPath, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(`\nReport written: ${path.relative(ROOT, timestampedPath)}`)
  console.log(`Latest updated: ${path.relative(ROOT, latestPath)}`)

  if (!allGreen) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
