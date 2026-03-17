/**
 * Flow — Demo Seed Data
 *
 * Creates demo org, users, workflow examples, and analytics data
 * for pilot demonstrations.
 *
 * Includes the full ShopMoiCa lifecycle samples:
 * - Draft quote
 * - Revision flow (sent → revision → re-sent → accepted)
 * - Deposit-required flow (accepted → deposit → ready for PO)
 * - In-production flow (PO → production → shipped → delivered)
 * - Invoice-linked (closed with payment)
 */
import { logger } from '@/lib/logger'
import {
  db,
  commerceCustomers,
  commerceQuotes,
  commerceQuoteLines,
  commerceTimelineEvents,
  commerceOrders,
  commerceSuppliers,
  commercePurchaseOrders,
  flowProductionJobs,
  flowShipments,
  flowPayments,
  flowDomainEvents,
} from '@nzila/db'
import {
  upsertOrgSettings,
  upsertOrgQuotePolicy,
  upsertOrgPaymentPolicy,
  upsertOrgSupplierPolicy,
  upsertOrgCatalogPolicy,
  upsertOrgBranding,
  upsertOrgCommunicationTemplates,
} from '@nzila/platform-commerce-org/service'
import {
  SHOPMOICA_ORG_ID,
  SHOPMOICA_SETTINGS,
  SHOPMOICA_QUOTE_POLICY,
  SHOPMOICA_PAYMENT_POLICY,
  SHOPMOICA_SUPPLIER_POLICY,
  SHOPMOICA_CATALOG_POLICY,
  SHOPMOICA_BRANDING,
  SHOPMOICA_COMMUNICATION_TEMPLATES,
  PROMONORTH_ORG_ID,
  PROMONORTH_SETTINGS,
  PROMONORTH_QUOTE_POLICY,
  PROMONORTH_PAYMENT_POLICY,
  PROMONORTH_SUPPLIER_POLICY,
  PROMONORTH_CATALOG_POLICY,
  PROMONORTH_BRANDING,
  PROMONORTH_COMMUNICATION_TEMPLATES,
} from '@nzila/platform-commerce-org/defaults'
import type { OrgCommerceConfig } from '@nzila/platform-commerce-org/types'

export interface DemoOrg {
  id: string
  name: string
  tier: string
}

export interface DemoUser {
  id: string
  email: string
  role: string
  orgId: string
}

export interface DemoCustomer {
  id: string
  name: string
  email: string
  company: string
}

export interface DemoQuote {
  id: string
  ref: string
  orgId: string
  customerId: string
  title: string
  status: string
  lines: Array<{ productId: string; description: string; quantity: number; unitPrice: number }>
  total: number
  notes?: string
}

export interface DemoTimeline {
  quoteId: string
  events: Array<{ event: string; description: string; actor: string }>
}

// ── Order-centric demo types ──────────────────────────────────────────────

export interface DemoOrder {
  id: string
  quoteId: string | null
  orgId: string
  customerId: string
  status: string
  paymentStatus: string
  productionStatus: string
  fulfillmentStatus: string
  totalAmount: number
  currency: string
  notes?: string
}

export interface DemoVendor {
  id: string
  orgId: string
  name: string
  contactEmail: string
  leadTimeDays: number
}

export interface DemoPurchaseOrder {
  id: string
  orderId: string
  vendorId: string
  orgId: string
  status: string
  totalAmount: number
}

export interface DemoProductionJob {
  id: string
  orderId: string
  orgId: string
  status: string
  proofUrl: string | null
  assignedTo: string
}

export function createDemoOrg(): DemoOrg {
  return { id: SHOPMOICA_ORG_ID, name: 'ShopMoiCa Demo Corp', tier: 'PREMIUM' }
}

export function createDemoUsers(orgId: string): DemoUser[] {
  return [
    { id: 'demo-admin', email: 'admin@shopmoica.demo', role: 'admin', orgId },
    { id: 'demo-sales', email: 'sales@shopmoica.demo', role: 'sales', orgId },
    { id: 'demo-finance', email: 'finance@shopmoica.demo', role: 'finance', orgId },
    { id: 'demo-production', email: 'production@shopmoica.demo', role: 'production', orgId },
  ]
}

