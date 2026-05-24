/**
 * Orchestrator-api — ITSM routes
 *
 * Fastify plugin exposing the ITSM command surface, persisted via
 * `itsm-store.ts` (Drizzle + Postgres). All routes are org-scoped — the
 * caller must supply `orgId` (body or query) and the global API-key guard
 * enforces tenant ownership upstream.
 *
 * Route surface (prefix: /itsm)
 *   POST   /tickets              — Create ticket
 *   GET    /tickets              — List tickets (org-scoped, filterable)
 *   GET    /tickets/:id          — Get single ticket with events
 *   PATCH  /tickets/:id/status   — FSM transition (uses @nzila/fsm-core)
 *   POST   /tickets/:id/events   — Append event (note, attachment, etc.)
 *   POST   /sla/check            — Evaluate SLA breach for all open tickets (cron)
 *   GET    /queues               — List queues for org
 *   GET    /assets               — List CMDB assets
 *   POST   /assets               — Register asset
 *   GET    /kb                   — List published KB articles (search)
 *
 * When `DATABASE_URL` is unset the route layer returns 503 in production
 * and a warning + empty payload in development. There are no fake-shaped
 * 202 responses any more.
 */
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createTicketInputSchema,
  createTicketEventInputSchema,
  createAssetInputSchema,
} from '@nzila/itsm-core'
import type { ItsmRole, TicketStatus } from '@nzila/itsm-core'
import {
  appendTicketEvent,
  createAsset,
  createTicket,
  evaluateOpenTicketSla,
  getTicket,
  isDbAvailable,
  listAssets,
  listKbArticles,
  listQueues,
  listTickets,
  transitionTicketStatus,
} from '../itsm-store.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function badRequest(reply: FastifyReply, message: string, details?: unknown) {
  return reply.status(400).send({ error: message, details })
}

