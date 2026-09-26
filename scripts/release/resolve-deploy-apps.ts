import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  appsFromChangedFiles,
  eligibleForEnv,
  GITOPS_DEPLOYABLE_APPS,
  type DeployAppConfig,
  type DeployEnvironment,
} from './deploy-app-selection'

const ROOT = path.resolve(__dirname, '..', '..')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')

type Inventory = {
  apps: Record<string, DeployAppConfig>
}

function parseArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

function changedFilesSince(revision: string): string[] {
  const output = execFileSync('git', ['diff', '--name-only', `${revision}..HEAD`], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return output.split(/\r?\n/).map((file) => file.trim()).filter(Boolean)
}

function main() {
  const env = (parseArg('--env') ?? 'staging') as DeployEnvironment
  const requestedRaw = parseArg('--apps') ?? 'all'
  const zongaOverride = (parseArg('--zonga-override') ?? 'false').toLowerCase() === 'true'
  const automatic = process.argv.includes('--automatic')
  const allowEmpty = process.argv.includes('--allow-empty')
  const changedSince = parseArg('--changed-since')

  if (!['development', 'staging', 'pilot', 'production'].includes(env)) {
    throw new Error('Invalid --env value. Use development|staging|pilot|production')
  }

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory
  const inventoryApps = Object.keys(inventory.apps)
  const explicitSelection = requestedRaw !== 'all' && !automatic

  const requestedApps = automatic
    ? appsFromChangedFiles(changedSince ? changedFilesSince(changedSince) : [])
    : requestedRaw === 'all'
      ? inventoryApps.filter((app) => GITOPS_DEPLOYABLE_APPS.has(app))
      : [...new Set(requestedRaw.split(',').map((app) => app.trim()).filter(Boolean))]

  const unknown = requestedApps.filter((app) => !inventory.apps[app])
  if (unknown.length > 0) {
    throw new Error(`Unknown apps in request: ${unknown.join(', ')}`)
  }

  const approved = requestedApps.filter((app) => (
    GITOPS_DEPLOYABLE_APPS.has(app)
    && eligibleForEnv(app, env, inventory.apps[app], zongaOverride, explicitSelection)
  ))
  const denied = requestedApps.filter((app) => !approved.includes(app))

  if (approved.length === 0 && !allowEmpty) {
    throw new Error(`No deployable apps after policy filtering for ${env}. Denied: ${denied.join(', ') || 'none'}`)
  }

  const decisions = requestedApps.map((app) => {
    const cfg = inventory.apps[app]
    return {
      app,
      releaseStatus: cfg.releaseStatus,
      prodPromotionEligible: cfg.prodPromotionEligible ?? false,
      eligible: GITOPS_DEPLOYABLE_APPS.has(app)
        && eligibleForEnv(app, env, cfg, zongaOverride, explicitSelection),
    }
  })

  const output = {
    environment: env,
    requestedApps,
    approvedApps: approved,
    appsMatrix: approved,
    deniedApps: denied,
    automatic,
    explicitSelection,
    zongaOverride,
    decisions,
  }

  process.stdout.write(JSON.stringify(output, null, 2))
}

main()
