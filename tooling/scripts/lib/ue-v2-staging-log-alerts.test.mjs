import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { migrationPlan, replaceReviewedAlerts, previousWorkspace, workspace, names, ruleId } from './ue-v2-staging-log-alerts.mjs'

const source = '9a7ee373e1205209f864e63f37877c8919bb6738'
function fixture() {
  const before = { location: 'canadacentral', tags: { env: 'staging', managedBy: 'bicep' }, properties: { scopes: [previousWorkspace], enabled: true, criteria: { allOf: [{ query: 'Synthetic static source declaration', threshold: 0 }] }, actions: { actionGroups: [workspace.replace('Microsoft.OperationalInsights/workspaces/nzila-ue-v2-staging-law', 'Microsoft.Insights/actionGroups/nzila-ue-v2-staging-ops')] } } }
  return { status: 'Succeeded', error: null, changes: names.map(name => ({ resourceId: ruleId(name), changeType: 'Modify', before: structuredClone(before), after: { ...structuredClone(before), properties: { ...structuredClone(before.properties), scopes: [workspace] } } })) }
}
function provider(plan, failPut = false) {
  const resources = new Map(plan.replacements.map(rule => [rule.id, { id: rule.id, ...structuredClone(rule.before), properties: { ...structuredClone(rule.before.properties), createdWithApiVersion: '2023-12-01' } }]))
  const mutations = []
  let failed = false
  return {
    resources, mutations,
    api: {
      get: async id => structuredClone(resources.get(id)),
      exists: async id => resources.has(id),
      delete: async id => { mutations.push(['delete', id]); assert(resources.delete(id)) },
      put: async (id, body) => {
        if (resources.has(id)) assert.deepEqual(resources.get(id).properties.scopes, body.properties.scopes, 'Scope can not be updated')
        mutations.push(['put', id, body.properties.scopes])
        if (failPut && !failed && body.properties.scopes[0] === workspace) { failed = true; throw Error('Actual provider creation failed') }
        resources.set(id, { id, ...structuredClone(body) })
      },
    },
  }
}
test('a pure plan binds exactly the seven source-declared old/new workspace scopes', () => {
  const plan = migrationPlan(fixture(), source)
  assert.equal(plan.operations, 7); assert.equal(plan.productionResourceMutation, false)
  assert.equal(migrationPlan(fixture(), source).fingerprint, plan.fingerprint)
})
test('unchanged or newly created rules do not require replacement', () => {
  for (const type of ['NoChange', 'Create']) {
    const whatIf = fixture(); for (const c of whatIf.changes) c.changeType = type
    assert.equal(migrationPlan(whatIf, source).operations, 0)
  }
  const whatIf = fixture(); for (const c of whatIf.changes) c.before = structuredClone(c.after)
  assert.equal(migrationPlan(whatIf, source).operations, 0)
})
test('wrong group, unowned rule, unexpected origin/target, changed query/actions or failed preview refuse before mutation', () => {
  const corruptions = [
    x => { x.status = 'Failed' },
    x => { x.changes[0].resourceId = ruleId(names[0]).replace('staging-rg', 'prod-rg') },
    x => { x.changes[0].resourceId = ruleId('unrelated-alert') },
    x => { x.changes[0].before.properties.scopes = ['/other'] },
    x => { x.changes[0].after.properties.scopes = [previousWorkspace] },
    x => { x.changes[0].after.properties.criteria.allOf[0].query = 'Changed query' },
    x => { x.changes[0].after.properties.actions.actionGroups = ['/other'] },
  ]
  for (const corrupt of corruptions) { const x = fixture(); corrupt(x); assert.throws(() => migrationPlan(x, source)) }
})
test('immutable provider reproduction succeeds only by snapshot/delete/recreate of exact reviewed rules', async () => {
  const plan = migrationPlan(fixture(), source), p = provider(plan), records = []
  await assert.rejects(p.api.put(plan.replacements[0].id, plan.replacements[0].after), /Scope can not be updated/)
  const result = await replaceReviewedAlerts(plan, p.api, x => { records.push(structuredClone(x)) })
  assert.equal(result.status, 'PASS'); assert.equal(result.completed.length, 7)
  assert.equal(records[0].snapshots.length, 7); assert.equal(records[0].completed.length, 0)
  assert.equal(p.mutations.length, 14)
  for (const row of result.completed) assert.deepEqual(p.resources.get(row.id).properties.scopes, [workspace])
})
test('an unreviewed setting on the last alert prevents every deletion', async () => {
  const plan = migrationPlan(fixture(), source), p = provider(plan)
  p.resources.get(plan.replacements[6].id).properties.enabled = false
  await assert.rejects(replaceReviewedAlerts(plan, p.api, () => {}), /setting changed since review/)
  assert.equal(p.mutations.length, 0)
})
test('failed recreation restores and verifies the saved original rule and retains a FAIL receipt', async () => {
  const plan = migrationPlan(fixture(), source), p = provider(plan, true), records = []
  await assert.rejects(replaceReviewedAlerts(plan, p.api, x => { records.push(structuredClone(x)) }), /provider creation failed/)
  const receipt = records.at(-1)
  assert.equal(receipt.status, 'FAIL'); assert.equal(receipt.restoredAfterFailure, plan.replacements[0].id)
  assert.deepEqual(p.resources.get(plan.replacements[0].id).properties.scopes, [previousWorkspace])
  assert.equal(p.resources.size, 7)
})
test('protected workflow publishes the replacement plan before approval and applies only after fresh drift verification', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/ue-v2-staging-deploy.yml', import.meta.url), 'utf8')
  assert(workflow.indexOf('Plan immutable staging log-alert') < workflow.indexOf('      - name: Upload what-if'))
  const apply = workflow.split('\n  apply:\n')[1]
  assert(apply.indexOf('Fresh what-if and drift gate') < apply.indexOf('Replace only reviewed immutable'))
  assert(apply.indexOf('Replace only reviewed immutable') < apply.indexOf('      - name: az deployment group create'))
  assert.match(apply, /--reviewed-plan "\$WHATIF_ARTIFACTS\/log-alert-scope-plan.json"/)
})