export function createDemoCustomers(): DemoCustomer[] {
  return [
    { id: 'demo-customer-1', name: 'Marie Tremblay', email: 'marie@example.ca', company: 'Tremblay & Fils' },
    { id: 'demo-customer-2', name: 'Jean-Paul Bergeron', email: 'jp@example.ca', company: 'Bergeron Industriel' },
    { id: 'demo-customer-3', name: 'Sophie Lavoie', email: 'sophie@example.ca', company: 'Lavoie Imports' },
    { id: 'demo-customer-4', name: 'Pierre Gagnon', email: 'pierre@example.ca', company: 'Gagnon Construction' },
    { id: 'demo-customer-5', name: 'Isabelle Roy', email: 'isabelle@example.ca', company: 'Roy Distribution' },
  ]
}

export function createDemoQuotes(orgId: string): DemoQuote[] {
  return [
    // 1. Fresh draft
    {
      id: 'demo-quote-001',
      ref: 'SQ-2026-001',
      orgId,
      customerId: 'demo-customer-1',
      title: 'Custom Signage Package — Tremblay',
      status: 'DRAFT',
      lines: [
        { productId: 'prod-sign-lg', description: 'Large Exterior Sign', quantity: 2, unitPrice: 1200 },
        { productId: 'prod-sign-sm', description: 'Interior Directional Sign', quantity: 8, unitPrice: 150 },
      ],
      total: 3600,
      notes: 'Client prefers blue/white colour scheme',
    },
    // 2. Revision flow — currently back in REVISION_REQUESTED
    {
      id: 'demo-quote-002',
      ref: 'SQ-2026-002',
      orgId,
      customerId: 'demo-customer-2',
      title: 'Industrial Shelving — Bergeron',
      status: 'REVISION_REQUESTED',
      lines: [
        { productId: 'prod-shelf-hd', description: 'Heavy-Duty Shelving Unit', quantity: 20, unitPrice: 450 },
        { productId: 'prod-bracket', description: 'Wall Bracket Kit', quantity: 20, unitPrice: 35 },
      ],
      total: 9700,
      notes: 'Client wants revised delivery timeline',
    },
    // 3. Deposit-required flow — awaiting deposit
    {
      id: 'demo-quote-003',
      ref: 'SQ-2026-003',
      orgId,
      customerId: 'demo-customer-3',
      title: 'Office Furniture Set — Lavoie',
      status: 'DEPOSIT_REQUIRED',
      lines: [
        { productId: 'prod-desk-exec', description: 'Executive Desk', quantity: 5, unitPrice: 2200 },
        { productId: 'prod-chair-ergo', description: 'Ergonomic Chair', quantity: 10, unitPrice: 850 },
      ],
      total: 19500,
      notes: '30% deposit required before production',
    },
    // 4. Ready for PO — deposit cleared
    {
      id: 'demo-quote-004',
      ref: 'SQ-2026-004',
      orgId,
      customerId: 'demo-customer-4',
      title: 'Construction Equipment — Gagnon',
      status: 'READY_FOR_PO',
      lines: [
        { productId: 'prod-drill-ind', description: 'Industrial Drill Press', quantity: 2, unitPrice: 4500 },
        { productId: 'prod-saw-band', description: 'Band Saw Professional', quantity: 1, unitPrice: 3200 },
      ],
      total: 12200,
    },
    // 5. In production
    {
      id: 'demo-quote-005',
      ref: 'SQ-2026-005',
      orgId,
      customerId: 'demo-customer-5',
      title: 'Distribution Center Racking — Roy',
      status: 'IN_PRODUCTION',
      lines: [
        { productId: 'prod-rack-pallet', description: 'Pallet Racking System', quantity: 50, unitPrice: 320 },
        { productId: 'prod-rack-wire', description: 'Wire Decking', quantity: 100, unitPrice: 45 },
      ],
      total: 20500,
    },
    // 6. Shipped
    {
      id: 'demo-quote-006',
      ref: 'SQ-2026-006',
      orgId,
      customerId: 'demo-customer-1',
      title: 'Replacement Signs — Tremblay (follow-up)',
      status: 'SHIPPED',
      lines: [
        { productId: 'prod-sign-sm', description: 'Interior Directional Sign', quantity: 4, unitPrice: 150 },
      ],
      total: 600,
    },
    // 7. Delivered + closed — full lifecycle complete
    {
      id: 'demo-quote-007',
      ref: 'SQ-2026-007',
      orgId,
      customerId: 'demo-customer-2',
      title: 'Shelving Phase 1 — Bergeron (historical)',
      status: 'CLOSED',
      lines: [
        { productId: 'prod-shelf-hd', description: 'Heavy-Duty Shelving Unit', quantity: 10, unitPrice: 450 },
      ],
      total: 4500,
    },
  ]
}

