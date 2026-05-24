/**
 * Orchestrator-api — ITSM store
 *
 * Drizzle-backed persistence for ticket / asset / queue / KB operations
 * surfaced by `routes/itsm.ts`. Every helper is org-scoped — the route
 * layer is responsible for proving `orgId` belongs to the caller before
 * dispatching here.
 *
 * Returns `null` / empty arrays when `DATABASE_URL` is absent so the
 * orchestrator can still boot in DB-less local dev. The route layer
 * blocks unauthenticated `DATABASE_URL`-less calls in production with
 * a 503.
 */
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { getDb } from './db.js'
import {
  computeSlaDueDates,
  DEFAULT_SLA_TARGETS,
  generateTicketNumber,
  isSlaBreached,
  ticketMachine,
  type CreateAssetInput,
  type CreateTicketEventInput,
  type CreateTicketInput,
  type ItsmRole,
  type Priority,
  type TicketStatus,
} from '@nzila/itsm-core'
import { attemptTransition, type TransitionContext } from '@nzila/fsm-core'

export function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export interface TicketRow {
  id: string
  orgId: string
  ticketNumber: string
  type: string
  status: string
  priority: string
  title: string
  description: string | null
  reportedById: string
  assignedToId: string | null
  queueId: string | null
  slaResponseDue: string | null
  slaResolutionDue: string | null
  slaBreached: boolean
  createdAt: Date
  updatedAt: Date
}

export async function createTicket(
  orgId: string,
  reportedById: string,
  input: CreateTicketInput,
): Promise<TicketRow> {
  const { db, schema } = getDb()

  const { responseDue, resolutionDue } = computeSlaDueDates(
    input.priority as Priority,
    DEFAULT_SLA_TARGETS,
  )

  // Per-org daily-ish sequence number. Stable enough for human-readable IDs
  // without a dedicated sequence table; collisions are vanishingly rare and
  // the DB-side `id` (uuid) remains the source of truth.
  const seq = await nextTicketSequence(orgId)
  const ticketNumber = generateTicketNumber(input.type, seq)

  const [row] = await db
    .insert(schema.itsmTickets)
    .values({
      orgId,
      ticketNumber,
      type: input.type,
      priority: input.priority,
      title: input.title,
      description: input.description ?? null,
      reportedById,
      queueId: input.queueId ?? null,
      slaResponseDue: responseDue,
      slaResolutionDue: resolutionDue,
      channel: input.channel ?? 'portal',
      tags: input.tags ?? [],
    })
    .returning()

  return toTicketRow(row)
}

async function nextTicketSequence(orgId: string): Promise<number> {
  const { db, schema } = getDb()
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.itsmTickets)
    .where(eq(schema.itsmTickets.orgId, orgId))
  return Number(row?.c ?? 0) + 1
}

export interface ListTicketsOptions {
  status?: string
  type?: string
  assignedToId?: string
  limit: number
  offset: number
}

export async function listTickets(
  orgId: string,
  options: ListTicketsOptions,
): Promise<{ tickets: TicketRow[]; total: number }> {
  const { db, schema } = getDb()
  const conds = [eq(schema.itsmTickets.orgId, orgId)]
  if (options.status) conds.push(eq(schema.itsmTickets.status, options.status as TicketStatus))
  if (options.type) conds.push(eq(schema.itsmTickets.type, options.type as never))
  if (options.assignedToId)
    conds.push(eq(schema.itsmTickets.assignedToId, options.assignedToId))

  const where = and(...conds)
  const [totalRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.itsmTickets)
    .where(where)

  const rows = await db
    .select()
    .from(schema.itsmTickets)
    .where(where)
    .orderBy(desc(schema.itsmTickets.createdAt))
    .limit(options.limit)
    .offset(options.offset)

  return {
    tickets: rows.map(toTicketRow),
    total: Number(totalRow?.c ?? 0),
  }
}

export async function getTicket(
  orgId: string,
  ticketId: string,
): Promise<{ ticket: TicketRow; events: TicketEventRow[] } | null> {
  const { db, schema } = getDb()
  const [row] = await db
    .select()
    .from(schema.itsmTickets)
    .where(and(eq(schema.itsmTickets.orgId, orgId), eq(schema.itsmTickets.id, ticketId)))
    .limit(1)
  if (!row) return null

  const eventRows = await db
    .select()
    .from(schema.itsmTicketEvents)
    .where(eq(schema.itsmTicketEvents.ticketId, ticketId))
    .orderBy(desc(schema.itsmTicketEvents.createdAt))

  return {
    ticket: toTicketRow(row),
    events: eventRows.map(toTicketEventRow),
  }
}

