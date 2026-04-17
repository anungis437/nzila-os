/**
 * Console — Demo Seed Data
 *
 * Seeds representative operations data for governance, assurance,
 * and platform observability demonstrations.
 */

export interface ConsoleDemoTenant {
  id: string
  name: string
  region: string
}

export interface ConsoleDemoSignal {
  id: string
  category: 'governance' | 'assurance' | 'ops'
  status: 'ok' | 'warning' | 'critical'
  title: string
}

export function createDemoTenant(): ConsoleDemoTenant {
  return {
    id: 'demo-console-tenant',
    name: 'Nzila Console Demo Tenant',
    region: 'canadacentral',
  }
}

export function createDemoSignals(): ConsoleDemoSignal[] {
  return [
    { id: 'sig-001', category: 'governance', status: 'ok', title: 'Policy checks passing' },
    { id: 'sig-002', category: 'assurance', status: 'warning', title: 'Evidence backlog elevated' },
    { id: 'sig-003', category: 'ops', status: 'ok', title: 'Platform uptime within SLO' },
  ]
}

export async function seedDemo() {
  const tenant = createDemoTenant()
  const signals = createDemoSignals()

  console.log('[demo:seed] Console demo data created')
  console.log(`  Tenant: ${tenant.name}`)
  console.log(`  Signals: ${signals.length}`)

  return { tenant, signals }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch(console.error)
}