export function createDemoTimelines(): DemoTimeline[] {
  return [
    {
      quoteId: 'demo-quote-002',
      events: [
        { event: 'created', description: 'Quote created', actor: 'demo-sales' },
        { event: 'submitted_for_review', description: 'Submitted for internal review', actor: 'demo-sales' },
        { event: 'sent_to_client', description: 'Sent to Jean-Paul Bergeron', actor: 'demo-admin' },
        { event: 'revision_requested', description: 'Client requested revised delivery timeline', actor: 'client' },
      ],
    },
    {
      quoteId: 'demo-quote-003',
      events: [
        { event: 'created', description: 'Quote created', actor: 'demo-sales' },
        { event: 'sent_to_client', description: 'Sent to Sophie Lavoie', actor: 'demo-sales' },
        { event: 'accepted', description: 'Client accepted', actor: 'client' },
        { event: 'deposit_requirement_set', description: 'Deposit: 30% ($5,850.00)', actor: 'demo-finance' },
      ],
    },
    {
      quoteId: 'demo-quote-005',
      events: [
        { event: 'created', description: 'Quote created', actor: 'demo-sales' },
        { event: 'accepted', description: 'Client accepted', actor: 'client' },
        { event: 'deposit_cleared', description: 'Deposit $6,150 received', actor: 'demo-finance' },
        { event: 'po_created', description: 'PO-2026-012 created', actor: 'demo-admin' },
        { event: 'production_started', description: 'Production started', actor: 'demo-production' },
      ],
    },
    {
      quoteId: 'demo-quote-007',
      events: [
        { event: 'created', description: 'Quote created', actor: 'demo-sales' },
        { event: 'accepted', description: 'Client accepted', actor: 'client' },
        { event: 'po_created', description: 'PO-2026-005 created', actor: 'demo-admin' },
        { event: 'production_started', description: 'Production started', actor: 'demo-production' },
        { event: 'order_shipped', description: 'Shipped via Purolator', actor: 'demo-production' },
        { event: 'order_delivered', description: 'Delivered to client', actor: 'demo-production' },
        { event: 'quote_closed', description: 'Quote closed — lifecycle complete', actor: 'demo-admin' },
      ],
    },
  ]
}

export function createDemoAnalytics() {
  return {
    quotesThisMonth: 47,
    conversionRate: 0.68,
    avgQuoteValue: 8500,
    topProducts: ['Heavy-Duty Shelving Unit', 'Executive Desk', 'Industrial Drill Press'],
    statusBreakdown: {
      DRAFT: 12,
      INTERNAL_REVIEW: 3,
      SENT_TO_CLIENT: 8,
      REVISION_REQUESTED: 2,
      ACCEPTED: 5,
      DEPOSIT_REQUIRED: 3,
      READY_FOR_PO: 4,
      IN_PRODUCTION: 6,
      SHIPPED: 2,
      DELIVERED: 1,
      CLOSED: 1,
    },
  }
}

// ── PromoNorth demo data ────────────────────────────────────────────────────