export interface TransitionInput {
  orgId: string
  ticketId: string
  actorId: string
  role: ItsmRole
  toStatus: TicketStatus
  meta?: Record<string, unknown>
}

export interface TransitionResult {
  ok: boolean
  from: TicketStatus
  to: TicketStatus
  reason?: string
  events?: ReadonlyArray<{ type: string; payload?: Record<string, unknown> }>
}

export async function transitionTicketStatus(
  input: TransitionInput,
): Promise<TransitionResult | null> {
  const { db, schema } = getDb()
  const [ticket] = await db
    .select()
    .from(schema.itsmTickets)
    .where(
      and(
        eq(schema.itsmTickets.orgId, input.orgId),
        eq(schema.itsmTickets.id, input.ticketId),
      ),
    )
    .limit(1)
  if (!ticket) return null

  const ctx: TransitionContext<ItsmRole> = {
    orgId: input.orgId,
    actorId: input.actorId,
    role: input.role,
    meta: input.meta ?? {},
  }

  const result = attemptTransition(
    ticketMachine,
    ticket.status as TicketStatus,
    input.toStatus,
    ctx,
    input.orgId,
    {
      orgId: ticket.orgId,
      status: ticket.status as TicketStatus,
      priority: ticket.priority,
      assignedToId: ticket.assignedToId,
    },
  )

  if (!result.ok) {
    return {
      ok: false,
      from: ticket.status as TicketStatus,
      to: input.toStatus,
      reason: result.reason,
    }
  }

  // Apply transition: update status + write status_changed event in a tx.
  await db.transaction(async (tx) => {
    const patch: Record<string, unknown> = {
      status: input.toStatus,
      updatedAt: new Date(),
    }
    if (input.toStatus === 'resolved') patch.resolvedAt = new Date()
    if (input.toStatus === 'closed') patch.closedAt = new Date()

    await tx
      .update(schema.itsmTickets)
      .set(patch)
      .where(eq(schema.itsmTickets.id, input.ticketId))

    await tx.insert(schema.itsmTicketEvents).values({
      orgId: input.orgId,
      ticketId: input.ticketId,
      eventType: 'status_changed',
      actorId: input.actorId,
      fromValue: ticket.status as string,
      toValue: input.toStatus,
      internal: false,
      payload: { meta: input.meta ?? {} },
    })
  })

  return {
    ok: true,
    from: ticket.status as TicketStatus,
    to: input.toStatus,
    events: result.eventsToEmit,
  }
}

// ── Ticket events ─────────────────────────────────────────────────────────────

export interface TicketEventRow {
  id: string
  ticketId: string
  eventType: string
  actorId: string
  fromValue: string | null
  toValue: string | null
  body: string | null
  internal: boolean
  payload: unknown
  createdAt: Date
}

export async function appendTicketEvent(
  orgId: string,
  input: CreateTicketEventInput,
): Promise<TicketEventRow | null> {
  const { db, schema } = getDb()

  // Verify ticket exists in this org before appending.
  const [ticket] = await db
    .select({ id: schema.itsmTickets.id })
    .from(schema.itsmTickets)
    .where(
      and(eq(schema.itsmTickets.orgId, orgId), eq(schema.itsmTickets.id, input.ticketId)),
    )
    .limit(1)
  if (!ticket) return null

  const [row] = await db
    .insert(schema.itsmTicketEvents)
    .values({
      orgId,
      ticketId: input.ticketId,
      eventType: input.eventType,
      actorId: input.actorId,
      fromValue: input.fromValue ?? null,
      toValue: input.toValue ?? null,
      body: input.body ?? null,
      internal: input.internal ?? false,
      payload: input.payload ?? {},
    })
    .returning()
  return toTicketEventRow(row)
}

// ── SLA evaluation ────────────────────────────────────────────────────────────

