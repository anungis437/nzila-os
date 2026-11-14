import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { evaluateStagingConnectionBudget, retirementTargets } from './ue-v2-connection-budget.mjs'

const policy = JSON.parse(readFileSync(new URL('../../../infrastructure/bicep/ue-v2/staging-connection-budget.json', import.meta.url)))
const baseline = { policy, maxConnections: 50, reservedConnections: 5, superuserReservedConnections: 10, maximumReplicas: 2 }
test('both rollout revisions and maximum replicas fit the observed server with operator headroom', () => {
  assert.deepEqual(evaluateStagingConnectionBudget(baseline), { ok: true, defects: [], maxConnections: 50, reservedConnections: 5, superuserReservedConnections: 10, ordinarySlots: 35, connectionsPerProcess: 7, maximumRolloutReplicas: 4, maximumApplicationConnections: 28, ordinaryConnectionHeadroom: 7 })
})
test('the actual previous independent pool defaults fail the connection budget', () => {
  const previous = { ...policy, poolCaps: { DB_POOL_MAX: 10, DATABASE_POOL_SIZE: 20, SYSTEM_DB_POOL_MAX: 5, AUTH_DB_POOL_MAX: 5, AUTH_SYSTEM_DB_POOL_MAX: 5 } }
  assert.equal(evaluateStagingConnectionBudget({ ...baseline, policy: previous }).ok, false)
})
test('reserved-slot growth, replica growth and missing or invalid caps fail closed', () => {
  for (const change of [{ reservedConnections: 6 }, { maximumReplicas: 3 }, { maxConnections: 49 }]) assert.equal(evaluateStagingConnectionBudget({ ...baseline, ...change }).ok, false)
  for (const value of [0, -1, 1.5, '1', undefined]) assert.equal(evaluateStagingConnectionBudget({ ...baseline, policy: { ...policy, poolCaps: { ...policy.poolCaps, AUTH_DB_POOL_MAX: value } } }).ok, false)
})
test('Bicep installs the budgeted caps for every distinct staging pool family', () => {
  const bicep = readFileSync(new URL('../../../infrastructure/bicep/ue-v2/modules/apps.bicep', import.meta.url), 'utf8')
  for (const name of Object.keys(policy.poolCaps)) assert(bicep.includes("{ name: '" + name + "', value: string(runtimePoolLimits." + name + ") }"))
  assert(bicep.includes("loadJsonContent('../staging-connection-budget.json')"))
})
const current = 'nzila-ue-v2-staging-app--current'
const old = 'nzila-ue-v2-staging-app--old'
const retirement = { mode: 'Multiple', traffic: [{ revisionName: current, weight: 100 }], expectedServingRevision: current, revisions: [{ name: current, active: true, trafficWeight: 100 }, { name: old, active: true, trafficWeight: 0 }, { name: 'retained-inactive', active: false, trafficWeight: 0 }] }
test('retirement selects only active zero-traffic history and retains inactive metadata', () => assert.deepEqual(retirementTargets(retirement), [old]))
test('retirement refuses changed, split, latest-based or inactive serving traffic', () => {
  for (const change of [{ expectedServingRevision: old }, { traffic: [{ latestRevision: true, weight: 100 }] }, { traffic: [{ revisionName: current, weight: 90 }, { revisionName: old, weight: 10 }] }, { revisions: [{ name: current, active: false, trafficWeight: 100 }] }]) assert.throws(() => retirementTargets({ ...retirement, ...change }))
})
