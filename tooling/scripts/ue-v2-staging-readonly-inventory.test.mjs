import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  COMMANDS,
  CONTAINER_APP,
  DEFAULT_REF,
  POSTGRES_SERVER,
  REPOSITORY,
  RESOURCE_GROUP,
  SUBSCRIPTION_ID,
  TENANT_ID,
  buildInventory,
  executePlan,
  liveAuthorization,
  writeInventory,
} from './ue-v2-staging-readonly-inventory.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(REPO, 'package.json'))
const YAML = require('yaml')
const WORKFLOW = path.join(REPO, '.github/workflows/ue-v2-staging-readonly-inventory.yml')
const SCRIPT = path.join(REPO, 'tooling/scripts/ue-v2-staging-readonly-inventory.mjs')
const APP_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/containerApps/${CONTAINER_APP}`
const POSTGRES_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${POSTGRES_SERVER}`
const GROUP_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}`
const PROVENANCE = { repository: REPOSITORY, ref: DEFAULT_REF, workflowSha: 'a'.repeat(40), runId: '1', observedAt: '2026-11-26T01:10:00Z' }

function success(id, body) {
  const spec = COMMANDS.find((command) => command.id === id)
  return { id, args: spec.args, exitCode: 0, stdout: JSON.stringify(body), stderr: '' }
}

function positiveResults() {
  return [
    success('account', { subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID }),
    success('resource-group', { id: GROUP_ID, name: RESOURCE_GROUP, location: 'canadacentral' }),
    success('container-app', { id: APP_ID, name: CONTAINER_APP, provisioningState: 'Succeeded', latestRevisionName: 'app--rela', latestReadyRevisionName: 'app--rela', runningStatus: 'Running', traffic: [{ revisionName: 'app--rela', weight: 100, label: null }] }),
    success('revisions', [{ name: 'app--rela', active: true, healthState: 'Healthy', provisioningState: 'Provisioned', trafficWeight: 100, replicas: 1, createdTime: '2026-11-20T00:00:00Z', image: 'example.azurecr.io/app@sha256:' + '1'.repeat(64), revisionSuffix: 'rela' }, { name: 'app--relb', active: false, healthState: 'Healthy', provisioningState: 'Provisioned', trafficWeight: 0, replicas: 0, createdTime: '2026-11-19T00:00:00Z', image: 'example.azurecr.io/app@sha256:' + '2'.repeat(64), revisionSuffix: 'relb' }]),
    success('postgres-server', { id: POSTGRES_ID, name: POSTGRES_SERVER, version: '16', state: 'Ready', fullyQualifiedDomainName: `${POSTGRES_SERVER}.postgres.database.azure.com`, publicNetworkAccess: 'Disabled', delegatedSubnetResourceId: 'subnet', privateDnsZoneArmResourceId: 'zone' }),
    success('postgres-parameter:max_connections', { name: 'max_connections', value: '50', source: 'user-override' }),
    success('postgres-parameter:reserved_connections', { name: 'reserved_connections', value: '0', source: 'system-default' }),
    { id: 'postgres-parameter:superuser_reserved_connections', args: COMMANDS.at(-1).args, exitCode: 1, stdout: '', stderr: 'AuthorizationFailed bearer secret-value' },
  ]
}

function classifications(value, found = []) {
  if (value && typeof value === 'object') {
    if (typeof value.classification === 'string') found.push(value.classification)
    for (const child of Object.values(value)) classifications(child, found)
  }
  return found
}

test('a complete pinned read establishes one serving revision and keeps a denied parameter optional', () => {
  const inventory = buildInventory({ results: positiveResults(), provenance: PROVENANCE })
  assert.equal(inventory.acceptance.ok, true)
  assert.deepEqual(inventory.acceptance.defects, [])
  assert.equal(inventory.account.subscriptionId.classification, 'OBSERVED')
  assert.equal(inventory.servingRevision.value.name, 'app--rela')
  assert.equal(inventory.servingRevision.value.trafficWeight, 100)
  assert.equal(inventory.revisions.value.length, 2)
  assert.equal(inventory.postgresParameters.superuser_reserved_connections.classification, 'NOT_OBSERVED')
  assert.match(inventory.postgresParameters.superuser_reserved_connections.reason, /\[redacted\]/)
  assert.equal(inventory.postgresParameters.superuser_reserved_connections.reason.includes('secret-value'), false)
  assert.deepEqual(classifications(inventory).filter((item) => item !== 'OBSERVED' && item !== 'NOT_OBSERVED'), [])
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-inventory-'))
  try {
    const digest = writeInventory(directory, inventory)
    const body = readFileSync(path.join(directory, 'inventory.json'))
    assert.equal(digest, createHash('sha256').update(body).digest('hex'))
    assert.equal(readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8'), `${digest}  inventory.json\n`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a wrong subscription stops before any other Azure read', () => {
  const calls = []
  const result = executePlan({ ...liveEnv(), UE_INVENTORY_AZ_BIN: 'unused' }, (_bin, args) => {
    calls.push(args[0])
    if (args[0] !== 'account') throw new Error('READ_AFTER_WRONG_SUBSCRIPTION')
    return JSON.stringify({ subscriptionId: '00000000-0000-0000-0000-000000000000', tenantId: TENANT_ID })
  })
  assert.equal(result.exitCode, 1)
  assert.deepEqual(calls, ['account'])
  assert.equal(result.inventory.acceptance.defects.includes('WRONG_SUBSCRIPTION'), true)
  assert.equal(result.inventory.containerApp.classification, 'NOT_OBSERVED')
  assert.equal(result.inventory.servingRevision.classification, 'NOT_OBSERVED')
  assert.equal(JSON.stringify(result.inventory).includes('cccfc8c'), false)
})

test('a refused account read records the failure and does not invent a serving revision', () => {
  const inventory = buildInventory({
    results: [{ id: 'account', args: COMMANDS[0].args, exitCode: 1, stdout: '', stderr: 'AuthorizationFailed' }],
    provenance: PROVENANCE,
  })
  assert.equal(inventory.acceptance.ok, false)
  assert.equal(inventory.account.subscriptionId.classification, 'NOT_OBSERVED')
  assert.equal(inventory.servingRevision.classification, 'NOT_OBSERVED')
})

test('a missing container app fails target identity without dropping the account observation', () => {
  const results = positiveResults()
  const app = results.find((result) => result.id === 'container-app')
  app.exitCode = 3
  app.stdout = ''
  app.stderr = 'ResourceNotFound'
  const inventory = buildInventory({ results, provenance: PROVENANCE })
  assert.equal(inventory.acceptance.ok, false)
  assert.equal(inventory.account.subscriptionId.value, SUBSCRIPTION_ID)
  assert.equal(inventory.containerApp.classification, 'NOT_OBSERVED')
  assert.match(inventory.containerApp.reason, /ResourceNotFound/)
})

test('an unsafe projection is discarded', () => {
  const results = positiveResults()
  results[0].stdout = JSON.stringify({ subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID, password: 'nope' })
  const inventory = buildInventory({ results, provenance: PROVENANCE })
  assert.equal(inventory.account.subscriptionId.classification, 'NOT_OBSERVED')
  assert.equal(JSON.stringify(inventory).includes('nope'), false)
})

test('live execution is refused outside main manual dispatch and does not call Azure', () => {
  assert.deepEqual(liveAuthorization({ UE_INVENTORY_LIVE: '1', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/pull/1/merge', GITHUB_EVENT_NAME: 'workflow_dispatch' }), ['NOT_DEFAULT_BRANCH'])
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-az-'))
  const marker = path.join(directory, 'called')
  writeFileSync(path.join(directory, 'az'), `#!/bin/sh\necho called > ${JSON.stringify(marker)}\nexit 9\n`)
  chmodSync(path.join(directory, 'az'), 0o755)
  const run = spawnSync(process.execPath, [SCRIPT, '--out', path.join(directory, 'out')], {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, UE_INVENTORY_LIVE: '1', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/pull/1312/merge', GITHUB_EVENT_NAME: 'pull_request', GITHUB_ACTIONS: 'true' },
    encoding: 'utf8',
  })
  assert.equal(run.status, 2)
  assert.throws(() => readFileSync(marker, 'utf8'), { code: 'ENOENT' })
  rmSync(directory, { recursive: true, force: true })
})

