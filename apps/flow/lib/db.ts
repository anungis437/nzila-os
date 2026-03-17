/**
 * Database helpers for Flow app.
 *
 * Provides Drizzle-backed repositories querying the NzilaOS commerce schema
 * (commerceQuotes, commerceQuoteLines, commerceCustomers).
 * Org-aware: accepts OrgCommerceSettings for prefix, currency, and validity.
 */
import { db, commerceQuotes, commerceQuoteLines, commerceCustomers } from '@nzila/db'
import { eq, sql, desc } from 'drizzle-orm'
import type { OrgCommerceSettings } from '@nzila/platform-commerce-org/types'
import { SHOPMOICA_SETTINGS } from '@nzila/platform-commerce-org/defaults'

// ── App-facing types ───────────────────────────────────────────────────────

export interface QuoteLine {
  id: string
  description: string
  sku: string
  quantity: number
  unitCost: number
  lineTotal: number
  displayOrder: number
}

export interface Quote {
  id: string
  orgId: string
  reference: string
  status: string
  title: string
  tier: string
  customerId: string
  boxCount: number
  theme: string | null
  notes: string | null
  validUntilDays: number
  lines: QuoteLine[]
  subtotal: number
  gst: number
  qst: number
  total: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateQuoteInput {
  orgId: string
  title?: string
  tier: string
  customerId: string
  boxCount?: number
  theme?: string
  notes?: string
  validUntilDays?: number
  lines?: QuoteLine[]
  subtotal?: number
  gst?: number
  qst?: number
  total?: number
  createdBy?: string
  settings?: OrgCommerceSettings
}

export interface CustomerAddress {
  line1?: string
  line2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

// ── Quote Repository (Drizzle-backed) ──────────────────────────────────────

export interface QuoteRepository {
  create(input: CreateQuoteInput): Promise<Quote>
  findById(id: string): Promise<Quote | null>
  findAll(orgId: string): Promise<Quote[]>
  update(id: string, patch: Partial<Quote>): Promise<Quote>
}

async function generateRef(settings?: OrgCommerceSettings): Promise<string> {
  const prefix = settings?.quotePrefix ?? SHOPMOICA_SETTINGS.quotePrefix
  const year = new Date().getFullYear()
  const fullPrefix = `${prefix}-${year}-`
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commerceQuotes)
  const n = (result?.count ?? 0) + 1
  return `${fullPrefix}${String(n).padStart(3, '0')}`
}

async function loadLines(quoteId: string): Promise<QuoteLine[]> {
  const rows = await db
    .select()
    .from(commerceQuoteLines)
    .where(eq(commerceQuoteLines.quoteId, quoteId))
    .orderBy(commerceQuoteLines.sortOrder)

  return rows.map((r) => ({
    id: r.id,
    description: r.description ?? '',
    sku: r.sku ?? '',
    quantity: Number(r.quantity),
    unitCost: Number(r.unitPrice),
    lineTotal: Number(r.lineTotal),
    displayOrder: r.sortOrder ?? 0,
  }))
}

function mapQuoteRow(
  row: typeof commerceQuotes.$inferSelect,
  lines: QuoteLine[],
): Quote {
  return {
    id: row.id,
    orgId: row.orgId,
    reference: row.ref ?? '',
    status: row.status ?? 'draft',
    title: (row.metadata as Record<string, unknown>)?.title as string ?? '',
    tier: row.pricingTier ?? 'STANDARD',
    customerId: row.customerId ?? '',
    boxCount: (row.metadata as Record<string, unknown>)?.boxCount as number ?? 1,
    theme: (row.metadata as Record<string, unknown>)?.theme as string ?? null,
    notes: row.notes ?? null,
    validUntilDays: row.validUntil
      ? Math.ceil((new Date(row.validUntil).getTime() - Date.now()) / 86_400_000)
      : SHOPMOICA_SETTINGS.quoteValidityDays,
    lines,
    subtotal: Number(row.subtotal ?? 0),
    gst: Number((row.metadata as Record<string, unknown>)?.gst ?? 0),
    qst: Number((row.metadata as Record<string, unknown>)?.qst ?? 0),
    total: Number(row.total ?? 0),
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    createdBy: row.createdBy ?? 'system',
  }
}

export const quoteRepo: QuoteRepository = {
  async create(input) {
    const id = crypto.randomUUID()
    const settings = input.settings
    const ref = await generateRef(settings)
    const validityDays = input.validUntilDays ?? settings?.quoteValidityDays ?? SHOPMOICA_SETTINGS.quoteValidityDays
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + validityDays)

    const [row] = await db
      .insert(commerceQuotes)
      .values({
        id,
        orgId: input.orgId,
        ref,
        status: 'draft',
        pricingTier: input.tier?.toLowerCase() as 'budget' | 'standard' | 'premium',
        customerId: input.customerId,
        currency: settings?.currency ?? SHOPMOICA_SETTINGS.currency,
        subtotal: String(input.subtotal ?? 0),
        taxTotal: String((input.gst ?? 0) + (input.qst ?? 0)),
        total: String(input.total ?? 0),
        validUntil,
        notes: input.notes ?? null,
        metadata: {
          title: input.title ?? '',
          boxCount: input.boxCount ?? 1,
          theme: input.theme ?? null,
          gst: input.gst ?? 0,
          qst: input.qst ?? 0,
        },
        createdBy: input.createdBy ?? 'system',
      })
      .returning()

    // Insert lines
    if (input.lines && input.lines.length > 0) {
      await db.insert(commerceQuoteLines).values(
        input.lines.map((l) => ({
          id: l.id || crypto.randomUUID(),
          orgId: input.orgId,
          quoteId: id,
          description: l.description,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: String(l.unitCost),
          lineTotal: String(l.lineTotal),
          sortOrder: l.displayOrder,
        })),
      )
    }

    return mapQuoteRow(row, input.lines ?? [])
  },

