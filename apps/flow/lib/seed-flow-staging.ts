/**
 * Flow — Staging Seed (Command-Bus Driven)
 *
 * Seeds staging data through the control layer command bus, exercising
 * every command handler and guard in the canonical lifecycle:
 *
 *   quote → send → accept → order → deposit → PO → production → shipment → delivery
 *
 * This proves the command bus is operationally complete and auditable.
 *
 * Usage: tsx lib/seed-flow-staging.ts
 */
import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'
import { execute, getRegisteredCommandTypes } from '@/lib/control/command-bus'
import '@/lib/control/register-handlers'
import type { CommandContext, CommandResult } from '@/lib/control/types'
import {
  db,
  commerceCustomers,
  commerceSuppliers,
} from '@nzila/db'
import {
  SHOPMOICA_ORG_ID,
  SHOPMOICA_SETTINGS,
  SHOPMOICA_QUOTE_POLICY,
  SHOPMOICA_PAYMENT_POLICY,
  SHOPMOICA_SUPPLIER_POLICY,
  SHOPMOICA_CATALOG_POLICY,
  SHOPMOICA_BRANDING,
  SHOPMOICA_COMMUNICATION_TEMPLATES,
} from '@nzila/platform-commerce-org/defaults'
import {
  upsertOrgSettings,
  upsertOrgQuotePolicy,
  upsertOrgPaymentPolicy,
  upsertOrgSupplierPolicy,
  upsertOrgCatalogPolicy,
  upsertOrgBranding,
  upsertOrgCommunicationTemplates,
} from '@nzila/platform-commerce-org/service'
import type { OrgCommerceConfig } from '@nzila/platform-commerce-org/types'

// ── Configuration ──────────────────────────────────────────────────────────

const ORG_ID = SHOPMOICA_ORG_ID
const SEED_ACTOR = 'staging-seed'
const ENV = 'staging' as const

// Pre-generated stable IDs for referential integrity
const IDS = {
  customer1: 'staging-cust-' + '10000000-0000-0000-0000-000000000001'.slice(13),
  customer2: 'staging-cust-' + '20000000-0000-0000-0000-000000000002'.slice(13),
  vendor1: 'staging-vendor-' + '30000000-0000-0000-0000-000000000001'.slice(15),
  vendor2: 'staging-vendor-' + '40000000-0000-0000-0000-000000000002'.slice(15),
} as const

