/**
 * CFO — Demo Seed Data
 *
 * Creates demo org, users, workflow examples, and analytics data
 * for pilot demonstrations.
 *
 * GOVERNANCE: DEMO-ONLY MODULE.
 * This script is not a production data authority.
 */

export interface DemoOrg {
  id: string
  name: string
  fiscalYearEnd: string
}

export interface DemoUser {
  id: string
  email: string
  role: string
  orgId: string
}

export interface DemoBudget {
  id: string
  orgId: string
  category: string
  allocated: number
  spent: number
  period: string
}

export function createDemoOrg(): DemoOrg {
  return { id: 'demo-org-cfo', name: 'Nzila Demo Finance Corp', fiscalYearEnd: '2026-12-31' }
}

export function createDemoUsers(orgId: string): DemoUser[] {
  return [
    { id: 'demo-cfo', email: 'cfo@demo-finance.nzila.io', role: 'cfo', orgId },
    { id: 'demo-controller', email: 'controller@demo-finance.nzila.io', role: 'controller', orgId },
    { id: 'demo-accountant', email: 'accountant@demo-finance.nzila.io', role: 'accountant', orgId },
  ]
}

export function createDemoBudgets(orgId: string): DemoBudget[] {
  return [
    { id: 'budget-ops', orgId, category: 'Operations', allocated: 500000, spent: 320000, period: 'Q1-2026' },
    { id: 'budget-marketing', orgId, category: 'Marketing', allocated: 150000, spent: 95000, period: 'Q1-2026' },
    { id: 'budget-rd', orgId, category: 'R&D', allocated: 300000, spent: 280000, period: 'Q1-2026' },
    { id: 'budget-hr', orgId, category: 'HR', allocated: 200000, spent: 180000, period: 'Q1-2026' },
  ]
}

export function createDemoAnalytics() {
  return {
    totalRevenue: 2450000,
    totalExpenses: 1875000,
    netIncome: 575000,
    cashFlow: 420000,
    burnRate: 156250,
    runwayMonths: 18,
  }
}

export async function seedDemo() {
  const org = createDemoOrg()
  const users = createDemoUsers(org.id)
  const budgets = createDemoBudgets(org.id)
  const analytics = createDemoAnalytics()

  console.log(`[demo:seed] CFO demo data created`)
  console.log(`  Org: ${org.name}`)
  console.log(`  Users: ${users.length}`)
  console.log(`  Budgets: ${budgets.length}`)
  console.log(`  Analytics: ready`)

  return { org, users, budgets, analytics }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch(console.error)
}