export function createPromoNorthOrg(): DemoOrg {
  return { id: PROMONORTH_ORG_ID, name: 'PromoNorth Inc.', tier: 'STANDARD' }
}

export function createPromoNorthUsers(orgId: string): DemoUser[] {
  return [
    { id: 'pn-admin', email: 'admin@promonorth.com', role: 'admin', orgId },
    { id: 'pn-sales', email: 'sales@promonorth.com', role: 'sales', orgId },
  ]
}

export function createPromoNorthCustomers(): DemoCustomer[] {
  return [
    { id: 'pn-customer-1', name: 'Jane Smith', email: 'jane@acme.com', company: 'Acme Corp' },
    { id: 'pn-customer-2', name: 'Bob Wilson', email: 'bob@globaltech.com', company: 'GlobalTech' },
    { id: 'pn-customer-3', name: 'Sara Lee', email: 'sara@nycdesign.com', company: 'NYC Design Co' },
  ]
}

export function createPromoNorthQuotes(orgId: string): DemoQuote[] {
  return [
    {
      id: 'pn-quote-001',
      ref: 'PN-2026-001',
      orgId,
      customerId: 'pn-customer-1',
      title: 'Branded Apparel Bundle — Acme',
      status: 'DRAFT',
      lines: [
        { productId: 'pn-tshirt', description: 'Custom Branded T-Shirt', quantity: 500, unitPrice: 8 },
        { productId: 'pn-cap', description: 'Embroidered Cap', quantity: 200, unitPrice: 12 },
      ],
      total: 6400,
      notes: 'Rush delivery requested',
    },
    {
      id: 'pn-quote-002',
      ref: 'PN-2026-002',
      orgId,
      customerId: 'pn-customer-2',
      title: 'Trade Show Kit — GlobalTech',
      status: 'SENT_TO_CLIENT',
      lines: [
        { productId: 'pn-mug', description: 'Ceramic Logo Mug', quantity: 1000, unitPrice: 5 },
        { productId: 'pn-pen', description: 'Premium Branded Pen', quantity: 2000, unitPrice: 2 },
        { productId: 'pn-bag', description: 'Trade Show Tote Bag', quantity: 500, unitPrice: 6 },
      ],
      total: 12000,
    },
    {
      id: 'pn-quote-003',
      ref: 'PN-2026-003',
      orgId,
      customerId: 'pn-customer-3',
      title: 'Holiday Gift Baskets — NYC Design',
      status: 'ACCEPTED',
      lines: [
        { productId: 'pn-basket', description: 'Premium Gift Basket', quantity: 100, unitPrice: 45 },
      ],
      total: 4500,
      notes: 'Corporate holiday gifts — deliver by Dec 15',
    },
  ]
}

// ── Order-centric demo data ─────────────────────────────────────────────

export function createDemoVendors(orgId: string): DemoVendor[] {
  return [
    { id: 'vendor-01', orgId, name: 'Maple Sign Co', contactEmail: 'orders@maplesign.ca', leadTimeDays: 14 },
    { id: 'vendor-02', orgId, name: 'Steel Grade Shelving', contactEmail: 'po@steelgrade.ca', leadTimeDays: 21 },
    { id: 'vendor-03', orgId, name: 'Apex Furniture Mfg', contactEmail: 'sales@apexfurniture.ca', leadTimeDays: 28 },
  ]
}

