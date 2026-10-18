/**
 * Partners — Demo Seed Data
 *
 * Creates demo org, users, workflow examples, and analytics data
 * for pilot demonstrations.
 */

import { createLogger, writeDiagnostic } from '@nzila/os-core/telemetry'

const logger = createLogger('partners:demo-seed')
const report = (message: string) => writeDiagnostic(logger, 'info', message)
const reportFailure = () => writeDiagnostic(logger, 'error', 'Demo seed failed')

export interface DemoOrg {
  id: string
  name: string
  partnerProgram: string
}

export interface DemoUser {
  id: string
  email: string
  role: string
  orgId: string
}

export interface DemoPartner {
  id: string
  companyName: string
  tier: string
  status: string
  monthlyRevenue: number
  commissionRate: number
}

export function createDemoOrg(): DemoOrg {
  return { id: 'demo-org-partners', name: 'Nzila Demo Partner Network', partnerProgram: 'Enterprise' }
}

export function createDemoUsers(orgId: string): DemoUser[] {
  return [
    { id: 'demo-pm', email: 'pm@demo-partners.nzila.io', role: 'partner_manager', orgId },
    { id: 'demo-admin', email: 'admin@demo-partners.nzila.io', role: 'admin', orgId },
    { id: 'demo-analyst', email: 'analyst@demo-partners.nzila.io', role: 'analyst', orgId },
  ]
}

export function createDemoPartners(): DemoPartner[] {
  return [
    { id: 'partner-001', companyName: 'TechFlow Solutions', tier: 'GOLD', status: 'ACTIVE', monthlyRevenue: 45000, commissionRate: 0.15 },
    { id: 'partner-002', companyName: 'DataBridge Inc', tier: 'PLATINUM', status: 'ACTIVE', monthlyRevenue: 120000, commissionRate: 0.12 },
    { id: 'partner-003', companyName: 'CloudNova', tier: 'SILVER', status: 'ACTIVE', monthlyRevenue: 18000, commissionRate: 0.18 },
    { id: 'partner-004', companyName: 'SmartEdge Labs', tier: 'BRONZE', status: 'PENDING', monthlyRevenue: 0, commissionRate: 0.2 },
  ]
}

export function createDemoAnalytics() {
  return {
    totalPartners: 42,
    activePartners: 38,
    totalRevenue: 890000,
    avgCommission: 0.15,
    topPartnerRevenue: 120000,
  }
}

export async function seedDemo() {
  const org = createDemoOrg()
  const users = createDemoUsers(org.id)
  const partners = createDemoPartners()
  const analytics = createDemoAnalytics()

  report(`[demo:seed] Partners demo data created`)
  report(`  Org: ${org.name}`)
  report(`  Users: ${users.length}`)
  report(`  Partners: ${partners.length}`)
  report(`  Analytics: ready`)

  return { org, users, partners, analytics }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch(reportFailure)
}
