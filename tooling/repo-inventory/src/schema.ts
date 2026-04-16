import type { RepoInventory } from './generate'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function validateInventorySchema(value: unknown): RepoInventory {
  const inv = value as Partial<RepoInventory>

  assert(inv && typeof inv === 'object', 'Inventory must be an object')
  assert(typeof inv.generatedAt === 'string' && inv.generatedAt.length > 0, 'Missing generatedAt')
  assert(typeof inv.appCount === 'number', 'Missing appCount')
  assert(typeof inv.packageCount === 'number', 'Missing packageCount')
  assert(typeof inv.workflowCount === 'number', 'Missing workflowCount')
  assert(typeof inv.contractTestCount === 'number', 'Missing contractTestCount')
  assert(typeof inv.tsTestFileCount === 'number', 'Missing tsTestFileCount')
  assert(typeof inv.pythonTestFileCount === 'number', 'Missing pythonTestFileCount')
  assert(Array.isArray(inv.apps), 'Missing apps array')
  assert(Array.isArray(inv.workflows), 'Missing workflows array')

  for (const app of inv.apps ?? []) {
    assert(typeof app?.name === 'string' && app.name.length > 0, 'Each app must include name')
    assert(typeof app?.framework === 'string' && app.framework.length > 0, `App ${app?.name ?? '<unknown>'} missing framework`)
    assert(typeof app?.hasReadme === 'boolean', `App ${app?.name ?? '<unknown>'} missing hasReadme`)
    assert(typeof app?.hasEnvExample === 'boolean', `App ${app?.name ?? '<unknown>'} missing hasEnvExample`)
    assert(typeof app?.dependsOnPlatformAuth === 'boolean', `App ${app?.name ?? '<unknown>'} missing dependsOnPlatformAuth`)
  }

  return inv as RepoInventory
}
