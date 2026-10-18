/**
 * Console — Demo Seed Data
 *
 * Seeds representative operations data for governance, assurance,
 * and platform observability demonstrations.
 */

import { createLogger, writeDiagnostic } from '@nzila/os-core/telemetry'

const logger = createLogger('console:demo-seed')
const report = (message: string) => writeDiagnostic(logger, 'info', message)
const reportFailure = () => writeDiagnostic(logger, 'error', 'Demo seed failed')

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

  report('[demo:seed] Console demo data created')
  report(`  Tenant: ${tenant.name}`)
  report(`  Signals: ${signals.length}`)

  return { tenant, signals }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch(reportFailure)
}