test('the workflow is manual, pinned, minimal, and free of mutation or SQL', () => {
  const workflow = YAML.parse(readFileSync(WORKFLOW, 'utf8'))
  assert.deepEqual(Object.keys(workflow.on ?? workflow['on'] ?? {}), ['workflow_dispatch'])
  const on = workflow.on ?? workflow['on']
  assert.equal(on.workflow_dispatch, null)
  assert.deepEqual(workflow.permissions, { contents: 'read', 'id-token': 'write' })
  assert.equal(workflow.jobs.inventory.environment, 'ue-staging-plan')
  assert.match(workflow.jobs.inventory.if, /anungis437\/nzila-os/)
  assert.match(workflow.jobs.inventory.if, /refs\/heads\/main/)
  assert.match(workflow.jobs.inventory.if, /workflow_dispatch/)
  const text = `${readFileSync(WORKFLOW, 'utf8')}\n${readFileSync(SCRIPT, 'utf8')}`
  for (const forbidden of ['az deployment', 'containerapp update', 'containerapp revision set-mode', 'ingress traffic', 'containerapp job', 'firewall-rule', 'psql', 'BEGIN READ ONLY', 'what-if']) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
  for (const required of [SUBSCRIPTION_ID, TENANT_ID, RESOURCE_GROUP, CONTAINER_APP, POSTGRES_SERVER, '--query']) {
    assert.equal(readFileSync(WORKFLOW, 'utf8').includes(required) || readFileSync(SCRIPT, 'utf8').includes(required), true, required)
  }
  assert.equal(workflow.jobs.inventory.steps.some((step) => step.uses === 'azure/login@v3'), true)
  assert.equal(JSON.stringify(workflow).includes('pull_request'), false)
})

function liveEnv() {
  return { UE_INVENTORY_LIVE: '1', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: DEFAULT_REF, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: 'b'.repeat(40), GITHUB_RUN_ID: '9', UE_INVENTORY_OBSERVED_AT: '2026-11-26T01:10:00Z' }
}
