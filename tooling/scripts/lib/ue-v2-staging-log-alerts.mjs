import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const subscription = 'd562ba7f-d891-4504-a489-10917c0ebaaf'
export const resourceGroup = 'nzila-canada-staging-rg'
const root = `/subscriptions/${subscription}/resourceGroups/`
export const workspace = `${root}${resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/nzila-ue-v2-staging-law`
export const previousWorkspace = `${root}nzila-canada-prod-rg/providers/Microsoft.OperationalInsights/workspaces/nzila-canada-prod-law`
export const names = ['unexpected-5xx', 'redis-unavailable', 'stripe-webhook-failure', 'resend-failure', 'database-errors', 'audit-persistence-failure', 'cron-job-failed'].map(name => `nzila-ue-v2-staging-${name}`)
export const ruleId = name => `${root}${resourceGroup}/providers/Microsoft.Insights/scheduledQueryRules/${name}`
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
export const hash = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const equalId = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
export const body = resource => ({ location: resource.location, tags: resource.tags, properties: resource.properties })

export function migrationPlan(whatIf, sourceSha) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/)
  assert.equal(whatIf.status, 'Succeeded'); assert(!whatIf.error)
  const replacements = []
  for (const change of whatIf.changes) {
    if (!/\/providers\/microsoft\.insights\/scheduledqueryrules\//i.test(change.resourceId)) continue
    const name = names.find(value => equalId(change.resourceId, ruleId(value)))
    assert(name, 'Unexpected log alert outside the seven owned staging rules')
    assert(['Modify', 'NoChange', 'Create'].includes(change.changeType), 'Unexpected log alert lifecycle operation')
    assert.deepEqual(change.after.properties.scopes, [workspace], 'Only the dedicated staging workspace is permitted')
    if (change.changeType !== 'Modify') continue
    const before = body(change.before), after = body(change.after)
    if (hash(before.properties.scopes) === hash(after.properties.scopes)) continue
    assert.deepEqual(before.properties.scopes, [previousWorkspace], 'Only the recorded legacy workspace may be replaced')
    const comparison = structuredClone(after); comparison.properties.scopes = before.properties.scopes
    assert.equal(hash(before), hash(comparison), 'Scope migration must not change query, actions, tags, thresholds or other settings')
    assert.equal(after.location, 'canadacentral')
    assert.equal(after.tags.env, 'staging'); assert.equal(after.tags.managedBy, 'bicep')
    assert.deepEqual(after.properties.actions.actionGroups, [`${root}${resourceGroup}/providers/Microsoft.Insights/actionGroups/nzila-ue-v2-staging-ops`])
    assert.equal(after.properties.enabled, true)
    replacements.push({ id: ruleId(name), name, before, after })
  }
  replacements.sort((a, b) => a.name.localeCompare(b.name))
  const plan = { sourceSha, replacements, operations: replacements.length, resourceClass: 'SEVEN_OWNED_STAGING_LOG_ALERTS_ONLY', databaseOrApplicationMutation: false, productionResourceMutation: false }
  return { ...plan, fingerprint: hash(plan) }
}

function verifyActual(actual, expected) {
  assert.equal(actual.location.toLowerCase().replace(/\s/g, ''), expected.location)
  assert.deepEqual(actual.tags, expected.tags, 'Alert tags changed since review')
  // ARM adds read-only health/creation fields. Every source-declared setting must still match.
  for (const [key, value] of Object.entries(expected.properties)) assert.equal(hash(actual.properties[key]), hash(value), `Alert setting changed since review: ${key}`)
}

export async function replaceReviewedAlerts(plan, api, persist) {
  const receipt = { sourceSha: plan.sourceSha, planFingerprint: plan.fingerprint, status: 'IN_PROGRESS', snapshots: [], completed: [], productionResourceMutation: false, databaseOrApplicationMutation: false }
  // Snapshot and validate the complete set before the first deletion. Never discover arbitrary rules.
  for (const rule of plan.replacements) {
    assert(names.includes(rule.name) && equalId(rule.id, ruleId(rule.name)))
    const actual = await api.get(rule.id)
    assert(equalId(actual.id, rule.id)); verifyActual(actual, rule.before)
    receipt.snapshots.push({ id: rule.id, actual, restorableBody: rule.before })
  }
  await persist(receipt)
  try {
    for (const rule of plan.replacements) {
      const actual = await api.get(rule.id); verifyActual(actual, rule.before)
      let removed = false
      try {
        await api.delete(rule.id); removed = true
        await api.put(rule.id, rule.after)
        verifyActual(await api.get(rule.id), rule.after)
      } catch (error) {
        if (removed) {
          try {
            if (await api.exists(rule.id)) await api.delete(rule.id)
            await api.put(rule.id, rule.before)
            verifyActual(await api.get(rule.id), rule.before)
            receipt.restoredAfterFailure = rule.id
          } catch {
            receipt.restorationFailed = rule.id
          }
        }
        throw error
      }
      receipt.completed.push({ id: rule.id, scope: workspace, settingsSha256: hash(rule.after), verified: true })
      await persist(receipt)
    }
    receipt.status = 'PASS'
  } catch (error) {
    receipt.status = 'FAIL'
    receipt.failure = error.message.split('\n')[0]
    throw error
  } finally { await persist(receipt) }
  return receipt
}
