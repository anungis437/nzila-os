/**
 * Flow per-app staging seeder (commerce / order-to-cash).
 *
 * Generates synthetic commerce data (customers, products, suppliers,
 * quotes, orders, invoices, payments, fulfillment tasks, inventory
 * movements, purchase orders) scoped to a single staging-only org.
 *
 * Like the union-eyes seeder, this is PLAN-ONLY in phase 2. Real
 * Drizzle writes against `commerce*` tables land in phase 3.
 */
import { registerSeeder } from '../core/registry'
import * as shared from '../shared'
import type {
  SeedAppReport,
  SeedContext,
  SeedProfile,
  SeederModule,
} from '../core/types'
import { persistOrSkip, persistResetOrSkip } from './_persist-helpers'

const SUPPORTED_PROFILES: readonly SeedProfile[] = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
]

const STAGING_ORG = {
  id: 'org-flow-staging-merchant-9999',
  name: 'Flow Staging Merchant 9999',
  slug: 'flow-staging-merchant-9999',
}

interface FlowScale {
  readonly customers: number
  readonly products: number
  readonly suppliers: number
  readonly quotes: number
  readonly orders: number
  readonly invoices: number
  readonly payments: number
  readonly fulfillmentTasks: number
  readonly purchaseOrders: number
  readonly inventoryMovements: number
  readonly notifications: number
  readonly activityLogs: number
}

function flowScale(profile: SeedProfile): FlowScale {
  switch (profile) {
    case 'demo-light':
      return { customers: 60, products: 40, suppliers: 6, quotes: 30, orders: 80, invoices: 80, payments: 70, fulfillmentTasks: 80, purchaseOrders: 12, inventoryMovements: 120, notifications: 60, activityLogs: 200 }
    case 'demo-standard':
      return { customers: 300, products: 150, suppliers: 18, quotes: 180, orders: 400, invoices: 400, payments: 360, fulfillmentTasks: 400, purchaseOrders: 60, inventoryMovements: 700, notifications: 300, activityLogs: 1200 }
    case 'executive-showcase':
      return { customers: 1500, products: 600, suppliers: 60, quotes: 900, orders: 2200, invoices: 2200, payments: 2000, fulfillmentTasks: 2200, purchaseOrders: 240, inventoryMovements: 4000, notifications: 1800, activityLogs: 6000 }
    case 'investor-showcase':
      return { customers: 4500, products: 1500, suppliers: 150, quotes: 2500, orders: 6500, invoices: 6500, payments: 6000, fulfillmentTasks: 6500, purchaseOrders: 700, inventoryMovements: 12_000, notifications: 5000, activityLogs: 15_000 }
  }
}

const PRODUCT_CATEGORIES = ['apparel', 'electronics', 'home', 'beauty', 'food', 'sports', 'office'] as const
const ORDER_STATUSES = ['pending', 'confirmed', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'returned'] as const
const FULFILLMENT_STATUSES = ['queued', 'picking', 'packed', 'shipped', 'delivered', 'failed'] as const
const PAYMENT_METHODS = ['card', 'ach', 'wire', 'paypal', 'stripe'] as const

interface SyntheticProduct {
  readonly id: string
  readonly orgId: string
  readonly sku: string
  readonly name: string
  readonly category: (typeof PRODUCT_CATEGORIES)[number]
  readonly priceCents: number
  readonly stockQty: number
}

interface SyntheticOrder {
  readonly id: string
  readonly orgId: string
  readonly customerId: string
  readonly status: (typeof ORDER_STATUSES)[number]
  readonly placedAt: string
  readonly totalCents: number
  readonly itemCount: number
}

interface SyntheticPayment {
  readonly id: string
  readonly orderId: string
  readonly method: (typeof PAYMENT_METHODS)[number]
  readonly amountCents: number
  readonly capturedAt: string
}

interface SyntheticFulfillment {
  readonly id: string
  readonly orderId: string
  readonly status: (typeof FULFILLMENT_STATUSES)[number]
  readonly carrier: string
  readonly tracking: string
}

interface SyntheticPurchaseOrder {
  readonly id: string
  readonly supplierId: string
  readonly status: 'draft' | 'sent' | 'received' | 'cancelled'
  readonly itemCount: number
  readonly totalCents: number
  readonly placedAt: string
}

interface SyntheticInventoryMovement {
  readonly id: string
  readonly productId: string
  readonly delta: number
  readonly reason: 'order' | 'return' | 'restock' | 'adjustment'
  readonly at: string
}

