import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { withOrgScope } from '@/lib/api-guards'
import { platformDb } from '@nzila/db/platform'

const TermsAcceptanceSchema = z.object({
  agreementVersion: z.string().min(1),
})

export async function GET(request: Request) {
  return withOrgScope(request, async (ctx) => {
    const rows = await platformDb.execute(sql`
      SELECT actor_id as "actorId", created_at as "acceptedAt", metadata
      FROM audit_log
      WHERE org_id = ${ctx.orgId}
        AND action = 'rights.terms.accepted'
      ORDER BY created_at DESC
      LIMIT 25
    `) as Array<{ actorId: string; acceptedAt: string; metadata: Record<string, unknown> | null }>

    return NextResponse.json({ ok: true, data: rows })
  })
}

export async function POST(request: Request) {
  return withOrgScope(request, async (ctx) => {
    const body = await request.json().catch(() => null)
    const parsed = TermsAcceptanceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid terms payload' }, { status: 400 })
    }

    await platformDb.execute(sql`
      INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES (
        'rights.terms.accepted',
        ${ctx.userId},
        'rights_terms',
        ${parsed.data.agreementVersion},
        ${ctx.orgId},
        ${JSON.stringify({ agreementVersion: parsed.data.agreementVersion, acceptedAt: new Date().toISOString() })}::jsonb
      )
    `)

    return NextResponse.json({ ok: true })
  })
}