export function createDemoOrders(orgId: string): DemoOrder[] {
  return [
    // 1. Accepted quote converted to order — awaiting payment
    {
      id: 'demo-order-001',
      quoteId: 'demo-quote-003',
      orgId,
      customerId: 'demo-customer-3',
      status: 'DEPOSIT_REQUIRED',
      paymentStatus: 'PENDING',
      productionStatus: 'NOT_STARTED',
      fulfillmentStatus: 'NOT_STARTED',
      totalAmount: 19500,
      currency: 'CAD',
      notes: 'Blocked: deposit not received',
    },
    // 2. Order ready for procurement — payment cleared
    {
      id: 'demo-order-002',
      quoteId: 'demo-quote-004',
      orgId,
      customerId: 'demo-customer-4',
      status: 'READY_FOR_PROCUREMENT',
      paymentStatus: 'DEPOSIT_PAID',
      productionStatus: 'NOT_STARTED',
      fulfillmentStatus: 'NOT_STARTED',
      totalAmount: 12200,
      currency: 'CAD',
    },
    // 3. Active production job
    {
      id: 'demo-order-003',
      quoteId: 'demo-quote-005',
      orgId,
      customerId: 'demo-customer-5',
      status: 'IN_PRODUCTION',
      paymentStatus: 'DEPOSIT_PAID',
      productionStatus: 'IN_PRODUCTION',
      fulfillmentStatus: 'NOT_STARTED',
      totalAmount: 20500,
      currency: 'CAD',
    },
    // 4. Delayed vendor — PO sent, vendor overdue
    {
      id: 'demo-order-004',
      quoteId: null,
      orgId,
      customerId: 'demo-customer-1',
      status: 'IN_PRODUCTION',
      paymentStatus: 'PAID',
      productionStatus: 'IN_PRODUCTION',
      fulfillmentStatus: 'NOT_STARTED',
      totalAmount: 7800,
      currency: 'CAD',
      notes: 'Vendor Maple Sign Co delayed by 5 days',
    },
    // 5. Shipped order
    {
      id: 'demo-order-005',
      quoteId: 'demo-quote-006',
      orgId,
      customerId: 'demo-customer-1',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
      productionStatus: 'COMPLETE',
      fulfillmentStatus: 'SHIPPED',
      totalAmount: 600,
      currency: 'CAD',
    },
    // 6. Delivered + closed — full lifecycle
    {
      id: 'demo-order-006',
      quoteId: 'demo-quote-007',
      orgId,
      customerId: 'demo-customer-2',
      status: 'CLOSED',
      paymentStatus: 'PAID',
      productionStatus: 'COMPLETE',
      fulfillmentStatus: 'DELIVERED',
      totalAmount: 4500,
      currency: 'CAD',
    },
  ]
}

export function createDemoPurchaseOrders(orgId: string): DemoPurchaseOrder[] {
  return [
    { id: 'demo-po-001', orderId: 'demo-order-002', vendorId: 'vendor-01', orgId, status: 'DRAFT', totalAmount: 12200 },
    { id: 'demo-po-002', orderId: 'demo-order-003', vendorId: 'vendor-02', orgId, status: 'IN_PRODUCTION', totalAmount: 20500 },
    { id: 'demo-po-003', orderId: 'demo-order-004', vendorId: 'vendor-01', orgId, status: 'CONFIRMED', totalAmount: 7800 },
    { id: 'demo-po-004', orderId: 'demo-order-005', vendorId: 'vendor-01', orgId, status: 'SHIPPED', totalAmount: 600 },
    { id: 'demo-po-005', orderId: 'demo-order-006', vendorId: 'vendor-02', orgId, status: 'RECEIVED', totalAmount: 4500 },
  ]
}

export function createDemoProductionJobs(orgId: string): DemoProductionJob[] {
  return [
    { id: 'demo-job-001', orderId: 'demo-order-003', orgId, status: 'IN_PRODUCTION', proofUrl: 'https://canva.com/design/proof-001', assignedTo: 'demo-production' },
    { id: 'demo-job-002', orderId: 'demo-order-004', orgId, status: 'QUALITY_CHECK', proofUrl: 'https://canva.com/design/proof-002', assignedTo: 'demo-production' },
    { id: 'demo-job-003', orderId: 'demo-order-005', orgId, status: 'READY_TO_SHIP', proofUrl: null, assignedTo: 'demo-production' },
  ]
}

// ── Org config seeding ──────────────────────────────────────────────────────

