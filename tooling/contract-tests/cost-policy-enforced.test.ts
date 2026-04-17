/**
 * Contract Test — Cost Policy Enforced
 *
 * Structural invariant: The Console middleware must enforce cost budget
 * denial-of-wallet controls and the platform-cost package must expose
 * the required budget-checking primitives.
 *
 * @invariant COST_POLICY_ENFORCED_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('COST_POLICY_ENFORCED_001 — Cost budget denial-of-wallet', () => {
  it('cost-policy.yml exists with budget defaults', () => {
    const policyPath = join(ROOT, 'ops', 'cost-policy.yml')
    expect(existsSync(policyPath), 'ops/cost-policy.yml must exist').toBe(true)

    const content = readFileSync(policyPath, 'utf-8')
    expect(content).toContain('dailyBudgetUsd')
    expect(content).toContain('monthlyBudgetUsd')
    expect(content).toContain('warningThreshold')
  })

  it('platform-cost package exports budget checking primitives', () => {
    const budgetPath = join(ROOT, 'packages', 'platform-cost', 'src', 'budget.ts')
    expect(existsSync(budgetPath), 'packages/platform-cost/src/budget.ts must exist').toBe(true)

    const content = readFileSync(budgetPath, 'utf-8')
    expect(content).toContain('export async function checkOrgBudget')
    expect(content).toContain('export function shouldBlockRequest')
    expect(content).toContain('OrgBudgetPolicySchema')
  })

  it('platform-cost package exports cost event recording', () => {
    const eventsPath = join(ROOT, 'packages', 'platform-cost', 'src', 'cost-events.ts')
    expect(existsSync(eventsPath), 'packages/platform-cost/src/cost-events.ts must exist').toBe(true)

    const content = readFileSync(eventsPath, 'utf-8')
    expect(content).toContain('export async function recordCostEvent')
    expect(content).toContain('CostStorePorts')
  })

  it('Console proxy enforces budget (402 on exceeded)', () => {
    const mwPath = join(ROOT, 'apps', 'console', 'proxy.ts')
    expect(existsSync(mwPath), 'apps/console/proxy.ts must exist').toBe(true)

    const content = readFileSync(mwPath, 'utf-8')
    expect(content).toContain('COST_BUDGET_EXCEEDED')
    expect(content).toContain('402')
    expect(content).toContain('x-budget-state')
  })

  it('cost-policy declares exempt routes for admin/export/proof', () => {
    const mwPath = join(ROOT, 'apps', 'console', 'proxy.ts')
    const content = readFileSync(mwPath, 'utf-8')

    expect(content).toContain('/api/admin/')
    expect(content).toContain('/api/export/')
    expect(content).toContain('/api/proof/')
    expect(content).toContain('/api/health')
  })

  it('DB schema includes cost event tables', () => {
    const schemaPath = join(ROOT, 'packages', 'db', 'src', 'schema', 'platform.ts')
    expect(existsSync(schemaPath), 'packages/db/src/schema/platform.ts must exist').toBe(true)

    const content = readFileSync(schemaPath, 'utf-8')
    expect(content).toContain('platformCostEvents')
    expect(content).toContain('platformCostRollups')
    expect(content).toContain('platformCostBudgetBreaches')
  })
})