  async findById(id) {
    const [row] = await db
      .select()
      .from(commerceQuotes)
      .where(eq(commerceQuotes.id, id))
      .limit(1)

    if (!row) return null
    const lines = await loadLines(id)
    return mapQuoteRow(row, lines)
  },

  async findAll(orgId) {
    const rows = await db
      .select()
      .from(commerceQuotes)
      .where(eq(commerceQuotes.orgId, orgId))
      .orderBy(desc(commerceQuotes.createdAt))

    return Promise.all(
      rows.map(async (row) => {
        const lines = await loadLines(row.id)
        return mapQuoteRow(row, lines)
      }),
    )
  },

  async update(id, patch) {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.status) updates.status = patch.status.toLowerCase()
    if (patch.title) updates.title = patch.title
    if (patch.notes !== undefined) updates.notes = patch.notes
    if (patch.subtotal !== undefined) updates.subtotal = String(patch.subtotal)
    if (patch.total !== undefined) updates.total = String(patch.total)

    const [row] = await db
      .update(commerceQuotes)
      .set(updates)
      .where(eq(commerceQuotes.id, id))
      .returning()

    if (!row) throw new Error(`Quote ${id} not found`)
    const lines = await loadLines(id)
    return mapQuoteRow(row, lines)
  },
}

// ── Customer Repository (Drizzle-backed) ───────────────────────────────────

export interface CustomerRecord {
  id: string
  orgId: string
  name: string
  email: string | null
  phone: string | null
  address: CustomerAddress | null
  zohoContactId: string | null
  createdAt: string
}

function mapCustomerRow(row: typeof commerceCustomers.$inferSelect): CustomerRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address as CustomerAddress | null,
    zohoContactId: (row.metadata as Record<string, unknown>)?.zohoContactId as string ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }
}

export const customerRepo = {
  async findByEmail(email: string): Promise<CustomerRecord | null> {
    const [row] = await db
      .select()
      .from(commerceCustomers)
      .where(eq(commerceCustomers.email, email))
      .limit(1)
    return row ? mapCustomerRow(row) : null
  },

  async findById(id: string): Promise<CustomerRecord | null> {
    const [row] = await db
      .select()
      .from(commerceCustomers)
      .where(eq(commerceCustomers.id, id))
      .limit(1)
    return row ? mapCustomerRow(row) : null
  },

  async findAll(): Promise<CustomerRecord[]> {
    const rows = await db.select().from(commerceCustomers)
    return rows.map(mapCustomerRow)
  },

  async create(data: Omit<CustomerRecord, 'id' | 'createdAt'>): Promise<CustomerRecord> {
    const id = crypto.randomUUID()
    const [row] = await db
      .insert(commerceCustomers)
      .values({
        id,
        orgId: data.orgId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        metadata: data.zohoContactId ? { zohoContactId: data.zohoContactId } : {},
      })
      .returning()
    return mapCustomerRow(row)
  },
}
