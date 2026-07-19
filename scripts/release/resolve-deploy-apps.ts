import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')

type Env = 'development' | 'staging' | 'pilot' | 'production'

type AppConfig = {
  releaseStatus: 'prod-approved' | 'staging-only' | 'internal-only' | 'frozen' | 'incubating' | 'blocked'
  prodPromotionEligible?: boolean
  requiresExplicitProdOverride?: boolean
}

type Inventory = {
  apps: Record<string, AppConfig>
}

function parseArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function eligibleForEnv(app: string, env: Env, cfg: AppConfig, zongaOverride: boolean): boolean {
  if (env === 'development') {
    return cfg.releaseStatus !== 'frozen' && cfg.releaseStatus !== 'blocked'
  }

  if (env === 'staging') {
    return cfg.releaseStatus === 'prod-approved' || cfg.releaseStatus === 'staging-only' || cfg.releaseStatus === 'internal-only' || cfg.releaseStatus === 'incubating'
  }

  if (env === 'pilot') {
    // Pilot fabric currently runs union-eyes only; gating mirrors staging
    // sovereign-substrate posture per docs/nzila-tier2-hardening/full-pilot-fabric-legitimacy.md
    return app === 'union-eyes' && (cfg.releaseStatus === 'prod-approved' || cfg.releaseStatus === 'staging-only' || cfg.releaseStatus === 'internal-only' || cfg.releaseStatus === 'incubating')
  }

  if (app === 'zonga') {
    return zongaOverride
  }

  // Phase 4B: internal-only surfaces are NEVER production-promotable via this
  // pipeline. They deploy through their dedicated internal workflow instead.
  return cfg.prodPromotionEligible === true || cfg.releaseStatus === 'prod-approved'
}

function main() {
  const env = (parseArg('--env') ?? 'staging') as Env
  const requestedRaw = parseArg('--apps') ?? 'all'
  const zongaOverride = (parseArg('--zonga-override') ?? 'false').toLowerCase() === 'true'

  if (!['development', 'staging', 'pilot', 'production'].includes(env)) {
    throw new Error('Invalid --env value. Use development|staging|pilot|production')
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory
  const inventoryApps = Object.keys(inventory.apps)

  const requestedApps = requestedRaw === 'all'
    ? inventoryApps
    : unique(requestedRaw.split(',').map((app) => app.trim()).filter(Boolean))

  const unknown = requestedApps.filter((app) => !inventory.apps[app])
  if (unknown.length > 0) {
    throw new Error(`Unknown apps in request: ${unknown.join(', ')}`)
  }

  const approved = requestedApps.filter((app) => eligibleForEnv(app, env, inventory.apps[app], zongaOverride))
  const denied = requestedApps.filter((app) => !approved.includes(app))

  if (approved.length === 0) {
    throw new Error(`No deployable apps after policy filtering for ${env}. Denied: ${denied.join(', ') || 'none'}`)
  }

  const decisions = requestedApps.map((app) => {
    const cfg = inventory.apps[app]
    return {
      app,
      releaseStatus: cfg.releaseStatus,
      prodPromotionEligible: cfg.prodPromotionEligible ?? false,
      eligible: eligibleForEnv(app, env, cfg, zongaOverride),
    }
  })

  const output = {
    environment: env,
    requestedApps,
    approvedApps: approved,
    deniedApps: denied,
    zongaOverride,
    decisions,
  }

  process.stdout.write(JSON.stringify(output, null, 2))
}

main()
