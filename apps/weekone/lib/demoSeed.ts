/**
 * WeekOne — Demo Seed Data
 *
 * Creates demo organization, users, cash snapshots, deals, priorities,
 * and weekly briefs for founder baseline demonstrations.
 */

export interface DemoWeeköneOrg {
  id: number
  name: string
  type: 'saas' | 'agency' | 'studio' | 'ecommerce' | 'services' | 'other'
  revenueStage: string
  teamSize: number
  mainPain: string
  ownerId: number
}

export interface DemoWeeköneUser {
  id: number
  authId: string
  email: string
  name: string
}

export interface DemoWeeköneSubscription {
  id: number
  orgId: number
  plan: 'solo' | 'team' | 'growth'
  status: string
}

export interface DemoWeekoneCashSnapshot {
  orgId: number
  cashOnHand: number
  monthlyBurn: number
  runwayDays: number
  overdueInvoices: number
  upcomingBills: number
  recordedAt: Date
}

export interface DemoWeeköneInvoice {
  orgId: number
  clientName: string
  amount: number
  currency: string
  dueDate: Date
  status: 'draft' | 'sent' | 'overdue' | 'paid'
}

export interface DemoWeeköneDeal {
  orgId: number
  name: string
  value: number
  stage: string
  probability: number
  expectedCloseDate: Date
}

export interface DemoWeeköneWeeklyBrief {
  orgId: number
  weekStartDate: Date
  summary: string
  priorities: Array<{ rank: number; title: string }>
  moneyWatch: string
  pipelineWatch: string
  riskWatch: string
  founderRecommendation: string
}

export interface DemoWeekonePriority {
  orgId: number
  weekStartDate: Date
  rank: number
  category: 'revenue' | 'risk' | 'delegation' | 'stop'
  title: string
  description: string
}

/**
 * Create a demo founder scenario: Cora Labs (early-stage SaaS)
 * - 6-person team, $15K MRR, 8-month runway
 * - 3 active deals in pipeline ($50K+ total)
 * - Weekly brief showing founder priorities (cash, growth, risk)
 */

export function createDemoWeeköneUser(orgId: number): DemoWeeköneUser {
  return {
    id: 1,
    authId: 'demo-founder-weekone',
    email: 'founder@coralabs-demo.weekone',
    name: 'Alex Chen (Demo Founder)',
  }
}

export function createDemoWeeköneOrg(ownerId: number): DemoWeeköneOrg {
  return {
    id: 1,
    name: 'Cora Labs (Demo)',
    type: 'saas',
    revenueStage: '$10-25K MRR',
    teamSize: 6,
    mainPain: 'Scaling sales without burning cash',
    ownerId,
  }
}

export function createDemoWeeköneSubscription(orgId: number): DemoWeeköneSubscription {
  return {
    id: 1,
    orgId,
    plan: 'growth',
    status: 'active',
  }
}

export function createDemoCashSnapshots(orgId: number): DemoWeekoneCashSnapshot[] {
  const today = new Date()
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(today.getDate() - 14)

  return [
    // Current week snapshot
    {
      orgId,
      cashOnHand: 145000,
      monthlyBurn: 18000,
      runwayDays: 240,
      overdueInvoices: 0,
      upcomingBills: 12000,
      recordedAt: today,
    },
    // Two weeks ago
    {
      orgId,
      cashOnHand: 162000,
      monthlyBurn: 19000,
      runwayDays: 255,
      overdueInvoices: 0,
      upcomingBills: 15000,
      recordedAt: twoWeeksAgo,
    },
  ]
}

export function createDemoInvoices(orgId: number): DemoWeeköneInvoice[] {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const nextMonth = new Date(today)
  nextMonth.setMonth(today.getMonth() + 1)

  return [
    {
      orgId,
      clientName: 'Enterprise Client A',
      amount: 8000,
      currency: 'USD',
      dueDate: nextMonth,
      status: 'sent',
    },
    {
      orgId,
      clientName: 'Mid-Market B',
      amount: 4500,
      currency: 'USD',
      dueDate: nextWeek,
      status: 'sent',
    },
    {
      orgId,
      clientName: 'Startup C',
      amount: 2200,
      currency: 'USD',
      dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'paid',
    },
  ]
}