export async function evaluateOpenTicketSla(
  orgId: string,
): Promise<{ evaluated: number; breached: number }> {
  const { db, schema } = getDb()
  const open = await db
    .select({
      id: schema.itsmTickets.id,
      status: schema.itsmTickets.status,
      slaResolutionDue: schema.itsmTickets.slaResolutionDue,
      slaBreached: schema.itsmTickets.slaBreached,
    })
    .from(schema.itsmTickets)
    .where(
      and(
        eq(schema.itsmTickets.orgId, orgId),
        sql`${schema.itsmTickets.status} NOT IN ('resolved', 'closed')`,
      ),
    )

  let breached = 0
  const newlyBreachedIds: string[] = []
  for (const t of open) {
    const isBreached = isSlaBreached(t.slaResolutionDue, t.status)
    if (isBreached) {
      breached += 1
      if (!t.slaBreached) newlyBreachedIds.push(t.id)
    }
  }

  if (newlyBreachedIds.length > 0) {
    await db
      .update(schema.itsmTickets)
      .set({ slaBreached: true, updatedAt: new Date() })
      .where(inArray(schema.itsmTickets.id, newlyBreachedIds))

    await db.insert(schema.itsmTicketEvents).values(
      newlyBreachedIds.map((id) => ({
        orgId,
        ticketId: id,
        eventType: 'sla_breached',
        actorId: 'system:orchestrator',
        internal: true,
        payload: { evaluatedAt: new Date().toISOString() },
      })),
    )
  }

  return { evaluated: open.length, breached }
}

// ── Queues / Assets / KB (read paths) ─────────────────────────────────────────

export async function listQueues(orgId: string) {
  const { db, schema } = getDb()
  return db
    .select({
      id: schema.itsmQueues.id,
      name: schema.itsmQueues.name,
      description: schema.itsmQueues.description,
      defaultSlaId: schema.itsmQueues.defaultSlaId,
      active: schema.itsmQueues.active,
    })
    .from(schema.itsmQueues)
    .where(eq(schema.itsmQueues.orgId, orgId))
    .orderBy(desc(schema.itsmQueues.createdAt))
}

export interface ListAssetsOptions {
  type?: string
  lifecycle?: string
}

export async function listAssets(orgId: string, options: ListAssetsOptions = {}) {
  const { db, schema } = getDb()
  const conds = [eq(schema.itsmAssets.orgId, orgId)]
  if (options.type) conds.push(eq(schema.itsmAssets.type, options.type as never))
  if (options.lifecycle)
    conds.push(eq(schema.itsmAssets.lifecycle, options.lifecycle as never))
  return db
    .select()
    .from(schema.itsmAssets)
    .where(and(...conds))
    .orderBy(desc(schema.itsmAssets.createdAt))
}

export async function createAsset(orgId: string, input: CreateAssetInput) {
  const { db, schema } = getDb()
  const [row] = await db
    .insert(schema.itsmAssets)
    .values({
      orgId,
      type: input.type,
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      serialNumber: input.serialNumber ?? null,
      ownerId: input.ownerId ?? null,
      warrantyExpiry: input.warrantyExpiry ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchaseCost: input.purchaseCost ?? null,
      location: input.location ?? null,
      tags: input.tags ?? [],
    })
    .returning()
  return row
}

export interface ListKbOptions {
  query?: string
  category?: string
}

export async function listKbArticles(orgId: string, options: ListKbOptions = {}) {
  const { db, schema } = getDb()
  const conds = [
    eq(schema.itsmKbArticles.orgId, orgId),
    eq(schema.itsmKbArticles.status, 'published'),
  ]
  if (options.category) conds.push(eq(schema.itsmKbArticles.category, options.category))
  if (options.query) conds.push(ilike(schema.itsmKbArticles.title, `%${options.query}%`))
  return db
    .select({
      id: schema.itsmKbArticles.id,
      title: schema.itsmKbArticles.title,
      slug: schema.itsmKbArticles.slug,
      category: schema.itsmKbArticles.category,
      tags: schema.itsmKbArticles.tags,
    })
    .from(schema.itsmKbArticles)
    .where(and(...conds))
    .orderBy(desc(schema.itsmKbArticles.createdAt))
    .limit(50)
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function toTicketRow(row: Record<string, unknown>): TicketRow {
  return {
    id: String(row.id),
    orgId: String(row.orgId),
    ticketNumber: String(row.ticketNumber),
    type: String(row.type),
    status: String(row.status),
    priority: String(row.priority),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    reportedById: String(row.reportedById),
    assignedToId: (row.assignedToId as string | null) ?? null,
    queueId: (row.queueId as string | null) ?? null,
    slaResponseDue: (row.slaResponseDue as string | null) ?? null,
    slaResolutionDue: (row.slaResolutionDue as string | null) ?? null,
    slaBreached: Boolean(row.slaBreached),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  }
}

function toTicketEventRow(row: Record<string, unknown>): TicketEventRow {
  return {
    id: String(row.id),
    ticketId: String(row.ticketId),
    eventType: String(row.eventType),
    actorId: String(row.actorId),
    fromValue: (row.fromValue as string | null) ?? null,
    toValue: (row.toValue as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    internal: Boolean(row.internal),
    payload: row.payload,
    createdAt: row.createdAt as Date,
  }
}