function dbUnavailable(reply: FastifyReply) {
  return reply.status(503).send({
    error: 'itsm persistence unavailable',
    detail: 'DATABASE_URL is not configured on this orchestrator instance',
  })
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export async function itsmRoutes(app: FastifyInstance) {
  // Guard: if the orchestrator was started without a DB, refuse ITSM writes
  // in production. In dev/staging we let calls through to `dbUnavailable()`
  // so callers get an honest 503 instead of a silent 200.
  app.addHook('onRequest', async (req, reply) => {
    if (!isDbAvailable()) {
      req.log.warn(
        { url: req.url, method: req.method },
        'orchestrator-api/itsm: DATABASE_URL not set — returning 503',
      )
      return dbUnavailable(reply)
    }
  })

  // ── POST /itsm/tickets ─────────────────────────────────────────────────────
  app.post<{ Body: z.infer<typeof createTicketInputSchema> }>(
    '/tickets',
    async (req, reply) => {
      const parse = createTicketInputSchema.safeParse(req.body)
      if (!parse.success) {
        return reply.status(400).send({
          error: 'Invalid ticket input',
          details: parse.error.flatten(),
        })
      }

      try {
        const ticket = await createTicket(
          parse.data.orgId,
          parse.data.reportedById,
          parse.data,
        )
        return reply.status(201).send(ticket)
      } catch (err) {
        req.log.error({ err }, 'createTicket failed')
        return reply.status(500).send({ error: 'createTicket failed' })
      }
    },
  )

  // ── GET /itsm/tickets ──────────────────────────────────────────────────────
  app.get<{
    Querystring: {
      orgId: string
      status?: string
      type?: string
      assignedToId?: string
      limit?: string
      offset?: string
    }
  }>('/tickets', async (req, reply) => {
    const { orgId, status, type, assignedToId, limit = '25', offset = '0' } = req.query
    if (!orgId) return badRequest(reply, 'orgId is required')

    const lim = Math.min(Math.max(Number(limit) || 25, 1), 100)
    const off = Math.max(Number(offset) || 0, 0)

    try {
      const { tickets, total } = await listTickets(orgId, {
        status,
        type,
        assignedToId,
        limit: lim,
        offset: off,
      })
      return reply.send({
        orgId,
        filters: { status, type, assignedToId },
        pagination: { limit: lim, offset: off, total },
        tickets,
      })
    } catch (err) {
      req.log.error({ err }, 'listTickets failed')
      return reply.status(500).send({ error: 'listTickets failed' })
    }
  })

  // ── GET /itsm/tickets/:id ──────────────────────────────────────────────────
  app.get<{ Params: { id: string }; Querystring: { orgId: string } }>(
    '/tickets/:id',
    async (req, reply) => {
      const { orgId } = req.query
      if (!orgId) return badRequest(reply, 'orgId is required')

      try {
        const result = await getTicket(orgId, req.params.id)
        if (!result) return reply.status(404).send({ error: 'ticket not found' })
        return reply.send({ ticket: result.ticket, events: result.events })
      } catch (err) {
        req.log.error({ err }, 'getTicket failed')
        return reply.status(500).send({ error: 'getTicket failed' })
      }
    },
  )

  // ── PATCH /itsm/tickets/:id/status ────────────────────────────────────────
  app.patch<{
    Params: { id: string }
    Body: {
      orgId: string
      actorId: string
      role: ItsmRole
      toStatus: string
      meta?: Record<string, unknown>
    }
  }>('/tickets/:id/status', async (req, reply) => {
    const { orgId, actorId, role, toStatus, meta } = req.body ?? {}

    if (!orgId || !actorId || !role || !toStatus) {
      return badRequest(
        reply,
        'orgId, actorId, role, and toStatus are required',
      )
    }

    try {
      const result = await transitionTicketStatus({
        orgId,
        ticketId: req.params.id,
        actorId,
        role,
        toStatus: toStatus as TicketStatus,
        meta,
      })
      if (!result) return reply.status(404).send({ error: 'ticket not found' })
      if (!result.ok) {
        return reply.status(422).send({
          error: result.reason,
          from: result.from,
          to: result.to,
        })
      }
      return reply.send({
        ticketId: req.params.id,
        from: result.from,
        to: result.to,
        events: result.events,
      })
    } catch (err) {
      req.log.error({ err }, 'transitionTicketStatus failed')
      return reply.status(500).send({ error: 'transitionTicketStatus failed' })
    }
  })

  // ── POST /itsm/tickets/:id/events ──────────────────────────────────────────
  app.post<{
    Params: { id: string }
    Body: z.infer<typeof createTicketEventInputSchema>
  }>('/tickets/:id/events', async (req, reply) => {
    const parse = createTicketEventInputSchema.safeParse({
      ...(req.body ?? {}),
      ticketId: req.params.id,
    })
    if (!parse.success) {
      return reply.status(400).send({
        error: 'Invalid event input',
        details: parse.error.flatten(),
      })
    }

    try {
      const event = await appendTicketEvent(parse.data.orgId, parse.data)
      if (!event) return reply.status(404).send({ error: 'ticket not found' })
      return reply.status(201).send(event)
    } catch (err) {
      req.log.error({ err }, 'appendTicketEvent failed')
      return reply.status(500).send({ error: 'appendTicketEvent failed' })
    }
  })

  // ── POST /itsm/sla/check ───────────────────────────────────────────────────
  // Called by cron — evaluates SLA breach for all open tickets in an org and
  // flips `sla_breached=true` + writes an internal `sla_breached` event for
  // any tickets that have just crossed the threshold.
  app.post<{ Body: { orgId: string } }>('/sla/check', async (req, reply) => {
    const { orgId } = req.body ?? {}
    if (!orgId) return badRequest(reply, 'orgId is required')

    try {
      const { evaluated, breached } = await evaluateOpenTicketSla(orgId)
      app.log.info({ orgId, evaluated, breached }, 'ITSM SLA check complete')
      return reply.send({ orgId, evaluated, breached })
    } catch (err) {
      req.log.error({ err }, 'evaluateOpenTicketSla failed')
      return reply.status(500).send({ error: 'evaluateOpenTicketSla failed' })
    }
  })

  // ── GET /itsm/queues ───────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string } }>('/queues', async (req, reply) => {
    const { orgId } = req.query
    if (!orgId) return badRequest(reply, 'orgId is required')
    try {
      const queues = await listQueues(orgId)
      return reply.send({ orgId, queues })
    } catch (err) {
      req.log.error({ err }, 'listQueues failed')
      return reply.status(500).send({ error: 'listQueues failed' })
    }
  })

  // ── GET /itsm/assets ───────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string; type?: string; lifecycle?: string } }>(
    '/assets',
    async (req, reply) => {
      const { orgId, type, lifecycle } = req.query
      if (!orgId) return badRequest(reply, 'orgId is required')
      try {
        const assets = await listAssets(orgId, { type, lifecycle })
        return reply.send({ orgId, filters: { type, lifecycle }, assets })
      } catch (err) {
        req.log.error({ err }, 'listAssets failed')
        return reply.status(500).send({ error: 'listAssets failed' })
      }
    },
  )

  // ── POST /itsm/assets ──────────────────────────────────────────────────────
  app.post<{ Body: z.infer<typeof createAssetInputSchema> }>(
    '/assets',
    async (req, reply) => {
      const parse = createAssetInputSchema.safeParse(req.body)
      if (!parse.success) {
        return reply.status(400).send({
          error: 'Invalid asset input',
          details: parse.error.flatten(),
        })
      }
      try {
        const asset = await createAsset(parse.data.orgId, parse.data)
        return reply.status(201).send(asset)
      } catch (err) {
        req.log.error({ err }, 'createAsset failed')
        return reply.status(500).send({ error: 'createAsset failed' })
      }
    },
  )

  // ── GET /itsm/kb ───────────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string; q?: string; category?: string } }>(
    '/kb',
    async (req, reply) => {
      const { orgId, q, category } = req.query
      if (!orgId) return badRequest(reply, 'orgId is required')
      try {
        const articles = await listKbArticles(orgId, { query: q, category })
        return reply.send({ orgId, query: q, category, articles })
      } catch (err) {
        req.log.error({ err }, 'listKbArticles failed')
        return reply.status(500).send({ error: 'listKbArticles failed' })
      }
    },
  )
}