function buildPlan(ctx: SeedContext) {
  const scale = flowScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'retail', tier: 'enterprise' as const }]

  const customerPeople = shared.fakePeople(ctx.rng, ctx.time, scale.customers)
  const customers = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: customerPeople, organizations: orgs, count: scale.customers })

  const supplierOrgs = shared.fakeOrganizations(ctx.rng, ctx.time, scale.suppliers)

  const products: SyntheticProduct[] = Array.from({ length: scale.products }, (_, i) => ({
    id: ctx.rng.id('product'),
    orgId: STAGING_ORG.id,
    sku: `STG-${String(i + 1).padStart(5, '0')}`,
    name: `Synthetic Product ${i + 1}`,
    category: ctx.rng.pick(PRODUCT_CATEGORIES),
    priceCents: ctx.rng.intBetween(500, 50_000),
    stockQty: ctx.rng.intBetween(0, 500),
  }))

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()

  const orders: SyntheticOrder[] = Array.from({ length: scale.orders }, () => {
    const placedAt = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('order'),
      orgId: STAGING_ORG.id,
      customerId: ctx.rng.pick(customers).id,
      status: ctx.rng.pick(ORDER_STATUSES),
      placedAt: placedAt.toISOString(),
      totalCents: ctx.rng.intBetween(1000, 250_000),
      itemCount: ctx.rng.intBetween(1, 8),
    }
  })

  const quotes = shared.fakeInvoices({ rng: ctx.rng, time: ctx.time, organizations: orgs, count: scale.quotes })
  const invoices = shared.fakeInvoices({ rng: ctx.rng, time: ctx.time, organizations: orgs, count: scale.invoices })

  const payments: SyntheticPayment[] = Array.from({ length: scale.payments }, () => {
    const order = ctx.rng.pick(orders)
    return {
      id: ctx.rng.id('payment'),
      orderId: order.id,
      method: ctx.rng.pick(PAYMENT_METHODS),
      amountCents: order.totalCents,
      capturedAt: order.placedAt,
    }
  })

  const fulfillmentTasks: SyntheticFulfillment[] = Array.from({ length: scale.fulfillmentTasks }, () => ({
    id: ctx.rng.id('fulfillment'),
    orderId: ctx.rng.pick(orders).id,
    status: ctx.rng.pick(FULFILLMENT_STATUSES),
    carrier: ctx.rng.pick(['UPS', 'FedEx', 'DHL', 'Canada Post', 'USPS']),
    tracking: `TRK${ctx.rng.intBetween(100_000_000, 999_999_999)}`,
  }))

  const purchaseOrders: SyntheticPurchaseOrder[] = Array.from({ length: scale.purchaseOrders }, () => {
    const placedAt = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('po'),
      supplierId: ctx.rng.pick(supplierOrgs).id,
      status: ctx.rng.pick(['draft', 'sent', 'received', 'cancelled'] as const),
      itemCount: ctx.rng.intBetween(1, 25),
      totalCents: ctx.rng.intBetween(50_000, 5_000_000),
      placedAt: placedAt.toISOString(),
    }
  })

  const inventoryMovements: SyntheticInventoryMovement[] = Array.from({ length: scale.inventoryMovements }, () => {
    const reason = ctx.rng.pick(['order', 'return', 'restock', 'adjustment'] as const)
    const sign = reason === 'order' ? -1 : 1
    return {
      id: ctx.rng.id('inventory'),
      productId: ctx.rng.pick(products).id,
      delta: sign * ctx.rng.intBetween(1, 50),
      reason,
      at: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    }
  })

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users: customers, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users: customers, count: scale.activityLogs })

  return { orgs, customers, supplierOrgs, products, orders, quotes, invoices, payments, fulfillmentTasks, purchaseOrders, inventoryMovements, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'flow',
  description: 'Flow synthetic merchant: customers, products, suppliers, quotes, orders, invoices, payments, fulfillment, inventory.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)

    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'customers', entity: 'customers', count: plan.customers.length })
    ctx.report.step({ step: 'suppliers', entity: 'organizations', count: plan.supplierOrgs.length })
    ctx.report.step({ step: 'products', entity: 'products', count: plan.products.length })
    ctx.report.step({ step: 'quotes', entity: 'invoices', count: plan.quotes.length })
    ctx.report.step({ step: 'orders', entity: 'orders', count: plan.orders.length })
    ctx.report.step({ step: 'invoices', entity: 'invoices', count: plan.invoices.length })
    ctx.report.step({ step: 'payments', entity: 'payments', count: plan.payments.length })
    ctx.report.step({ step: 'fulfillment_tasks', entity: 'fulfillment', count: plan.fulfillmentTasks.length })
    ctx.report.step({ step: 'purchase_orders', entity: 'purchase_orders', count: plan.purchaseOrders.length })
    ctx.report.step({ step: 'inventory_movements', entity: 'inventory', count: plan.inventoryMovements.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    await persistOrSkip(ctx, STAGING_ORG.id, [
      { entityType: 'organizations', rows: plan.orgs },
      { entityType: 'customers', rows: plan.customers },
      { entityType: 'suppliers', rows: plan.supplierOrgs },
      { entityType: 'products', rows: plan.products },
      { entityType: 'quotes', rows: plan.quotes },
      { entityType: 'orders', rows: plan.orders },
      { entityType: 'invoices', rows: plan.invoices },
      { entityType: 'payments', rows: plan.payments },
      { entityType: 'fulfillment_tasks', rows: plan.fulfillmentTasks },
      { entityType: 'purchase_orders', rows: plan.purchaseOrders },
      { entityType: 'inventory_movements', rows: plan.inventoryMovements },
      { entityType: 'notifications', rows: plan.notifications },
      { entityType: 'activity_logs', rows: plan.activityLogs },
    ])

    ctx.logger.info('flow seed plan computed', {
      profile: ctx.profile,
      customers: plan.customers.length,
      orders: plan.orders.length,
      products: plan.products.length,
      org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    await persistResetOrSkip(ctx, STAGING_ORG.id)
    ctx.logger.info('flow reset', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, flowScale, buildPlan }
