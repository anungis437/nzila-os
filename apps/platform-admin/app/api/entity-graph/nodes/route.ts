/**
 * Platform Admin — Entity Graph Nodes API
 *
 *   GET  /api/entity-graph/nodes  — list all nodes for active org-tenant
 *   POST /api/entity-graph/nodes  — upsert a node (idempotent on the unique
 *                                    (tenant, entityType, entityId) key)
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '../../../../lib/org-scope-guard'
import {
  createEntityNodeSchema,
  insertNode,
  listAllNodes,
} from '../../../../lib/entity-graph-store'
import { recordItsmAudit } from '../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const nodes = await listAllNodes(ctx.orgId)
    return NextResponse.json({ ok: true, data: nodes })
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
    const parsed = createEntityNodeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid entity node payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const node = await insertNode(ctx.orgId, parsed.data)
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'platform.entity_node.upserted',
      resourceType: 'platform_entity_node',
      resourceId: `${node.entityType}:${node.entityId}`,
      input: parsed.data,
      outcome: {
        entityType: node.entityType,
        entityId: node.entityId,
        canonicalName: node.canonicalName,
      },
    })
    return NextResponse.json({ ok: true, data: node }, { status: 201 })
  })
}
