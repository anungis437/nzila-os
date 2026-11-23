#!/usr/bin/env node
/**
 * SAGE B-005 Azure Container Apps revision inspect (read-only).
 *
 * Captures staging control-plane evidence required by
 * B005_STAGING_DEPLOY_PROCEDURE.md §A: subscription identity, live image,
 * latest revision name, ingress FQDN, and optional system logs.
 *
 * Sourced from Azure MCP plugin guidance (2026-11-23):
 * - extension_cli_install → ensure `az` is present before inspect
 * - documentation (microsoft_docs_search) → `az containerapp show` /
 *   `revision list` / `logs show --type system` for image-pull failures
 * - get_azure_bestpractices → never claim deploy success from data-plane
 *   timeouts alone; prefer control-plane evidence; match target/listen ports
 *
 * Never deploys, never mutates Azure, never elevates b005Closure above
 * NOT_PROVEN. Live Azure auth is required for CONTROL_PLANE_CAPTURED;
 * without it the receipt records AUTH_REQUIRED / CLI_MISSING honestly.
 *
 * Usage:
 *   node tooling/scripts/sage-b005-azure-revision-inspect.mjs \
 *     --out reports/proof-runs/sage-b005-azure-revision.json \
 *     [--resource-group nzila-canada-staging-rg] \
 *     [--app-name nzila-os-platform-admin] \
 *     [--health-url https://staging-admin.nzilaventures.com/api/health] \
 *     [--include-system-logs]
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

export const DEFAULT_RESOURCE_GROUP = 'nzila-canada-staging-rg'
export const DEFAULT_APP_NAME = 'nzila-os-platform-admin'
export const DEFAULT_HEALTH_URL =
  'https://staging-admin.nzilaventures.com/api/health'
export const FORBIDDEN_PROD_RESOURCE_GROUPS = Object.freeze([
  'nzila-canada-prod-rg',
  'nzila-prod-rg',
])

function errorCode(message) {
  return new Error('SAGE_B005_AZURE_REVISION_INSPECT: ' + message)
}

function parseArgs(argv) {
  const opts = {
    out: null,
    resourceGroup: DEFAULT_RESOURCE_GROUP,
    appName: DEFAULT_APP_NAME,
    healthUrl: DEFAULT_HEALTH_URL,
    includeSystemLogs: false,
  }
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i++) {
    const name = args[i]
    if (name === '--include-system-logs') {
      opts.includeSystemLogs = true
      continue
    }
    const value = args[i + 1]
    if (!value || value.startsWith('--')) throw errorCode('ARGUMENTS_INVALID')
    i++
    if (name === '--out') opts.out = value
    else if (name === '--resource-group') opts.resourceGroup = value
    else if (name === '--app-name') opts.appName = value
    else if (name === '--health-url') opts.healthUrl = value
    else throw errorCode(`UNKNOWN_ARGUMENT:${name}`)
  }
  if (!opts.out) throw errorCode('OUT_REQUIRED')
  if (!opts.resourceGroup || !opts.appName) throw errorCode('TARGET_REQUIRED')
  if (FORBIDDEN_PROD_RESOURCE_GROUPS.includes(opts.resourceGroup)) {
    throw errorCode('PROD_RESOURCE_GROUP_REFUSED')
  }
  return opts
}

export function defaultAzExec(args) {
  return execFileSync('az', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 45_000,
  })
}

export function probeAzPresence(execAz = defaultAzExec) {
  try {
    const raw = execAz(['version', '-o', 'json'])
    const parsed = JSON.parse(raw)
    return {
      present: true,
      version: typeof parsed?.['azure-cli'] === 'string' ? parsed['azure-cli'] : null,
      error: null,
    }
  } catch (err) {
    const message = err?.stderr?.toString?.() || err?.message || String(err)
    const missing = /No such file|not found|ENOENT/i.test(message)
    return {
      present: false,
      version: null,
      error: missing ? 'AZ_CLI_MISSING' : `AZ_VERSION_FAILED:${message.slice(0, 200)}`,
    }
  }
}

export function probeAzAccount(execAz = defaultAzExec) {
  try {
    const raw = execAz([
      'account',
      'show',
      '--query',
      '{name:name,id:id,tenantId:tenantId,user:user.name}',
      '-o',
      'json',
    ])
    return { authenticated: true, account: JSON.parse(raw), error: null }
  } catch (err) {
    const message = err?.stderr?.toString?.() || err?.message || String(err)
    const needsLogin = /az login|Please run/i.test(message)
    return {
      authenticated: false,
      account: null,
      error: needsLogin ? 'AZ_LOGIN_REQUIRED' : `AZ_ACCOUNT_FAILED:${message.slice(0, 200)}`,
    }
  }
}

export function captureContainerApp(execAz, { resourceGroup, appName }) {
  const showRaw = execAz([
    'containerapp',
    'show',
    '-g',
    resourceGroup,
    '-n',
    appName,
    '--query',
    '{fqdn:properties.configuration.ingress.fqdn,image:properties.template.containers[0].image,latestRevisionName:properties.latestRevisionName,targetPort:properties.configuration.ingress.targetPort,provisioningState:properties.provisioningState}',
    '-o',
    'json',
  ])
  const show = JSON.parse(showRaw)
  const revisionsRaw = execAz([
    'containerapp',
    'revision',
    'list',
    '-g',
    resourceGroup,
    '-n',
    appName,
    '--query',
    '[].{name:name,active:properties.active,trafficWeight:properties.trafficWeight,createdTime:properties.createdTime,fqdn:properties.fqdn}',
    '-o',
    'json',
  ])
  return {
    show,
    revisions: JSON.parse(revisionsRaw),
  }
}

export async function probeHealthUrl(healthUrl, fetchImpl = fetch) {
  const started = Date.now()
  try {
    const response = await fetchImpl(healthUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    let body = null
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? null
    if (response.status === 200 && contentType === 'application/json') {
      try {
        body = await response.json()
      } catch {
        body = null
      }
    }
    return {
      reachable: true,
      httpStatus: response.status,
      contentType,
      elapsedMs: Date.now() - started,
      commit: typeof body?.buildInfo?.commit === 'string' ? body.buildInfo.commit : null,
      status: typeof body?.status === 'string' ? body.status : null,
      error: null,
    }
  } catch (err) {
    return {
      reachable: false,
      httpStatus: null,
      contentType: null,
      elapsedMs: Date.now() - started,
      commit: null,
      status: null,
      error: err?.name === 'TimeoutError' || /aborted|timeout/i.test(String(err))
        ? 'HEALTH_TIMEOUT'
        : `HEALTH_FAILED:${String(err?.message || err).slice(0, 200)}`,
    }
  }
}

/**
 * Compose a machine-readable Azure revision inspect receipt.
 * Always leaves b005Closure = NOT_PROVEN.
 */
