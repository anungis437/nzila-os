/**
 * Read-only Union Eyes V2 staging control-plane inventory.
 *
 * The command list is closed. Live execution is refused unless the GitHub
 * Actions environment is the manual dispatch of anungis437/nzila-os on main.
 * This module never opens SQL and never calls a mutating Azure command.
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const REPOSITORY = 'anungis437/nzila-os'
export const DEFAULT_REF = 'refs/heads/main'
export const SUBSCRIPTION_ID = 'd562ba7f-d891-4504-a489-10917c0ebaaf'
export const TENANT_ID = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a'
export const RESOURCE_GROUP = 'nzila-canada-staging-rg'
export const CONTAINER_APP = 'nzila-ue-v2-staging-app'
export const POSTGRES_SERVER = 'nzila-ue-v2-staging-db-d562ba7f'

const APP_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${CONTAINER_APP}`
const POSTGRES_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${POSTGRES_SERVER}`
const GROUP_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}`

const SECRET_KEY = /password|secret|token|connectionstring|accountkey|credential/i
const SECRET_TEXT = /(?:postgres(?:ql)?:\/\/\S+|bearer\s+\S+|accountkey=\S+|password=\S+|pwd=\S+)/gi

export const COMMANDS = Object.freeze([
  command('account', true, ['account', 'show', '--query', '{subscriptionId:id,tenantId:tenantId}', '--only-show-errors', '-o', 'json']),
  command('resource-group', true, ['group', 'show', '--name', RESOURCE_GROUP, '--query', '{id:id,name:name,location:location}', '--only-show-errors', '-o', 'json']),
  command('container-app', true, ['containerapp', 'show', '--resource-group', RESOURCE_GROUP, '--name', CONTAINER_APP, '--query', '{id:id,name:name,location:location,provisioningState:properties.provisioningState,latestRevisionName:properties.latestRevisionName,latestReadyRevisionName:properties.latestReadyRevisionName,runningStatus:properties.runningStatus,traffic:properties.configuration.ingress.traffic[].{revisionName:revisionName,weight:weight,label:label}}', '--only-show-errors', '-o', 'json']),
  command('revisions', true, ['containerapp', 'revision', 'list', '--resource-group', RESOURCE_GROUP, '--name', CONTAINER_APP, '--query', '[].{name:name,active:properties.active,healthState:properties.healthState,provisioningState:properties.provisioningState,trafficWeight:properties.trafficWeight,replicas:properties.replicas,createdTime:properties.createdTime,image:properties.template.containers[0].image,revisionSuffix:properties.template.revisionSuffix}', '--only-show-errors', '-o', 'json']),
  command('postgres-server', true, ['postgres', 'flexible-server', 'show', '--resource-group', RESOURCE_GROUP, '--name', POSTGRES_SERVER, '--query', '{id:id,name:name,version:version,state:state,fullyQualifiedDomainName:fullyQualifiedDomainName,publicNetworkAccess:network.publicNetworkAccess,delegatedSubnetResourceId:network.delegatedSubnetResourceId,privateDnsZoneArmResourceId:network.privateDnsZoneArmResourceId}', '--only-show-errors', '-o', 'json']),
  ...['max_connections', 'reserved_connections', 'superuser_reserved_connections'].map((name) => command(`postgres-parameter:${name}`, false, ['postgres', 'flexible-server', 'parameter', 'show', '--subscription', SUBSCRIPTION_ID, '--resource-group', RESOURCE_GROUP, '--server-name', POSTGRES_SERVER, '--name', name, '--query', '{name:name,value:value,source:source}', '--only-show-errors', '-o', 'json'])),
])

function command(id, required, args) {
  return Object.freeze({ id, required, args: Object.freeze(args) })
}

export function liveAuthorization(env) {
  const defects = []
  if (env.UE_INVENTORY_LIVE !== '1') defects.push('LIVE_NOT_AUTHORIZED')
  if (env.GITHUB_REPOSITORY !== REPOSITORY) defects.push('WRONG_REPOSITORY')
  if (env.GITHUB_REF !== DEFAULT_REF) defects.push('NOT_DEFAULT_BRANCH')
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') defects.push('NOT_MANUAL_DISPATCH')
  return defects
}

export function sanitizeText(value) {
  return String(value ?? '').replace(SECRET_TEXT, '[redacted]').slice(0, 240)
}

function observed(value) {
  if (value === undefined || value === null || value === '') return { classification: 'NOT_OBSERVED', value: null }
  return { classification: 'OBSERVED', value }
}

function notObserved(reason) {
  return { classification: 'NOT_OBSERVED', value: null, reason: sanitizeText(reason) }
}

function assertSafe(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw new Error('UNSAFE_FIELD')
    assertSafe(child)
  }
}

function sameId(actual, expected) {
  return String(actual ?? '').toLowerCase() === expected.toLowerCase()
}

function weight(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function servingFrom(revisions, traffic) {
  const weighted = (revisions ?? []).filter((revision) => weight(revision.trafficWeight) > 0)
  const full = weighted.filter((revision) => weight(revision.trafficWeight) === 100)
  const trafficFull = (traffic ?? []).filter((item) => weight(item.weight) === 100)
  if (full.length !== 1) return { defect: 'SERVING_REVISION_NOT_ESTABLISHED' }
  const selected = full[0]
  if (trafficFull.length > 0 && trafficFull.some((item) => item.revisionName !== selected.name)) return { defect: 'SERVING_TRAFFIC_CONFLICT' }
  if (weighted.length !== 1) return { defect: 'SERVING_TRAFFIC_CONFLICT' }
  return { revision: selected }
}

export function buildInventory({ results, provenance }) {
  const byId = new Map(results.map((result) => [result.id, result]))
  const defects = []
  const read = (id) => {
    const result = byId.get(id)
    if (!result || result.skipped) return { ok: false, body: null, reason: result?.reason ?? 'NOT_RUN' }
    if (result.exitCode !== 0) return { ok: false, body: null, reason: `EXIT_${result.exitCode}:${sanitizeText(result.stderr)}` }
    try {
      const body = JSON.parse(result.stdout)
      assertSafe(body)
      return { ok: true, body }
    } catch (error) {
      return { ok: false, body: null, reason: error.message === 'UNSAFE_FIELD' ? 'UNSAFE_FIELD' : 'UNREADABLE_RESPONSE' }
    }
  }

  const account = read('account')
  const subscriptionMatches = account.ok && account.body.subscriptionId === SUBSCRIPTION_ID
  const tenantMatches = account.ok && account.body.tenantId === TENANT_ID
  if (!account.ok) defects.push('ACCOUNT_NOT_OBSERVED')
  if (account.ok && !subscriptionMatches) defects.push('WRONG_SUBSCRIPTION')
  if (account.ok && !tenantMatches) defects.push('WRONG_TENANT')
  const identityTrusted = subscriptionMatches && tenantMatches

  const fields = {}
  const take = (id, expectedId) => {
    if (!identityTrusted) return notObserved(account.ok ? 'TARGET_REFUSED' : 'ACCOUNT_NOT_OBSERVED')
    const result = read(id)
    if (!result.ok) {
      defects.push(`${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_NOT_OBSERVED`)
      return notObserved(result.reason)
    }
    if (expectedId && !sameId(result.body.id, expectedId)) {
      defects.push(`${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_IDENTITY_MISMATCH`)
      return notObserved('IDENTITY_MISMATCH')
    }
    return { classification: 'OBSERVED', value: result.body }
  }

  fields.resourceGroup = take('resource-group', GROUP_ID)
  fields.containerApp = take('container-app', APP_ID)
  const revisionRead = identityTrusted ? read('revisions') : { ok: false, reason: account.ok ? 'TARGET_REFUSED' : 'ACCOUNT_NOT_OBSERVED' }
  let revisions = notObserved(revisionRead.reason ?? 'NOT_RUN')
  let serving = notObserved(revisionRead.reason ?? 'NOT_RUN')
  if (identityTrusted && !revisionRead.ok) defects.push('REVISIONS_NOT_OBSERVED')
  if (revisionRead.ok) {
    if (!Array.isArray(revisionRead.body)) {
      defects.push('REVISIONS_NOT_OBSERVED')
      revisions = notObserved('UNREADABLE_RESPONSE')
    } else {
      revisions = { classification: 'OBSERVED', value: revisionRead.body }
      const decision = servingFrom(revisionRead.body, fields.containerApp.value?.traffic)
      if (decision.defect) {
        defects.push(decision.defect)
        serving = notObserved(decision.defect)
      } else {
        serving = {
          classification: 'OBSERVED',
          value: {
            name: decision.revision.name,
            trafficWeight: 100,
            image: decision.revision.image ?? null,
            healthState: decision.revision.healthState ?? null,
            revisionSuffix: decision.revision.revisionSuffix ?? null,
          },
        }
      }
    }
  }
  fields.postgresServer = take('postgres-server', POSTGRES_ID)

  const parameters = {}
  for (const parameter of ['max_connections', 'reserved_connections', 'superuser_reserved_connections']) {
    const id = `postgres-parameter:${parameter}`
    if (!identityTrusted) {
      parameters[parameter] = notObserved(account.ok ? 'TARGET_REFUSED' : 'ACCOUNT_NOT_OBSERVED')
      continue
    }
    const result = read(id)
    parameters[parameter] = result.ok ? { classification: 'OBSERVED', value: result.body } : notObserved(result.reason)
  }

  const inventory = {
    schema: 'ue-v2-staging-readonly-inventory/v1',
    provenance: {
      classification: 'OBSERVED',
      repository: provenance.repository,
      ref: provenance.ref,
      workflowSha: provenance.workflowSha,
      runId: provenance.runId,
      observedAt: provenance.observedAt,
      commands: results.map((result) => ({ id: result.id, args: result.args, exitCode: result.exitCode, skipped: Boolean(result.skipped) })),
    },
    acceptance: { ok: defects.length === 0, defects },
    account: {
      subscriptionId: account.ok ? observed(account.body.subscriptionId) : notObserved(account.reason),
      tenantId: account.ok ? observed(account.body.tenantId) : notObserved(account.reason),
    },
    resourceGroup: fields.resourceGroup,
    containerApp: fields.containerApp,
    revisions,
    servingRevision: serving,
    postgresServer: fields.postgresServer,
    postgresParameters: parameters,
  }
  return inventory
}

export function executePlan(env, execFile) {
  const defects = liveAuthorization(env)
  if (defects.length > 0) return { exitCode: 2, inventory: null, defects }
  const bin = env.GITHUB_ACTIONS === 'true' ? 'az' : (env.UE_INVENTORY_AZ_BIN || 'az')
  const results = []
  let stop = false
  let stopReason = null
  for (const spec of COMMANDS) {
    if (stop) {
      results.push({ id: spec.id, args: spec.args, exitCode: null, skipped: true, reason: stopReason })
      continue
    }
    let outcome
    try {
      const stdout = execFile(bin, spec.args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })
      outcome = { exitCode: 0, stdout, stderr: '' }
    } catch (error) {
      outcome = { exitCode: error.status ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message }
    }
    results.push({ id: spec.id, args: spec.args, ...outcome })
    if (spec.id === 'account') {
      stopReason = accountDecision(outcome)
      stop = stopReason !== null
    }
  }
  const inventory = buildInventory({ results, provenance: provenanceFrom(env) })
  return { exitCode: inventory.acceptance.ok ? 0 : 1, inventory }
}

function accountDecision(outcome) {
  if (outcome.exitCode !== 0) return 'ACCOUNT_NOT_OBSERVED'
  try {
    const body = JSON.parse(outcome.stdout)
    assertSafe(body)
    if (body.subscriptionId !== SUBSCRIPTION_ID) return 'WRONG_SUBSCRIPTION'
    if (body.tenantId !== TENANT_ID) return 'WRONG_TENANT'
    return null
  } catch (error) {
    return error.message === 'UNSAFE_FIELD' ? 'UNSAFE_FIELD' : 'ACCOUNT_NOT_OBSERVED'
  }
}

function provenanceFrom(env) {
  return {
    repository: env.GITHUB_REPOSITORY,
    ref: env.GITHUB_REF,
    workflowSha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    observedAt: env.UE_INVENTORY_OBSERVED_AT || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
}

export function writeInventory(directory, inventory) {
  mkdirSync(directory, { recursive: true })
  const body = `${JSON.stringify(inventory, null, 2)}\n`
  const file = path.join(directory, 'inventory.json')
  writeFileSync(file, body)
  const digest = createHash('sha256').update(body).digest('hex')
  writeFileSync(path.join(directory, 'SHA256SUMS'), `${digest}  inventory.json\n`)
  return digest
}

function main() {
  const outFlag = process.argv.indexOf('--out')
  const directory = outFlag >= 0 ? process.argv[outFlag + 1] : ''
  if (!directory) {
    console.error('INVENTORY_OUTPUT_REQUIRED')
    process.exit(2)
  }
  const result = executePlan(process.env, execFileSync)
  if (result.inventory) writeInventory(directory, result.inventory)
  if (result.defects?.length) console.error(result.defects.join(','))
  else if (!result.inventory.acceptance.ok) console.error(result.inventory.acceptance.defects.join(','))
  process.exit(result.exitCode)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
