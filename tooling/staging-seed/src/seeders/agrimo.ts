/**
 * Agrimo per-app staging seeder (agricultural field operations).
 *
 * Generates synthetic ag-co-op data: producers, fields, lots, batches,
 * warehouses, shipments, payments, certifications, traceability events.
 *
 * PLAN-ONLY in phase 2 — Django ORM writes land in phase 3.
 */
import { registerSeeder } from '../core/registry'
import * as shared from '../shared'
import type {
  SeedAppReport,
  SeedContext,
  SeedProfile,
  SeederModule,
} from '../core/types'

const SUPPORTED_PROFILES: readonly SeedProfile[] = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
]

const STAGING_ORG = {
  id: 'org-agrimo-staging-coop-9999',
  name: 'Agrimo Staging Cooperative 9999',
  slug: 'agrimo-staging-coop-9999',
}

interface AgrimoScale {
  readonly producers: number
  readonly fields: number
  readonly lots: number
  readonly batches: number
  readonly warehouses: number
  readonly shipments: number
  readonly payments: number
  readonly certifications: number
  readonly traceabilityEvents: number
  readonly notifications: number
  readonly activityLogs: number
}

function agrimoScale(profile: SeedProfile): AgrimoScale {
  switch (profile) {
    case 'demo-light':
      return { producers: 20, fields: 40, lots: 60, batches: 30, warehouses: 3, shipments: 25, payments: 40, certifications: 10, traceabilityEvents: 200, notifications: 50, activityLogs: 200 }
    case 'demo-standard':
      return { producers: 100, fields: 200, lots: 300, batches: 150, warehouses: 6, shipments: 120, payments: 200, certifications: 40, traceabilityEvents: 1200, notifications: 250, activityLogs: 1000 }
    case 'executive-showcase':
      return { producers: 500, fields: 1200, lots: 1800, batches: 900, warehouses: 18, shipments: 700, payments: 1200, certifications: 200, traceabilityEvents: 7000, notifications: 1500, activityLogs: 6000 }
    case 'investor-showcase':
      return { producers: 1500, fields: 3500, lots: 5000, batches: 2500, warehouses: 45, shipments: 2000, payments: 3500, certifications: 600, traceabilityEvents: 20_000, notifications: 4500, activityLogs: 18_000 }
  }
}

const CROP_TYPES = ['coffee', 'cocoa', 'maize', 'cassava', 'rice', 'sorghum', 'cashew', 'sesame'] as const
const SHIPMENT_STATUSES = ['scheduled', 'in_transit', 'delivered', 'delayed', 'cancelled'] as const
const PAYMENT_STATUSES = ['scheduled', 'pending', 'paid', 'failed', 'reversed'] as const
const CERT_TYPES = ['organic', 'fair-trade', 'rainforest', 'utz', 'iso-22000', 'haccp'] as const
const CERT_STATUSES = ['active', 'pending_audit', 'expired', 'revoked'] as const
const TRACE_EVENTS = ['harvest', 'sort', 'dry', 'pack', 'transport', 'inspect', 'export'] as const

interface SyntheticProducer {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly householdSize: number
  readonly hectares: number
}

interface SyntheticField {
  readonly id: string
  readonly producerId: string
  readonly crop: (typeof CROP_TYPES)[number]
  readonly hectares: number
  readonly registeredAt: string
}

interface SyntheticLot {
  readonly id: string
  readonly fieldId: string
  readonly crop: (typeof CROP_TYPES)[number]
  readonly weightKg: number
  readonly harvestedAt: string
}

interface SyntheticBatch {
  readonly id: string
  readonly orgId: string
  readonly lotIds: readonly string[]
  readonly weightKg: number
  readonly createdAt: string
}

interface SyntheticWarehouse {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly capacityKg: number
  readonly utilizationPct: number
}

interface SyntheticShipment {
  readonly id: string
  readonly batchId: string
  readonly fromWarehouseId: string
  readonly destination: string
  readonly status: (typeof SHIPMENT_STATUSES)[number]
  readonly departedAt: string
}

interface SyntheticPayment {
  readonly id: string
  readonly producerId: string
  readonly amountCents: number
  readonly status: (typeof PAYMENT_STATUSES)[number]
  readonly scheduledAt: string
}

interface SyntheticCertification {
  readonly id: string
  readonly orgId: string
  readonly type: (typeof CERT_TYPES)[number]
  readonly status: (typeof CERT_STATUSES)[number]
  readonly issuedAt: string
  readonly expiresAt: string
}

interface SyntheticTraceabilityEvent {
  readonly id: string
  readonly batchId: string
  readonly event: (typeof TRACE_EVENTS)[number]
  readonly at: string
  readonly location: string
}

