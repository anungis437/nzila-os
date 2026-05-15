#!/usr/bin/env tsx
/**
 * ingest-azure-runtime.ts
 *
 * Collects Azure Container Apps runtime status for all policy-approved
 * staging and production apps.
 *
 * Sources:
 *  - governance/release/deployment-inventory.json
 *  - scripts/release/resolve-deploy-apps.ts
 *
 * Live mode: AZ_LIVE_INGEST=true
 * Local mode: bootstrap/unknown output without Azure calls.
 *
 * Output: reports/runtime/azure-runtime-latest.json
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as dns } from 'node:dns'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..').replace(/\\/g, '/')

const OUTPUT_DIR = join(ROOT, 'reports', 'runtime')
const OUTPUT_FILE = join(OUTPUT_DIR, 'azure-runtime-latest.json')
const INVENTORY_PATH = join(ROOT, 'governance', 'release', 'deployment-inventory.json')

const SENSITIVE_ENV_KEY_RE = /(secret|token|password|credential|private[_-]?key|client[_-]?secret|auth[_-]?secret|api[_-]?key)/i

type EnvironmentName = 'staging' | 'production'

type InventoryRouting = {
  staging?: string
  production?: string
  healthPath?: string
}

type InventoryApp = {
  releaseStatus?: string
  prodPromotionEligible?: boolean
  routing?: InventoryRouting
  rollbackException?: boolean
}

type TopologyEnv = {
  resourceGroup?: string
  containerAppEnvironment?: string
  sharedWithStaging?: boolean
}

type InventoryTopology = {
  strategy?: string
  staging?: TopologyEnv
  production?: TopologyEnv
}

type InventoryPolicy = {
  stagingMissingExpected?: 'warn' | 'fail'
}

type DeploymentInventory = {
  apps: Record<string, InventoryApp>
  topology?: InventoryTopology
  verificationPolicy?: InventoryPolicy
}

type ResolveOutput = {
  approvedApps: string[]
}

type DnsStatus = {
  host: string
  resolves: boolean
  addresses: string[]
  error?: string
}

type SecretPosture = {
  totalEnvVars: number
  secretRefCount: number
  plainValueCount: number
  sensitivePlainValueCount: number
  sensitivePlainValueKeys: string[]
}

type AppAssessment = {
  expectedAppName: string
  expectedContainerAppName: string
  expectedResourceGroup: string
  expectedRoute: string | null
  expectedHealthPath: string
  exists: boolean
  provisioningState: string | null
  runningState: string | null
  latestRevision: string | null
  latestReadyRevision: string | null
  image: string | null
  ingressFqdn: string | null
  trafficWeights: Array<{ revisionName: string | null; weight: number | null; latestRevision: boolean }>
  identity: {
    present: boolean
    type: string | null
    principalId: string | null
    tenantId: string | null
  }
  rollbackCandidateCount: number
  rollbackCandidates: string[]
  customDomain: string | null
  dnsStatus: DnsStatus | null
  secretPosture: SecretPosture
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  severity: 'none' | 'warn' | 'blocker'
  issues: string[]
}

type EnvironmentAssessment = {
  environment: EnvironmentName
  expectedResourceGroup: string
  expectedContainerAppEnvironment: string | null
  resourceGroupExists: boolean
  containerAppEnvironmentExists: boolean | null
  topologyStrategy: string
  sharedWithStaging: boolean
  expectedApps: string[]
  deployedAppsInResourceGroup: string[]
  assessments: AppAssessment[]
  summary: {
    expectedCount: number
    deployedCount: number
    passCount: number
    warnCount: number
    failCount: number
    missingExpectedCount: number
    blockerCount: number
  }
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown'
  blockingFindings: string[]
  advisoryFindings: string[]
}

interface AzureRuntimeSnapshot {
  ingestedAt: string
  subscriptionId: string | null
  topologyDecision: {
    strategy: string
    expectedShared: boolean
    stagingResourceGroup: string
    productionResourceGroup: string
    stagingEnvironment: string | null
    productionEnvironment: string | null
  }
  environments: EnvironmentAssessment[]
  apps: Array<{
    name: string
    provisioningState: string | null
    runningState: string | null
    fqdn: string | null
    revision: string | null
    image: string | null
    trafficWeight: number | null
    healthResult: 'healthy' | 'degraded' | 'critical' | 'unknown'
    bootstrapEvidence: boolean
    status: 'pass' | 'fail' | 'unknown'
  }>
  blockingFindings: string[]
  advisoryFindings: string[]
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown'
  bootstrapEvidence: boolean
}

function aliasLogicalApp(logicalApp: string): string {
  if (logicalApp === 'faircase') return 'abr'
  return logicalApp
}

function normalizeRoute(route: string | undefined): string | null {
  if (!route) return null
  const trimmed = route.trim()
  if (!trimmed || trimmed === 'n/a' || trimmed === 'blocked' || trimmed === 'pilot-only') return null
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed
  return null
}

function parseInventory(): DeploymentInventory {
  if (!existsSync(INVENTORY_PATH)) {
    throw new Error(`Missing inventory at ${INVENTORY_PATH}`)
  }
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as DeploymentInventory
}

function resolveEnvConfig(inventory: DeploymentInventory, env: EnvironmentName): { resourceGroup: string; containerAppEnvironment: string | null; sharedWithStaging: boolean } {
  const stagingDefaultRg = process.env.AZURE_STAGING_RESOURCE_GROUP ?? 'nzila-canada-staging-rg'
  const productionDefaultRg = process.env.AZURE_PRODUCTION_RESOURCE_GROUP ?? process.env.AZURE_RESOURCE_GROUP ?? 'nzila-canada-prod-rg'
  const stagingDefaultEnv = process.env.AZURE_STAGING_CONTAINER_APP_ENVIRONMENT ?? 'nzila-canada-staging-env'
  const productionDefaultEnv = process.env.AZURE_PRODUCTION_CONTAINER_APP_ENVIRONMENT ?? 'nzila-canada-prod-env'

  const top = inventory.topology
  if (env === 'staging') {
    return {
      resourceGroup: top?.staging?.resourceGroup ?? stagingDefaultRg,
      containerAppEnvironment: top?.staging?.containerAppEnvironment ?? stagingDefaultEnv,
      sharedWithStaging: false,
    }
  }

  return {
    resourceGroup: top?.production?.resourceGroup ?? productionDefaultRg,
    containerAppEnvironment: top?.production?.containerAppEnvironment ?? productionDefaultEnv,
    sharedWithStaging: top?.production?.sharedWithStaging === true,
  }
}

function runJsonCommand(command: string, args: string[]): unknown {
  try {
    return JSON.parse(execFileSync(command, args, { encoding: 'utf8', timeout: 30_000 }))
  } catch (firstErr) {
    if (process.platform !== 'win32') throw firstErr
    const quoted = [command, ...args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))].join(' ')
    const output = execFileSync('cmd.exe', ['/d', '/s', '/c', quoted], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    return JSON.parse(output)
  }
}

function runTextCommand(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 30_000 }).trim()
  } catch (firstErr) {
    if (process.platform !== 'win32') throw firstErr
    const quoted = [command, ...args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))].join(' ')
    return execFileSync('cmd.exe', ['/d', '/s', '/c', quoted], {
      encoding: 'utf8',
      timeout: 30_000,
    }).trim()
  }
}

function resolveApprovedApps(env: EnvironmentName): string[] {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const output = runJsonCommand(pnpm, ['tsx', 'scripts/release/resolve-deploy-apps.ts', '--env', env, '--apps', 'all']) as ResolveOutput
  return Array.isArray(output.approvedApps) ? output.approvedApps : []
}

async function lookupDns(url: string | null): Promise<DnsStatus | null> {
  if (!url) return null
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  try {
    const records = await dns.lookup(host, { all: true })
    return {
      host,
      resolves: records.length > 0,
      addresses: records.map((rec) => rec.address),
    }
  } catch (err) {
    return {
      host,
      resolves: false,
      addresses: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function getSubscriptionId(): string | null {
  try {
    return runTextCommand('az', ['account', 'show', '--query', 'id', '-o', 'tsv']) || null
  } catch {
    return null
  }
}

function resourceGroupExists(resourceGroup: string): boolean {
  try {
    const exists = runTextCommand('az', ['group', 'exists', '--name', resourceGroup, '-o', 'tsv'])
    return exists.toLowerCase() === 'true'
  } catch {
    return false
  }
}

function containerAppEnvironmentExists(resourceGroup: string, environmentName: string | null): boolean | null {
  if (!environmentName) return null
  try {
    runJsonCommand('az', [
      'containerapp',
      'env',
      'show',
      '--name',
      environmentName,
      '--resource-group',
      resourceGroup,
      '--output',
      'json',
    ])
    return true
  } catch {
    return false
  }
}

function listContainerApps(resourceGroup: string): string[] {
  try {
    const output = runJsonCommand('az', ['containerapp', 'list', '--resource-group', resourceGroup, '--query', '[].name', '-o', 'json'])
    return Array.isArray(output) ? output.filter((n): n is string => typeof n === 'string') : []
  } catch {
    return []
  }
}

function readAppDetails(containerAppName: string, resourceGroup: string): Record<string, unknown> | null {
  try {
    return runJsonCommand('az', [
      'containerapp',
      'show',
      '--name',
      containerAppName,
      '--resource-group',
      resourceGroup,
      '--output',
      'json',
    ]) as Record<string, unknown>
  } catch {
    return null
  }
}

function readRevisions(containerAppName: string, resourceGroup: string): Array<Record<string, unknown>> {
  try {
    const output = runJsonCommand('az', [
      'containerapp',
      'revision',
      'list',
      '--name',
      containerAppName,
      '--resource-group',
      resourceGroup,
      '--output',
      'json',
    ])
    return Array.isArray(output) ? output.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : []
  } catch {
    return []
  }
}

function parseSecretPosture(details: Record<string, unknown> | null): SecretPosture {
  if (!details) {
    return {
      totalEnvVars: 0,
      secretRefCount: 0,
      plainValueCount: 0,
      sensitivePlainValueCount: 0,
      sensitivePlainValueKeys: [],
    }
  }

  const props = (details.properties ?? {}) as Record<string, unknown>
  const template = (props.template ?? {}) as Record<string, unknown>
  const containers = Array.isArray(template.containers) ? template.containers : []

  const envVars: Array<{ name: string; hasValue: boolean; hasSecretRef: boolean }> = []
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue
    const env = Array.isArray((container as Record<string, unknown>).env)
      ? ((container as Record<string, unknown>).env as Array<Record<string, unknown>>)
      : []
    for (const item of env) {
      const name = typeof item.name === 'string' ? item.name : ''
      if (!name) continue
      envVars.push({
        name,
        hasValue: Object.prototype.hasOwnProperty.call(item, 'value'),
        hasSecretRef: Object.prototype.hasOwnProperty.call(item, 'secretRef'),
      })
    }
  }

  const secretRefCount = envVars.filter((e) => e.hasSecretRef).length
  const plainValueCount = envVars.filter((e) => e.hasValue).length
  const sensitivePlain = envVars.filter((e) => e.hasValue && SENSITIVE_ENV_KEY_RE.test(e.name))

  return {
    totalEnvVars: envVars.length,
    secretRefCount,
    plainValueCount,
    sensitivePlainValueCount: sensitivePlain.length,
    sensitivePlainValueKeys: [...new Set(sensitivePlain.map((e) => e.name))],
  }
}

function parseTraffic(details: Record<string, unknown> | null): Array<{ revisionName: string | null; weight: number | null; latestRevision: boolean }> {
  if (!details) return []
  const props = (details.properties ?? {}) as Record<string, unknown>
  const configuration = (props.configuration ?? {}) as Record<string, unknown>
  const ingress = (configuration.ingress ?? {}) as Record<string, unknown>
  const traffic = Array.isArray(ingress.traffic) ? ingress.traffic : []

  return traffic.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return {
      revisionName: typeof item.revisionName === 'string' ? item.revisionName : null,
      weight: typeof item.weight === 'number' ? item.weight : (typeof item.weight === 'string' ? Number(item.weight) : null),
      latestRevision: item.latestRevision === true,
    }
  })
}

function parseIdentity(details: Record<string, unknown> | null): { present: boolean; type: string | null; principalId: string | null; tenantId: string | null } {
  const identity = details?.identity as Record<string, unknown> | undefined
  const type = typeof identity?.type === 'string' ? identity.type : null
  return {
    present: !!type && type.toLowerCase() !== 'none',
    type,
    principalId: typeof identity?.principalId === 'string' ? identity.principalId : null,
    tenantId: typeof identity?.tenantId === 'string' ? identity.tenantId : null,
  }
}

function parseRollbackCandidates(revisions: Array<Record<string, unknown>>): { count: number; names: string[] } {
  const candidates = revisions.filter((rev) => {
    const props = (rev.properties ?? {}) as Record<string, unknown>
    const active = props.active === true
    const healthState = typeof props.healthState === 'string' ? props.healthState.toLowerCase() : ''
    const runningState = typeof props.runningState === 'string' ? props.runningState.toLowerCase() : ''
    const healthy = healthState === 'healthy' || runningState === 'running'
    return !active && healthy
  })
  return {
    count: candidates.length,
    names: candidates
      .map((rev) => (typeof rev.name === 'string' ? rev.name : null))
      .filter((name): name is string => !!name),
  }
}

async function assessEnvironment(
  inventory: DeploymentInventory,
  env: EnvironmentName,
  liveMode: boolean,
): Promise<EnvironmentAssessment> {
  const approvedApps = resolveApprovedApps(env)
  const envConfig = resolveEnvConfig(inventory, env)
  const policyMissingExpected = inventory.verificationPolicy?.stagingMissingExpected ?? 'warn'
  const strategy = inventory.topology?.strategy ?? (envConfig.sharedWithStaging ? 'shared-resource-group-environment' : 'dedicated-resource-groups')

  if (!liveMode) {
    const emptyAssessment: EnvironmentAssessment = {
      environment: env,
      expectedResourceGroup: envConfig.resourceGroup,
      expectedContainerAppEnvironment: envConfig.containerAppEnvironment,
      resourceGroupExists: false,
      containerAppEnvironmentExists: null,
      topologyStrategy: strategy,
      sharedWithStaging: envConfig.sharedWithStaging,
      expectedApps: approvedApps,
      deployedAppsInResourceGroup: [],
      assessments: approvedApps.map((app) => ({
        expectedAppName: app,
        expectedContainerAppName: `nzila-os-${aliasLogicalApp(app)}`,
        expectedResourceGroup: envConfig.resourceGroup,
        expectedRoute: normalizeRoute(inventory.apps[app]?.routing?.[env]),
        expectedHealthPath: inventory.apps[app]?.routing?.healthPath ?? '/api/health',
        exists: false,
        provisioningState: null,
        runningState: null,
        latestRevision: null,
        latestReadyRevision: null,
        image: null,
        ingressFqdn: null,
        trafficWeights: [],
        identity: { present: false, type: null, principalId: null, tenantId: null },
        rollbackCandidateCount: 0,
        rollbackCandidates: [],
        customDomain: null,
        dnsStatus: null,
        secretPosture: {
          totalEnvVars: 0,
          secretRefCount: 0,
          plainValueCount: 0,
          sensitivePlainValueCount: 0,
          sensitivePlainValueKeys: [],
        },
        status: 'unknown',
        severity: 'none',
        issues: ['bootstrap mode: live Azure ingestion not requested'],
      })),
      summary: {
        expectedCount: approvedApps.length,
        deployedCount: 0,
        passCount: 0,
        warnCount: 0,
        failCount: 0,
        missingExpectedCount: approvedApps.length,
        blockerCount: 0,
      },
      overallStatus: 'unknown',
      blockingFindings: [],
      advisoryFindings: ['bootstrap mode: Azure footprint not validated'],
    }
    return emptyAssessment
  }

  const groupExists = resourceGroupExists(envConfig.resourceGroup)
  const envExists = groupExists
    ? containerAppEnvironmentExists(envConfig.resourceGroup, envConfig.containerAppEnvironment)
    : false
  const deployedApps = groupExists ? listContainerApps(envConfig.resourceGroup) : []

  const blockingFindings: string[] = []
  const advisoryFindings: string[] = []

  if (!groupExists) {
    const msg = `[${env}] expected resource group missing: ${envConfig.resourceGroup}`
    if (env === 'production') blockingFindings.push(msg)
    else advisoryFindings.push(msg)
  }

  if (groupExists && envExists === false && envConfig.containerAppEnvironment) {
    const msg = `[${env}] expected Container Apps environment missing: ${envConfig.containerAppEnvironment}`
    if (env === 'production') blockingFindings.push(msg)
    else advisoryFindings.push(msg)
  }

  const assessments: AppAssessment[] = []
  for (const logicalApp of approvedApps) {
    const mapped = aliasLogicalApp(logicalApp)
    const containerAppName = `nzila-os-${mapped}`
    const appInventory = inventory.apps[logicalApp]
    const route = normalizeRoute(appInventory?.routing?.[env])
    const healthPath = appInventory?.routing?.healthPath ?? '/api/health'
    const dnsStatus = await lookupDns(route)
    const customDomain = route
      ? (() => {
          try {
            const host = new URL(route).hostname
            return (host === 'azurecontainerapps.io' || host.endsWith('.azurecontainerapps.io')) ? null : host
          } catch {
            return null
          }
        })()
      : null

    const issues: string[] = []
    let severity: AppAssessment['severity'] = 'none'
    let status: AppAssessment['status'] = 'pass'

    const details = groupExists ? readAppDetails(containerAppName, envConfig.resourceGroup) : null
    const exists = !!details

    if (!exists) {
      const missingMsg = `[${env}] expected app missing: ${logicalApp} (${containerAppName})`
      issues.push(missingMsg)
      if (env === 'production' || policyMissingExpected === 'fail') {
        severity = 'blocker'
        status = 'fail'
        blockingFindings.push(missingMsg)
      } else {
        severity = 'warn'
        status = 'warn'
        advisoryFindings.push(missingMsg)
      }
    }

    const props = (details?.properties ?? {}) as Record<string, unknown>
    const template = (props.template ?? {}) as Record<string, unknown>
    const containers = Array.isArray(template.containers)
      ? (template.containers as Array<Record<string, unknown>>)
      : []
    const firstContainer = containers[0] ?? {}
    const image = typeof firstContainer.image === 'string' ? firstContainer.image : null

    const provisioningState = typeof props.provisioningState === 'string' ? props.provisioningState : null
    const runningState = typeof props.runningStatus === 'string' ? props.runningStatus : null
    const latestRevision = typeof props.latestRevisionName === 'string' ? props.latestRevisionName : null
    const latestReadyRevision = typeof props.latestReadyRevisionName === 'string' ? props.latestReadyRevisionName : null

    if (exists && provisioningState?.toLowerCase() !== 'succeeded') {
      const msg = `[${env}] ${logicalApp} provisioning state is ${provisioningState ?? 'unknown'}`
      issues.push(msg)
      if (env === 'production') {
        severity = 'blocker'
        status = 'fail'
        blockingFindings.push(msg)
      } else {
        severity = severity === 'blocker' ? severity : 'warn'
        status = status === 'fail' ? status : 'warn'
        advisoryFindings.push(msg)
      }
    }

    if (exists && runningState?.toLowerCase() !== 'running') {
      const msg = `[${env}] ${logicalApp} running state is ${runningState ?? 'unknown'}`
      issues.push(msg)
      if (env === 'production') {
        severity = 'blocker'
        status = 'fail'
        blockingFindings.push(msg)
      } else {
        severity = severity === 'blocker' ? severity : 'warn'
        status = status === 'fail' ? status : 'warn'
        advisoryFindings.push(msg)
      }
    }

    if (env === 'production' && customDomain && dnsStatus && !dnsStatus.resolves) {
      const msg = `[production] ${logicalApp} custom domain DNS unresolved: ${customDomain}`
      issues.push(msg)
      severity = 'blocker'
      status = 'fail'
      blockingFindings.push(msg)
    }

    const revisions = exists ? readRevisions(containerAppName, envConfig.resourceGroup) : []
    const rollback = parseRollbackCandidates(revisions)
    const rollbackException = appInventory?.rollbackException === true
    if (env === 'production' && exists && rollback.count === 0 && !rollbackException) {
      const msg = `[production] ${logicalApp} has no rollback candidate revision`
      issues.push(msg)
      severity = 'blocker'
      status = 'fail'
      blockingFindings.push(msg)
    }

    const secretPosture = parseSecretPosture(details)
    if (env === 'production' && secretPosture.sensitivePlainValueCount > 0) {
      const msg = `[production] ${logicalApp} has sensitive env vars configured as plain values: ${secretPosture.sensitivePlainValueKeys.join(', ')}`
      issues.push(msg)
      severity = 'blocker'
      status = 'fail'
      blockingFindings.push(msg)
    }

    const ingressFqdn = (() => {
      const config = (props.configuration ?? {}) as Record<string, unknown>
      const ingress = (config.ingress ?? {}) as Record<string, unknown>
      return typeof ingress.fqdn === 'string' ? ingress.fqdn : null
    })()

    assessments.push({
      expectedAppName: logicalApp,
      expectedContainerAppName: containerAppName,
      expectedResourceGroup: envConfig.resourceGroup,
      expectedRoute: route,
      expectedHealthPath: healthPath,
      exists,
      provisioningState,
      runningState,
      latestRevision,
      latestReadyRevision,
      image,
      ingressFqdn,
      trafficWeights: parseTraffic(details),
      identity: parseIdentity(details),
      rollbackCandidateCount: rollback.count,
      rollbackCandidates: rollback.names,
      customDomain,
      dnsStatus,
      secretPosture,
      status,
      severity,
      issues,
    })
  }

  const passCount = assessments.filter((a) => a.status === 'pass').length
  const warnCount = assessments.filter((a) => a.status === 'warn').length
  const failCount = assessments.filter((a) => a.status === 'fail').length
  const missingExpectedCount = assessments.filter((a) => !a.exists).length
  const blockerCount = assessments.filter((a) => a.severity === 'blocker').length

  const overallStatus: EnvironmentAssessment['overallStatus'] =
    blockerCount > 0 || failCount > 0
      ? 'critical'
      : warnCount > 0 || advisoryFindings.length > 0
        ? 'degraded'
        : 'healthy'

  return {
    environment: env,
    expectedResourceGroup: envConfig.resourceGroup,
    expectedContainerAppEnvironment: envConfig.containerAppEnvironment,
    resourceGroupExists: groupExists,
    containerAppEnvironmentExists: envExists,
    topologyStrategy: strategy,
    sharedWithStaging: envConfig.sharedWithStaging,
    expectedApps: approvedApps,
    deployedAppsInResourceGroup: deployedApps,
    assessments,
    summary: {
      expectedCount: approvedApps.length,
      deployedCount: assessments.filter((a) => a.exists).length,
      passCount,
      warnCount,
      failCount,
      missingExpectedCount,
      blockerCount,
    },
    overallStatus,
    blockingFindings,
    advisoryFindings,
  }
}

function mapLegacyApps(environments: EnvironmentAssessment[]): AzureRuntimeSnapshot['apps'] {
  const staging = environments.find((e) => e.environment === 'staging')
  if (!staging) return []
  return staging.assessments.map((app) => ({
    name: app.expectedContainerAppName,
    provisioningState: app.provisioningState,
    runningState: app.runningState,
    fqdn: app.ingressFqdn,
    revision: app.latestRevision,
    image: app.image,
    trafficWeight: app.trafficWeights.find((t) => t.latestRevision)?.weight ?? null,
    healthResult:
      app.status === 'pass' ? 'healthy'
      : app.status === 'warn' ? 'degraded'
      : app.status === 'fail' ? 'critical'
      : 'unknown',
    bootstrapEvidence: false,
    status: app.status === 'fail' ? 'fail' : app.status === 'pass' ? 'pass' : 'unknown',
  }))
}

async function main(): Promise<void> {
  const liveMode = process.env.AZ_LIVE_INGEST === 'true'
  const now = new Date().toISOString()

  console.log(`[ingest-azure-runtime] mode=${liveMode ? 'LIVE' : 'local/bootstrap'}`)

  const inventory = parseInventory()
  const stagingCfg = resolveEnvConfig(inventory, 'staging')
  const productionCfg = resolveEnvConfig(inventory, 'production')

  const environments = await Promise.all([
    assessEnvironment(inventory, 'staging', liveMode),
    assessEnvironment(inventory, 'production', liveMode),
  ])

  const blockingFindings = environments.flatMap((env) => env.blockingFindings)
  const advisoryFindings = environments.flatMap((env) => env.advisoryFindings)

  const overallStatus: AzureRuntimeSnapshot['overallStatus'] = !liveMode
    ? 'unknown'
    : blockingFindings.length > 0
      ? 'critical'
      : advisoryFindings.length > 0 || environments.some((env) => env.overallStatus === 'degraded')
        ? 'degraded'
        : 'healthy'

  const snapshot: AzureRuntimeSnapshot = {
    ingestedAt: now,
    subscriptionId: liveMode ? getSubscriptionId() : null,
    topologyDecision: {
      strategy: inventory.topology?.strategy ?? (productionCfg.sharedWithStaging ? 'shared-resource-group-environment' : 'dedicated-resource-groups'),
      expectedShared: productionCfg.sharedWithStaging,
      stagingResourceGroup: stagingCfg.resourceGroup,
      productionResourceGroup: productionCfg.resourceGroup,
      stagingEnvironment: stagingCfg.containerAppEnvironment,
      productionEnvironment: productionCfg.containerAppEnvironment,
    },
    environments,
    apps: mapLegacyApps(environments),
    blockingFindings,
    advisoryFindings,
    overallStatus,
    bootstrapEvidence: !liveMode,
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')

  console.log(`[ingest-azure-runtime] Written: ${OUTPUT_FILE}`)
  console.log(`  environments=${environments.length}, blocking=${blockingFindings.length}, advisory=${advisoryFindings.length}, overall=${overallStatus}`)
}

main().catch((err: unknown) => {
  console.error('[ingest-azure-runtime] Fatal error:', err)
  process.exit(1)
})