function makeCtx(correlationId?: string): CommandContext {
  return {
    org_id: ORG_ID,
    actor_id: SEED_ACTOR,
    correlation_id: correlationId ?? randomUUID(),
    environment: ENV,
    request_source: 'staging-seed',
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface StepOutcome {
  step: string
  success: boolean
  entityId?: string
  statusAfter?: string
  error?: string
}

const outcomes: StepOutcome[] = []

async function step(name: string, fn: () => Promise<CommandResult>): Promise<CommandResult> {
  try {
    const result = await fn()
    outcomes.push({
      step: name,
      success: result.success,
      entityId: result.entity_id,
      statusAfter: result.status_after,
      error: result.errors?.map(e => e.message).join('; '),
    })
    if (!result.success) {
      logger.warn(`Staging seed step failed: ${name}`, {
        errors: result.errors,
      })
    }
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    outcomes.push({ step: name, success: false, error: msg })
    logger.error(`Staging seed step threw: ${name}`, { error: err })
    return { success: false, errors: [{ code: 'SEED_ERROR', message: msg }] }
  }
}

// ── Prerequisite Setup (direct DB — customers & vendors must exist first) ─

async function seedPrerequisites(): Promise<void> {
  // Org config
  const strip = <T extends { orgId: string }>(obj: T): Omit<T, 'orgId'> => {
    const { orgId: _, ...rest } = obj
    return rest
  }
  const config: OrgCommerceConfig = {
    settings: SHOPMOICA_SETTINGS,
    quotePolicy: SHOPMOICA_QUOTE_POLICY,
    paymentPolicy: SHOPMOICA_PAYMENT_POLICY,
    supplierPolicy: SHOPMOICA_SUPPLIER_POLICY,
    catalogPolicy: SHOPMOICA_CATALOG_POLICY,
    branding: SHOPMOICA_BRANDING,
    communicationTemplates: SHOPMOICA_COMMUNICATION_TEMPLATES,
  }
  await upsertOrgSettings(ORG_ID, strip(config.settings), SEED_ACTOR)
  await upsertOrgQuotePolicy(ORG_ID, strip(config.quotePolicy), SEED_ACTOR)
  await upsertOrgPaymentPolicy(ORG_ID, strip(config.paymentPolicy), SEED_ACTOR)
  await upsertOrgSupplierPolicy(ORG_ID, strip(config.supplierPolicy), SEED_ACTOR)
  await upsertOrgCatalogPolicy(ORG_ID, strip(config.catalogPolicy), SEED_ACTOR)
  await upsertOrgBranding(ORG_ID, strip(config.branding), SEED_ACTOR)
  await upsertOrgCommunicationTemplates(ORG_ID, strip(config.communicationTemplates), SEED_ACTOR)

  // Customers
  for (const c of [
    { id: IDS.customer1, name: 'Alice Johnson', email: 'alice@bigcorp.com', company: 'BigCorp Inc' },
    { id: IDS.customer2, name: 'David Chen', email: 'david@retailchain.com', company: 'RetailChain' },
  ]) {
    await db
      .insert(commerceCustomers)
      .values({
        id: c.id,
        orgId: ORG_ID,
        name: c.name,
        email: c.email,
        metadata: { company: c.company },
      })
      .onConflictDoNothing()
  }

  // Vendors / suppliers
  for (const v of [
    { id: IDS.vendor1, name: 'CapMaster Inc', email: 'caps@capmaster.ca', leadTimeDays: 10 },
    { id: IDS.vendor2, name: 'PrintPro Co', email: 'info@printpro.ca', leadTimeDays: 7 },
  ]) {
    await db
      .insert(commerceSuppliers)
      .values({
        id: v.id,
        orgId: ORG_ID,
        name: v.name,
        email: v.email,
        leadTimeDays: v.leadTimeDays,
      })
      .onConflictDoNothing()
  }
}

// ── Lifecycle A: Full Happy Path ──────────────────────────────────────────
// quote → send → accept → convert → confirm → deposit → payment →
// PO → send PO → confirm PO → production → complete → shipment → ship → deliver

async function lifecycleA(): Promise<void> {
  const correlationId = randomUUID()
  const ctx = makeCtx(correlationId)

  // 1. Create quote
  const q = await step('A1: Create quote', () =>
    execute({
      type: 'create_quote',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      customer_id: IDS.customer1,
      title: 'Corporate Cap Order — BigCorp',
      currency: 'CAD',
      lines: [
        { description: 'Custom Baseball Cap', sku: 'CAP-001', quantity: 500, unit_price: 12.50 },
        { description: 'Embroidered Polo Shirt', sku: 'POLO-001', quantity: 200, unit_price: 28.00 },
      ],
    }, ctx),
  )
  if (!q.success || !q.entity_id) return
  const quoteId = q.entity_id

  // 2. Send to client
  await step('A2: Send quote', () =>
    execute({ type: 'send_quote', org_id: ORG_ID, actor_id: SEED_ACTOR, quote_id: quoteId }, ctx),
  )

  // 3. Client accepts
  await step('A3: Accept quote', () =>
    execute({
      type: 'accept_quote',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      quote_id: quoteId,
      customer_name: 'Alice Johnson',
      customer_email: 'alice@bigcorp.com',
    }, ctx),
  )

  // 4. Convert to order
  const ord = await step('A4: Convert to order', () =>
    execute({ type: 'convert_quote_to_order', org_id: ORG_ID, actor_id: SEED_ACTOR, quote_id: quoteId }, ctx),
  )
  if (!ord.success || !ord.entity_id) return
  const orderId = ord.entity_id

  // 5. Confirm order
  await step('A5: Confirm order', () =>
    execute({ type: 'confirm_order', org_id: ORG_ID, actor_id: SEED_ACTOR, order_id: orderId }, ctx),
  )

  // 6. Set deposit requirement
  await step('A6: Require deposit', () =>
    execute({
      type: 'require_deposit',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      deposit_required: true,
      deposit_percent: 50,
      due_before_production: true,
    }, ctx),
  )

  // 7. Record deposit payment
  const pay = await step('A7: Record payment', () =>
    execute({
      type: 'record_payment',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      amount: 5625, // 50% of $11,250 subtotal
      currency: 'CAD',
      method: 'BANK_TRANSFER',
      reference: 'STAGING-DEP-001',
    }, ctx),
  )
  const paymentId = pay.entity_id

  // 8. Confirm payment
  if (paymentId) {
    await step('A8: Confirm payment', () =>
      execute({
        type: 'confirm_payment',
        org_id: ORG_ID,
        actor_id: SEED_ACTOR,
        payment_id: paymentId,
        order_id: orderId,
      }, ctx),
    )
  }

  // 9. Create purchase order
  const po = await step('A9: Create PO', () =>
    execute({
      type: 'create_purchase_order',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      vendor_id: IDS.vendor1,
      expected_delivery: new Date(Date.now() + 14 * 86400000),
    }, ctx),
  )
  if (!po.success || !po.entity_id) return
  const poId = po.entity_id

  // 10. Send PO to vendor
  await step('A10: Send PO', () =>
    execute({
      type: 'send_purchase_order',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      purchase_order_id: poId,
    }, ctx),
  )

  // 11. Vendor confirms PO
  await step('A11: Confirm PO', () =>
    execute({
      type: 'confirm_purchase_order',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      purchase_order_id: poId,
    }, ctx),
  )

  // 12. Start production
  const prod = await step('A12: Start production', () =>
    execute({
      type: 'start_production',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      purchase_order_id: poId,
      vendor_id: IDS.vendor1,
    }, ctx),
  )
  if (!prod.success || !prod.entity_id) return
  const jobId = prod.entity_id

  // 13. Complete production
  await step('A13: Complete production', () =>
    execute({
      type: 'complete_production',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      production_job_id: jobId,
      order_id: orderId,
    }, ctx),
  )

  // 14. Create shipment
  const ship = await step('A14: Create shipment', () =>
    execute({
      type: 'create_shipment',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      carrier: 'Purolator',
    }, ctx),
  )
  if (!ship.success || !ship.entity_id) return
  const shipmentId = ship.entity_id

  // 15. Mark shipped
  await step('A15: Mark shipped', () =>
    execute({
      type: 'mark_shipment_shipped',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      shipment_id: shipmentId,
      order_id: orderId,
      carrier: 'Purolator',
      tracking_number: 'PLR-STAGING-A001',
    }, ctx),
  )

  // 16. Mark delivered
  await step('A16: Mark delivered', () =>
    execute({
      type: 'mark_shipment_delivered',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      shipment_id: shipmentId,
      order_id: orderId,
    }, ctx),
  )
}

// ── Lifecycle B: Payment-Gated (blocked) ─────────────────────────────────
// quote → send → accept → convert → confirm → deposit required → PO blocked

async function lifecycleB(): Promise<void> {
  const correlationId = randomUUID()
  const ctx = makeCtx(correlationId)

  // 1. Create quote
  const q = await step('B1: Create quote', () =>
    execute({
      type: 'create_quote',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      customer_id: IDS.customer2,
      title: 'Retail Display Kit — RetailChain',
      currency: 'CAD',
      lines: [
        { description: 'Custom USB Drive 16GB', sku: 'USB-016', quantity: 1000, unit_price: 6.00 },
        { description: 'Printed Water Bottle', sku: 'BOTTLE-001', quantity: 500, unit_price: 15.00 },
      ],
    }, ctx),
  )
  if (!q.success || !q.entity_id) return
  const quoteId = q.entity_id

  // 2. Send
  await step('B2: Send quote', () =>
    execute({ type: 'send_quote', org_id: ORG_ID, actor_id: SEED_ACTOR, quote_id: quoteId }, ctx),
  )

  // 3. Accept
  await step('B3: Accept quote', () =>
    execute({
      type: 'accept_quote',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      quote_id: quoteId,
      customer_name: 'David Chen',
      customer_email: 'david@retailchain.com',
    }, ctx),
  )

  // 4. Convert
  const ord = await step('B4: Convert to order', () =>
    execute({ type: 'convert_quote_to_order', org_id: ORG_ID, actor_id: SEED_ACTOR, quote_id: quoteId }, ctx),
  )
  if (!ord.success || !ord.entity_id) return
  const orderId = ord.entity_id

  // 5. Confirm
  await step('B5: Confirm order', () =>
    execute({ type: 'confirm_order', org_id: ORG_ID, actor_id: SEED_ACTOR, order_id: orderId }, ctx),
  )

  // 6. Require deposit (30%)
  await step('B6: Require deposit', () =>
    execute({
      type: 'require_deposit',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      deposit_required: true,
      deposit_percent: 30,
      due_before_production: true,
    }, ctx),
  )

  // 7. Attempt PO creation — should be blocked by payment gate
  await step('B7: Create PO (expect blocked)', () =>
    execute({
      type: 'create_purchase_order',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      order_id: orderId,
      vendor_id: IDS.vendor2,
    }, ctx),
  )
}

// ── Lifecycle C: Revision Flow ───────────────────────────────────────────
// quote → send → revision request → stays in revision state

async function lifecycleC(): Promise<void> {
  const correlationId = randomUUID()
  const ctx = makeCtx(correlationId)

  // 1. Create quote
  const q = await step('C1: Create quote', () =>
    execute({
      type: 'create_quote',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      customer_id: IDS.customer2,
      title: 'Event Giveaway — RetailChain',
      currency: 'CAD',
      lines: [
        { description: 'Branded Tote Bag', sku: 'TOTE-001', quantity: 300, unit_price: 8.50 },
      ],
    }, ctx),
  )
  if (!q.success || !q.entity_id) return
  const quoteId = q.entity_id

  // 2. Send
  await step('C2: Send quote', () =>
    execute({ type: 'send_quote', org_id: ORG_ID, actor_id: SEED_ACTOR, quote_id: quoteId }, ctx),
  )

  // 3. Client requests revision
  await step('C3: Request revision', () =>
    execute({
      type: 'request_quote_revision',
      org_id: ORG_ID,
      actor_id: SEED_ACTOR,
      quote_id: quoteId,
      request_message: 'Can you reduce the quantity to 200 and include a logo setup fee?',
    }, ctx),
  )
}

// ── Main Entry ─────────────────────────────────────────────────────────────

async function seedFlowStaging(): Promise<void> {
  logger.info('Flow staging seed starting', {
    org_id: ORG_ID,
    actor: SEED_ACTOR,
    registeredCommands: getRegisteredCommandTypes(),
  })

  // 1. Prerequisites (org config, customers, vendors)
  await seedPrerequisites()
  logger.info('Prerequisites seeded')

  // 2. Lifecycle A — full happy path (16 steps)
  await lifecycleA()
  logger.info('Lifecycle A complete')

  // 3. Lifecycle B — payment-gated (7 steps, PO blocked)
  await lifecycleB()
  logger.info('Lifecycle B complete')

  // 4. Lifecycle C — revision flow (3 steps)
  await lifecycleC()
  logger.info('Lifecycle C complete')

  // ── Summary ────────────────────────────────────────────────────────────

  const succeeded = outcomes.filter(o => o.success).length
  const failed = outcomes.filter(o => !o.success).length
  const total = outcomes.length

  logger.info('Flow staging seed complete', {
    total,
    succeeded,
    failed,
    outcomes: outcomes.map(o => ({
      step: o.step,
      ok: o.success,
      entity: o.entityId ?? '—',
      status: o.statusAfter ?? '—',
      error: o.error ?? null,
    })),
  })

  if (failed > 0) {
    const expectedFailures = outcomes.filter(
      o => !o.success && o.step.includes('expect blocked'),
    )
    const unexpectedFailures = outcomes.filter(
      o => !o.success && !o.step.includes('expect blocked'),
    )

    if (unexpectedFailures.length > 0) {
      logger.error('Unexpected failures in staging seed', {
        failures: unexpectedFailures,
      })
      process.exitCode = 1
    } else {
      logger.info('All failures were expected (payment gate blocks)', {
        expectedBlocks: expectedFailures.length,
      })
    }
  }
}

if (process.argv[1]?.includes('seed-flow-staging')) {
  seedFlowStaging().catch((err) => {
    logger.error('Staging seed failed', { error: err })
    process.exitCode = 1
  })
}

export { seedFlowStaging }
