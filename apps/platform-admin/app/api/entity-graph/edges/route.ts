/**
 * Platform Admin — Entity Graph Edges API
 *
 *   GET  /api/entity-graph/edges  — list all edges for the active tenant
 *   POST /api/entity-graph/edges  — upsert an edge
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '../../../../lib/org-scope-guard'
import {
  createEntityEdgeSchema,
  insertEdge,
  listAllEdges,
} from '../../../../lib/entity-graph-store'
import { recordItsmAudit } from '../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const edges = await listAllEdges(ctx.orgId)
    return NextResponse.json({ ok: true, data: edges })
  })
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required',
        },
      },
      { status: 400 },
    )
  }

  return withOrgWrite(request, async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = createEntityEdgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid entity edge payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const edge = await insertEdge(ctx.orgId, parsed.data)
      await recordItsmAudit({
        orgId: ctx.orgId,
        actorId: ctx.actorId,
        actorRole: ctx.orgRole,
        actionType: 'platform.entity_edge.upserted',
        resourceType: 'platform_entity_edge',
        resourceId: edge.id,
        input: parsed.data,
        outcome: {
          id: edge.id,
          relationshipType: edge.relationshipType,
        },
      })
      return NextResponse.json({ ok: true, data: edge }, { status: 201 })
    } catch (err) {
      // FK or referential errors (e.g. missing source/target node) bubble up
      // as PG errors via postgres-js.
      const message =
        err instanceof Error ? err.message : 'Failed to insert entity edge'
      return NextResponse.json(
        { ok: false, error: { code: 'INSERT_FAILED', message } },
        { status: 400 },
      )
    }
  })
}