async function seedOrgConfig(config: OrgCommerceConfig, actorId: string): Promise<void> {
  const { orgId } = config.settings
  const strip = <T extends { orgId: string }>(obj: T): Omit<T, 'orgId'> => {
    const { orgId: _, ...rest } = obj
    return rest
  }
  await upsertOrgSettings(orgId, strip(config.settings), actorId)
  await upsertOrgQuotePolicy(orgId, strip(config.quotePolicy), actorId)
  await upsertOrgPaymentPolicy(orgId, strip(config.paymentPolicy), actorId)
  await upsertOrgSupplierPolicy(orgId, strip(config.supplierPolicy), actorId)
  await upsertOrgCatalogPolicy(orgId, strip(config.catalogPolicy), actorId)
  await upsertOrgBranding(orgId, strip(config.branding), actorId)
  await upsertOrgCommunicationTemplates(orgId, strip(config.communicationTemplates), actorId)
}

export async function seedDemo() {
  const org = createDemoOrg()
  const users = createDemoUsers(org.id)
  const customers = createDemoCustomers()
  const quotes = createDemoQuotes(org.id)
  const timelines = createDemoTimelines()
  const analytics = createDemoAnalytics()

  // Seed ShopMoiCa org config
  const shopmoicaConfig: OrgCommerceConfig = {
    settings: SHOPMOICA_SETTINGS,
    quotePolicy: SHOPMOICA_QUOTE_POLICY,
    paymentPolicy: SHOPMOICA_PAYMENT_POLICY,
    supplierPolicy: SHOPMOICA_SUPPLIER_POLICY,
    catalogPolicy: SHOPMOICA_CATALOG_POLICY,
    branding: SHOPMOICA_BRANDING,
    communicationTemplates: SHOPMOICA_COMMUNICATION_TEMPLATES,
  }
  await seedOrgConfig(shopmoicaConfig, 'demo-seed')

  // Seed PromoNorth org config
  const promonorthConfig: OrgCommerceConfig = {
    settings: PROMONORTH_SETTINGS,
    quotePolicy: PROMONORTH_QUOTE_POLICY,
    paymentPolicy: PROMONORTH_PAYMENT_POLICY,
    supplierPolicy: PROMONORTH_SUPPLIER_POLICY,
    catalogPolicy: PROMONORTH_CATALOG_POLICY,
    branding: PROMONORTH_BRANDING,
    communicationTemplates: PROMONORTH_COMMUNICATION_TEMPLATES,
  }
  await seedOrgConfig(promonorthConfig, 'demo-seed')

  // Insert ShopMoiCa customers into DB
  for (const c of customers) {
    await db
      .insert(commerceCustomers)
      .values({
        id: c.id,
        orgId: org.id,
        name: c.name,
        email: c.email,
        metadata: { company: c.company },
      })
      .onConflictDoNothing()
  }

  // Insert ShopMoiCa quotes + lines into DB
  for (const q of quotes) {
    const subtotal = q.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const gst = subtotal * 0.05
    const qst = subtotal * 0.09975
    const total = subtotal + gst + qst

    await db
      .insert(commerceQuotes)
      .values({
        id: q.id,
        orgId: q.orgId,
        ref: q.ref,
        customerId: q.customerId,
        status: q.status.toLowerCase() as 'draft',
        pricingTier: 'standard',
        currency: 'CAD',
        subtotal: String(subtotal),
        taxTotal: String(gst + qst),
        total: String(total),
        notes: q.notes ?? null,
        metadata: { title: q.title, boxCount: 1, gst, qst },
        createdBy: 'demo-seed',
      })
      .onConflictDoNothing()

    for (const line of q.lines) {
      await db
        .insert(commerceQuoteLines)
        .values({
          id: crypto.randomUUID(),
          orgId: q.orgId,
          quoteId: q.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          lineTotal: String(line.quantity * line.unitPrice),
          sortOrder: 0,
        })
        .onConflictDoNothing()
    }
  }

  // Insert PromoNorth customers + quotes into DB
  const pnOrg = createPromoNorthOrg()
  const pnUsers = createPromoNorthUsers(pnOrg.id)
  const pnCustomers = createPromoNorthCustomers()
  const pnQuotes = createPromoNorthQuotes(pnOrg.id)

  for (const c of pnCustomers) {
    await db
      .insert(commerceCustomers)
      .values({
        id: c.id,
        orgId: pnOrg.id,
        name: c.name,
        email: c.email,
        metadata: { company: c.company },
      })
      .onConflictDoNothing()
  }

  for (const q of pnQuotes) {
    const subtotal = q.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const tax = subtotal * 0.08875 // NY sales tax
    const total = subtotal + tax

    await db
      .insert(commerceQuotes)
      .values({
        id: q.id,
        orgId: q.orgId,
        ref: q.ref,
        customerId: q.customerId,
        status: q.status.toLowerCase() as 'draft',
        pricingTier: 'standard',
        currency: 'USD',
        subtotal: String(subtotal),
        taxTotal: String(tax),
        total: String(total),
        notes: q.notes ?? null,
        metadata: { title: q.title },
        createdBy: 'demo-seed',
      })
      .onConflictDoNothing()

    for (const line of q.lines) {
      await db
        .insert(commerceQuoteLines)
        .values({
          id: crypto.randomUUID(),
          orgId: q.orgId,
          quoteId: q.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          lineTotal: String(line.quantity * line.unitPrice),
          sortOrder: 0,
        })
        .onConflictDoNothing()
    }
  }

  // Insert timeline events into DB
  for (const tl of timelines) {
    for (const evt of tl.events) {
      await db
        .insert(commerceTimelineEvents)
        .values({
          orgId: org.id,
          quoteId: tl.quoteId,
          event: evt.event,
          description: evt.description,
          actor: evt.actor,
        })
        .onConflictDoNothing()
    }
  }

  // ── Seed order-centric demo data to DB ──────────────────────────────────

  const vendors = createDemoVendors(org.id)
  const orders = createDemoOrders(org.id)
  const purchaseOrders = createDemoPurchaseOrders(org.id)
  const productionJobs = createDemoProductionJobs(org.id)

  // Insert vendors (as commerce suppliers) into DB
  for (const v of vendors) {
    await db
      .insert(commerceSuppliers)
      .values({
        id: v.id,
        orgId: v.orgId,
        name: v.name,
        email: v.contactEmail,
        leadTimeDays: v.leadTimeDays,
      })
      .onConflictDoNothing()
  }

  // Map Flow order status → commerce enum status
  const orderStatusMap: Record<string, string> = {
    DEPOSIT_REQUIRED: 'created',
    READY_FOR_PROCUREMENT: 'confirmed',
    IN_PRODUCTION: 'fulfillment',
    SHIPPED: 'shipped',
    CLOSED: 'completed',
  }

  // Insert orders into DB
  for (const o of orders) {
    await db
      .insert(commerceOrders)
      .values({
        id: o.id,
        orgId: o.orgId,
        customerId: o.customerId,
        quoteId: o.quoteId,
        ref: `SO-2026-${o.id.slice(-3)}`,
        status: (orderStatusMap[o.status] ?? 'created') as 'created',
        currency: o.currency as 'CAD',
        subtotal: String(o.totalAmount),
        taxTotal: '0',
        total: String(o.totalAmount),
        paymentStatus: o.paymentStatus,
        productionStatus: o.productionStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        notes: o.notes ?? null,
        createdBy: 'demo-seed',
      })
      .onConflictDoNothing()
  }

  // Map Flow PO status → commerce enum status
  const poStatusMap: Record<string, string> = {
    DRAFT: 'draft',
    SENT: 'sent',
    CONFIRMED: 'acknowledged',
    IN_PRODUCTION: 'acknowledged',
    SHIPPED: 'partial_received',
    RECEIVED: 'received',
    CANCELLED: 'cancelled',
  }

  // Insert POs into DB
  for (const po of purchaseOrders) {
    await db
      .insert(commercePurchaseOrders)
      .values({
        id: po.id,
        orgId: po.orgId,
        supplierId: po.vendorId,
        orderId: po.orderId,
        ref: `PO-2026-${po.id.slice(-3)}`,
        status: (poStatusMap[po.status] ?? 'draft') as 'draft',
        total: String(po.totalAmount),
        createdBy: 'demo-seed',
      })
      .onConflictDoNothing()
  }

  // Map Flow production status → flow enum status
  const prodStatusMap: Record<string, string> = {
    IN_PRODUCTION: 'in_production',
    QUALITY_CHECK: 'quality_check',
    READY_TO_SHIP: 'ready_to_ship',
    COMPLETED: 'completed',
  }

  // Insert production jobs into DB
  for (const job of productionJobs) {
    await db
      .insert(flowProductionJobs)
      .values({
        id: job.id,
        orgId: job.orgId,
        orderId: job.orderId,
        status: (prodStatusMap[job.status] ?? 'pending_proof') as 'pending_proof',
        notes: job.proofUrl ? `Proof: ${job.proofUrl}` : null,
      })
      .onConflictDoNothing()
  }

  // Insert demo shipments into DB
  await db
    .insert(flowShipments)
    .values({
      id: 'demo-shipment-001',
      orgId: org.id,
      orderId: 'demo-order-005',
      productionJobId: 'demo-job-003',
      status: 'shipped',
      carrier: 'Purolator',
      trackingNumber: 'PLR-2026-98765',
      shippedAt: new Date('2026-01-10'),
    })
    .onConflictDoNothing()

  // Insert demo payments into DB
  for (const pay of [
    {
      id: 'demo-payment-001',
      orgId: org.id,
      orderId: 'demo-order-002',
      customerId: 'demo-customer-4',
      status: 'paid' as const,
      provider: 'stripe',
      providerRef: 'pi_demo_001',
      amountDue: '12200',
      amountPaid: '3660',
      depositRequired: true,
      depositPercent: '30',
      dueBeforeProduction: true,
    },
    {
      id: 'demo-payment-002',
      orgId: org.id,
      orderId: 'demo-order-005',
      customerId: 'demo-customer-1',
      status: 'paid' as const,
      provider: 'stripe',
      providerRef: 'pi_demo_002',
      amountDue: '600',
      amountPaid: '600',
    },
  ]) {
    await db.insert(flowPayments).values(pay).onConflictDoNothing()
  }

  // Insert demo domain events into DB
  for (const evt of [
    {
      orgId: org.id,
      entityType: 'order', entityId: 'demo-order-003', // entity_id column
      eventType: 'order_created' as const,
      actorId: 'demo-sales',
      payloadJson: { ref: 'SO-2026-003' },
    },
    {
      orgId: org.id,
      entityType: 'order', entityId: 'demo-order-003', // entity_id column
      eventType: 'production_started' as const,
      actorId: 'demo-production',
      payloadJson: { jobId: 'demo-job-001' },
    },
    {
      orgId: org.id,
      entityType: 'order', entityId: 'demo-order-005', // entity_id column
      eventType: 'shipment_created' as const,
      actorId: 'demo-production',
      payloadJson: { shipmentId: 'demo-shipment-001', carrier: 'Purolator' },
    },
  ]) {
    await db.insert(flowDomainEvents).values(evt).onConflictDoNothing()
  }

  logger.info(
    'Flow demo data seeded to database',
    {
      orgs: [org.name, pnOrg.name],
      shopmoicaUsers: users.length,
      shopmoicaCustomers: customers.length,
      shopmoicaQuotes: quotes.length,
      shopmoicaOrders: orders.length,
      shopmoicaVendors: vendors.length,
      shopmoicaPOs: purchaseOrders.length,
      shopmoicaProductionJobs: productionJobs.length,
      promonorthUsers: pnUsers.length,
      promonorthCustomers: pnCustomers.length,
      promonorthQuotes: pnQuotes.length,
      timelines: timelines.length,
    },
  )

  return {
    org, users, customers, quotes, timelines, analytics,
    vendors, orders, purchaseOrders, productionJobs,
    pnOrg, pnUsers, pnCustomers, pnQuotes,
  }
}

if (process.argv[1]?.includes('demoSeed')) {
  seedDemo().catch((err) => logger.error('Demo seed failed', { error: err }))
}