export function composeAzureRevisionReceipt({
  resourceGroup,
  appName,
  healthUrl,
  az,
  account,
  containerApp = null,
  systemLogs = null,
  health = null,
  observedAt = new Date().toISOString(),
  azurePluginSources = [],
}) {
  let result = 'AUTH_REQUIRED'
  if (!az?.present) result = 'CLI_MISSING'
  else if (account?.authenticated && containerApp?.show) result = 'CONTROL_PLANE_CAPTURED'
  else if (account?.authenticated) result = 'CONTROL_PLANE_PARTIAL'
  else if (az?.present) result = 'AUTH_REQUIRED'

  return {
    schemaVersion: 1,
    kind: 'SAGE_B005_AZURE_REVISION_INSPECT',
    observedAt,
    resourceGroup,
    appName,
    healthUrl,
    az,
    account: account?.account ?? null,
    accountError: account?.error ?? null,
    containerApp: containerApp
      ? {
          fqdn: containerApp.show?.fqdn ?? null,
          image: containerApp.show?.image ?? null,
          latestRevisionName: containerApp.show?.latestRevisionName ?? null,
          targetPort: containerApp.show?.targetPort ?? null,
          provisioningState: containerApp.show?.provisioningState ?? null,
          revisions: Array.isArray(containerApp.revisions) ? containerApp.revisions : [],
        }
      : null,
    systemLogs,
    health,
    result,
    b005Closure: 'NOT_PROVEN',
    azurePluginSources,
    unsupportedClaims: [
      'b005Closure remains NOT_PROVEN until authenticated staging qualification completes',
      'Data-plane health timeout alone is not a control-plane outage attestation',
      'Image digest / registry pull not verified by this inspect',
      'Migrations / sage_% inventory not verified by this inspect',
    ],
  }
}