export function createDemoDeals(orgId: number): DemoWeeköneDeal[] {
  const today = new Date()
  const nextMonth = new Date(today)
  nextMonth.setMonth(today.getMonth() + 1)
  const twoMonths = new Date(today)
  twoMonths.setMonth(today.getMonth() + 2)

  return [
    {
      orgId,
      name: 'Tier-1 Customer (Series A)',
      value: 35000,
      stage: 'negotiating',
      probability: 70,
      expectedCloseDate: nextMonth,
    },
    {
      orgId,
      name: 'Regional Partnership',
      value: 24000,
      stage: 'proposal',
      probability: 50,
      expectedCloseDate: twoMonths,
    },
    {
      orgId,
      name: 'SME Segment Expansion',
      value: 15000,
      stage: 'discovery',
      probability: 35,
      expectedCloseDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000),
    },
  ]
}

export function createDemoPriorities(orgId: number): DemoWeekonePriority[] {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())

  return [
    {
      orgId,
      weekStartDate: weekStart,
      rank: 1,
      category: 'revenue',
      title: 'Close Tier-1 Customer negotiation',
      description:
        'Align on pricing, deployment timeline, and SLA terms. Decision needed by Friday to hit month-end target.',
    },
    {
      orgId,
      weekStartDate: weekStart,
      rank: 2,
      category: 'revenue',
      title: 'Launch SME sales campaign',
      description: 'Prep collateral and kick off outreach to 50 mid-market targets identified last week.',
    },
    {
      orgId,
      weekStartDate: weekStart,
      rank: 3,
      category: 'risk',
      title: 'Resolve product stability issue in staging',
      description:
        ' API timeouts under load (>100 concurrent users). Risk: Tier-1 customer demo on Wednesday.',
    },
    {
      orgId,
      weekStartDate: weekStart,
      rank: 4,
      category: 'delegation',
      title: 'Onboard new sales hire',
      description:
        'Set up systems access, run sales playbook training, assign warm pipeline leads to validate ramp.',
    },
    {
      orgId,
      weekStartDate: weekStart,
      rank: 5,
      category: 'stop',
      title: 'Pause custom feature requests',
      description:
        'Backlog is 8 weeks deep. Cap scope to roadmap until revenue velocity stabilizes post-close.',
    },
  ]
}

export function createDemoWeeklyBrief(orgId: number): DemoWeeköneWeeklyBrief {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())

  return {
    orgId,
    weekStartDate: weekStart,
    summary:
      'Tier-1 deal is close — align on final terms this week. New sales hire ramping fast. API stability risk must resolve before customer demo.',
    priorities: [
      { rank: 1, title: 'Close Tier-1 Customer negotiation' },
      { rank: 2, title: 'Launch SME sales campaign' },
      { rank: 3, title: 'Resolve product stability issue' },
    ],
    moneyWatch:
      'Cash: $145K. Burn: $18K/mo. Runway: 8 months. Next invoice due Friday ($4.5K). No red flags if Tier-1 closes this month.',
    pipelineWatch:
      'Pipeline: $74K (3 deals). Probability-weighted: ~$35K. Close probability on Tier-1 deal trending up (65% → 70%). SME campaign could add $200K+ if executed.',
    riskWatch:
      'API timeout issue under load is blocking Tier-1 demo. Engineering committed to fix by Wednesday. Backup: Demo environment with reduced load profile.',
    founderRecommendation:
      'Lock Tier-1 terms by Friday, then reset for H2 planning. Stabilize product, hire fast for sales, and put SME expansion on critical path for Q3.',
  }
}

export async function seedWeekOneDemo() {
  const user = createDemoWeeköneUser(1)
  const org = createDemoWeeköneOrg(user.id)
  const subscription = createDemoWeeköneSubscription(org.id)
  const cashSnapshots = createDemoCashSnapshots(org.id)
  const invoices = createDemoInvoices(org.id)
  const deals = createDemoDeals(org.id)
  const priorities = createDemoPriorities(org.id)
  const brief = createDemoWeeklyBrief(org.id)

  console.log(`[demo:seed] WeekOne demo data created`)
  console.log(`  Org: ${org.name}`)
  console.log(`  User: ${user.name}`)
  console.log(`  Subscription: ${subscription.plan}`)
  console.log(`  Cash Snapshots: ${cashSnapshots.length}`)
  console.log(`  Invoices: ${invoices.length}`)
  console.log(`  Deals: ${deals.length}`)
  console.log(`  Priorities: ${priorities.length}`)
  console.log(`  Weekly Brief: ready`)

  return {
    user,
    org,
    subscription,
    cashSnapshots,
    invoices,
    deals,
    priorities,
    brief,
  }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedWeekOneDemo().catch(console.error)
}