function buildPlan(ctx: SeedContext) {
  const scale = agrimoScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'agriculture', tier: 'enterprise' as const }]

  const producerPeople = shared.fakePeople(ctx.rng, ctx.time, scale.producers)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: producerPeople, organizations: orgs, count: scale.producers })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()

  const producers: SyntheticProducer[] = producerPeople.map((p) => ({
    id: ctx.rng.id('producer'),
    orgId: STAGING_ORG.id,
    name: p.fullName,
    householdSize: ctx.rng.intBetween(2, 12),
    hectares: ctx.rng.intBetween(1, 25),
  }))

  const fields: SyntheticField[] = Array.from({ length: scale.fields }, () => ({
    id: ctx.rng.id('field'),
    producerId: ctx.rng.pick(producers).id,
    crop: ctx.rng.pick(CROP_TYPES),
    hectares: ctx.rng.intBetween(1, 10),
    registeredAt: ctx.time.daysAgo(ctx.rng.intBetween(30, 720)).toISOString(),
  }))

  const lots: SyntheticLot[] = Array.from({ length: scale.lots }, () => {
    const field = ctx.rng.pick(fields)
    return {
      id: ctx.rng.id('lot'),
      fieldId: field.id,
      crop: field.crop,
      weightKg: ctx.rng.intBetween(50, 5000),
      harvestedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    }
  })

  const warehouses: SyntheticWarehouse[] = Array.from({ length: scale.warehouses }, (_, i) => ({
    id: ctx.rng.id('warehouse'),
    orgId: STAGING_ORG.id,
    name: `Synthetic Warehouse ${i + 1}`,
    capacityKg: ctx.rng.intBetween(50_000, 500_000),
    utilizationPct: ctx.rng.intBetween(20, 95),
  }))

  const batches: SyntheticBatch[] = Array.from({ length: scale.batches }, () => {
    const sample = Array.from({ length: ctx.rng.intBetween(2, 8) }, () => ctx.rng.pick(lots).id)
    const weight = sample.reduce((sum) => sum + ctx.rng.intBetween(50, 1000), 0)
    return {
      id: ctx.rng.id('batch'),
      orgId: STAGING_ORG.id,
      lotIds: sample,
      weightKg: weight,
      createdAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    }
  })

  const shipments: SyntheticShipment[] = Array.from({ length: scale.shipments }, () => ({
    id: ctx.rng.id('shipment'),
    batchId: ctx.rng.pick(batches).id,
    fromWarehouseId: ctx.rng.pick(warehouses).id,
    destination: ctx.rng.pick(['Port of Lagos', 'Port of Mombasa', 'Port of Dakar', 'Port of Abidjan', 'Port of Durban']),
    status: ctx.rng.pick(SHIPMENT_STATUSES),
    departedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
  }))

  const payments: SyntheticPayment[] = Array.from({ length: scale.payments }, () => ({
    id: ctx.rng.id('payment'),
    producerId: ctx.rng.pick(producers).id,
    amountCents: ctx.rng.intBetween(10_00, 500_000),
    status: ctx.rng.pick(PAYMENT_STATUSES),
    scheduledAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
  }))

  const certifications: SyntheticCertification[] = Array.from({ length: scale.certifications }, () => {
    const issued = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('certification'),
      orgId: STAGING_ORG.id,
      type: ctx.rng.pick(CERT_TYPES),
      status: ctx.rng.pick(CERT_STATUSES),
      issuedAt: issued.toISOString(),
      expiresAt: new Date(issued.getTime() + 365 * 86_400_000).toISOString(),
    }
  })

  const traceabilityEvents: SyntheticTraceabilityEvent[] = Array.from({ length: scale.traceabilityEvents }, () => ({
    id: ctx.rng.id('trace'),
    batchId: ctx.rng.pick(batches).id,
    event: ctx.rng.pick(TRACE_EVENTS),
    at: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    location: ctx.rng.pick(['Field A', 'Field B', 'Sorting Hub', 'Drying Yard', 'Warehouse', 'Inspection Pt', 'Loading Dock']),
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, producers, fields, lots, batches, warehouses, shipments, payments, certifications, traceabilityEvents, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'agrimo',
  description: 'Agrimo synthetic cooperative: producers, fields, lots, batches, warehouses, shipments, payments, certifications, traceability.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'producers', entity: 'producers', count: plan.producers.length })
    ctx.report.step({ step: 'fields', entity: 'fields', count: plan.fields.length })
    ctx.report.step({ step: 'lots', entity: 'lots', count: plan.lots.length })
    ctx.report.step({ step: 'batches', entity: 'batches', count: plan.batches.length })
    ctx.report.step({ step: 'warehouses', entity: 'warehouses', count: plan.warehouses.length })
    ctx.report.step({ step: 'shipments', entity: 'shipments', count: plan.shipments.length })
    ctx.report.step({ step: 'payments', entity: 'payments', count: plan.payments.length })
    ctx.report.step({ step: 'certifications', entity: 'certifications', count: plan.certifications.length })
    ctx.report.step({ step: 'traceability_events', entity: 'traceability', count: plan.traceabilityEvents.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('agrimo seed plan computed', {
      profile: ctx.profile, producers: plan.producers.length, lots: plan.lots.length, shipments: plan.shipments.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched` })
    ctx.logger.info('agrimo reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, agrimoScale, buildPlan }