export async function inspectAzureRevision({
  resourceGroup = DEFAULT_RESOURCE_GROUP,
  appName = DEFAULT_APP_NAME,
  healthUrl = DEFAULT_HEALTH_URL,
  includeSystemLogs = false,
  execAz = defaultAzExec,
  fetchImpl = fetch,
  observedAt = new Date().toISOString(),
}) {
  if (FORBIDDEN_PROD_RESOURCE_GROUPS.includes(resourceGroup)) {
    throw errorCode('PROD_RESOURCE_GROUP_REFUSED')
  }

  const azurePluginSources = [
    {
      tool: 'extension_cli_install',
      purpose: 'Install Azure CLI when missing from agent environment',
    },
    {
      tool: 'documentation/microsoft_docs_search',
      purpose:
        'Official az containerapp show / revision list / system logs for FQDN, image, revision',
      docs: [
        'https://learn.microsoft.com/azure/container-apps/connect-apps#container-app-location-fqdn',
        'https://learn.microsoft.com/azure/container-apps/revisions-manage#revision-list',
        'https://learn.microsoft.com/azure/container-apps/troubleshoot-deployment-errors',
      ],
    },
    {
      tool: 'get_azure_bestpractices',
      purpose:
        'Prefer control-plane evidence over data-plane timeouts; match ingress targetPort to app listen port',
    },
    {
      tool: 'containerapps',
      purpose: 'MCP list discovery; live list requires authenticated Azure session',
    },
  ]

  const az = probeAzPresence(execAz)
  if (!az.present) {
    const health = await probeHealthUrl(healthUrl, fetchImpl)
    return composeAzureRevisionReceipt({
      resourceGroup,
      appName,
      healthUrl,
      az,
      account: { authenticated: false, account: null, error: 'AZ_CLI_MISSING' },
      health,
      observedAt,
      azurePluginSources,
    })
  }

  const account = probeAzAccount(execAz)
  const health = await probeHealthUrl(healthUrl, fetchImpl)

  if (!account.authenticated) {
    return composeAzureRevisionReceipt({
      resourceGroup,
      appName,
      healthUrl,
      az,
      account,
      health,
      observedAt,
      azurePluginSources,
    })
  }

  let containerApp = null
  let systemLogs = null
  let captureError = null
  try {
    containerApp = captureContainerApp(execAz, { resourceGroup, appName })
    if (includeSystemLogs) {
      try {
        const logs = execAz([
          'containerapp',
          'logs',
          'show',
          '-g',
          resourceGroup,
          '-n',
          appName,
          '--type',
          'system',
          '--tail',
          '50',
        ])
        systemLogs = { captured: true, tail: String(logs).slice(0, 8000), error: null }
      } catch (err) {
        systemLogs = {
          captured: false,
          tail: null,
          error: String(err?.stderr || err?.message || err).slice(0, 400),
        }
      }
    }
  } catch (err) {
    captureError = String(err?.stderr || err?.message || err).slice(0, 400)
  }

  const receipt = composeAzureRevisionReceipt({
    resourceGroup,
    appName,
    healthUrl,
    az,
    account,
    containerApp,
    systemLogs,
    health,
    observedAt,
    azurePluginSources,
  })
  if (captureError) {
    receipt.accountError = receipt.accountError
      ? `${receipt.accountError}; CAPTURE_FAILED:${captureError}`
      : `CAPTURE_FAILED:${captureError}`
    receipt.result = 'CONTROL_PLANE_PARTIAL'
  }
  return receipt
}

export async function runAzureRevisionInspect(argv, deps = {}) {
  const opts = parseArgs(argv)
  const receipt = await inspectAzureRevision({
    resourceGroup: opts.resourceGroup,
    appName: opts.appName,
    healthUrl: opts.healthUrl,
    includeSystemLogs: opts.includeSystemLogs,
    execAz: deps.execAz,
    fetchImpl: deps.fetchImpl,
  })
  await mkdir(dirname(opts.out), { recursive: true })
  await writeFile(opts.out, JSON.stringify(receipt, null, 2) + '\n', 'utf8')
  return receipt
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAzureRevisionInspect(process.argv.slice(2))
    .then((receipt) => {
      console.log(JSON.stringify({
        kind: receipt.kind,
        result: receipt.result,
        b005Closure: receipt.b005Closure,
        image: receipt.containerApp?.image ?? null,
        latestRevisionName: receipt.containerApp?.latestRevisionName ?? null,
        fqdn: receipt.containerApp?.fqdn ?? null,
        health: receipt.health,
      }, null, 2))
      // Exit 0 even when AUTH_REQUIRED — missing auth is an honest receipt, not a script crash.
      // Exit 2 only for CLI missing when operator expected inspect to run.
      if (receipt.result === 'CLI_MISSING') process.exitCode = 2
    })
    .catch((err) => {
      console.error(err.message || err)
      process.exitCode = 1
    })
}
