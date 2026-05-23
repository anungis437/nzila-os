/**
 * Orchestrator-api — ITSM routes
 *
 * Fastify plugin exposing the ITSM command surface.
 * All routes require:
 *   1. API key (enforced globally in index.ts)
 *   2. org_id in request body / query params (all DB queries are org-scoped)
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
 *   GET    /kb                   — List KB articles (search)
 */
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { attemptTransition } from '@nzila/fsm-core'
import {
  createTicketInputSchema,
  createTicketEventInputSchema,
  ticketMachine,
  computeSlaDueDates,
  isSlaBreached,
  generateTicketNumber,
  DEFAULT_SLA_TARGETS,
  createAssetInputSchema,
} from '@nzila/itsm-core'
import type { TransitionContext } from '@nzila/fsm-core'
import type { ItsmRole, TicketStatus } from '@nzila/itsm-core'

// ── Helpers ───────────────────────────────────────────────────────────────────

function badRequest(reply: FastifyReply, message: string, details?: unknown) {
  return reply.status(400).send({ error: message, details })
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export async function itsmRoutes(app: FastifyInstance) {
  // The handlers below are placeholders for the eventual DB-backed service
  // layer. They return shaped responses, but they DO NOT persist anything
  // and DO NOT read real ticket state. Returning 202/200 in production would
  // silently fool callers into believing tickets were created or transitioned.
  // Fail loudly: 501 Not Implemented in production, warn in dev/staging.
  app.addHook('onRequest', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      req.log.error(
        { url: req.url, method: req.method },
        'orchestrator-api/itsm: route invoked in production but DB layer is not wired',
      )
      return reply.status(501).send({
        error: 'itsm routes are not implemented in production yet',
        url: req.url,
      })
    }
    req.log.warn(
      { url: req.url, method: req.method },
      'orchestrator-api/itsm: stub handler \u2014 no DB persistence',
    )
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

      const input = parse.data

      // Compute SLA due dates from default targets (queue-specific SLA lookup
      // would be added when DB layer is wired)
      const { responseDue, resolutionDue } = computeSlaDueDates(
        input.priority,
        DEFAULT_SLA_TARGETS,
      )

      // Temporary sequence number (in production: DB sequence or Redis counter)
      const seq = Date.now() % 10000
      const ticketNumber = generateTicketNumber(input.type, seq)

      // Placeholder: return accepted shape (DB write wired in service layer)
      return reply.status(202).send({
        ticketNumber,
        status: 'new',
        slaResponseDue: responseDue,
        slaResolutionDue: resolutionDue,
        input,
      })
    },
  )

  // ── GET /itsm/tickets ──────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string; status?: string; type?: string; assignedToId?: string; limit?: string; offset?: string } }>(
    '/tickets',
    async (req, reply) => {
      const { orgId, status, type, assignedToId, limit = '25', offset = '0' } = req.query

      if (!orgId) {
        return reply.status(400).send({ error: 'orgId is required' })
      }

      // Placeholder: filtering described for service-layer wiring
      return reply.send({
        orgId,
        filters: { status, type, assignedToId },
        pagination: { limit: Number(limit), offset: Number(offset) },
        tickets: [],
      })
    },
  )

  // ── GET /itsm/tickets/:id ──────────────────────────────────────────────────
  app.get<{ Params: { id: string }; Querystring: { orgId: string } }>(
    '/tickets/:id',
    async (req, reply) => {
      const { orgId } = req.query
      if (!orgId) return reply.status(400).send({ error: 'orgId is required' })
      return reply.send({ id: req.params.id, orgId, events: [] })
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
  }>(
    '/tickets/:id/status',
    async (req, reply) => {
      const { orgId, actorId, role, toStatus, meta } = req.body ?? {}

      if (!orgId || !actorId || !role || !toStatus) {
        return reply.status(400).send({
          error: 'orgId, actorId, role, and toStatus are required',
        })
      }

      // Fetch ticket — placeholder for DB layer
      const ticket = {
        orgId,
        status: 'new' as const,
        priority: 'p3_medium',
        assignedToId: null,
      }

      const ctx: TransitionContext<ItsmRole> = {
        orgId,
        actorId,
        role,
        meta: meta ?? {},
      }

      const result = attemptTransition(
        ticketMachine,
        ticket.status,
        toStatus as TicketStatus,
        ctx,
        orgId,
        ticket,
      )

      if (!result.ok) {
        return reply.status(422).send({
          error: result.reason,
          from: ticket.status,
          to: toStatus,
        })
      }

      return reply.send({
        ticketId: req.params.id,
        from: ticket.status,
        to: toStatus,
        events: result.eventsToEmit,
      })
    },
  )

  // ── POST /itsm/tickets/:id/events ──────────────────────────────────────────
  app.post<{
    Params: { id: string }
    Body: z.infer<typeof createTicketEventInputSchema>
  }>(
    '/tickets/:id/events',
    async (req, reply) => {
      const parse = createTicketEventInputSchema.safeParse({
        ...req.body,
        ticketId: req.params.id,
      })
      if (!parse.success) {
        return reply.status(400).send({
          error: 'Invalid event input',
          details: parse.error.flatten(),
        })
      }

      return reply.status(202).send({
        accepted: true,
        event: parse.data,
      })
    },
  )

  // ── POST /itsm/sla/check ───────────────────────────────────────────────────
  // Called by cron — evaluates SLA breach for all open tickets in an org
  app.post<{ Body: { orgId: string } }>(
    '/sla/check',
    async (req, reply) => {
      const { orgId } = req.body ?? {}
      if (!orgId) return reply.status(400).send({ error: 'orgId is required' })

      // Placeholder: in production, scan open tickets from DB
      // and call isSlaBreached() for each, then persist sla_breached=true
      // and emit itsm.ticket.sla_breached event
      app.log.info({ orgId }, 'ITSM SLA check triggered')

      return reply.send({
        orgId,
        evaluated: 0,
        breached: 0,
        message: 'SLA check complete',
      })
    },
  )

  // ── GET /itsm/queues ───────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string } }>(
    '/queues',
    async (req, reply) => {
      const { orgId } = req.query
      if (!orgId) return reply.status(400).send({ error: 'orgId is required' })
      return reply.send({ orgId, queues: [] })
    },
  )

  // ── GET /itsm/assets ───────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string; type?: string; lifecycle?: string } }>(
    '/assets',
    async (req, reply) => {
      const { orgId, type, lifecycle } = req.query
      if (!orgId) return reply.status(400).send({ error: 'orgId is required' })
      return reply.send({ orgId, filters: { type, lifecycle }, assets: [] })
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
      return reply.status(202).send({ accepted: true, asset: parse.data })
    },
  )

  // ── GET /itsm/kb ───────────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId: string; q?: string; category?: string } }>(
    '/kb',
    async (req, reply) => {
      const { orgId, q, category } = req.query
      if (!orgId) return reply.status(400).send({ error: 'orgId is required' })
      return reply.send({ orgId, query: q, category, articles: [] })
    },
  )
}
