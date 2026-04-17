import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { replayDlqEntry } from '@/lib/integrations-runtime-store'
import { recordAuditEvent } from '@/lib/audit-db'

const ReplaySchema = z.object({
  orgId: z.string().uuid(),
  entryId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.dlq.replay', {}, async () => {
      const parsed = ReplaySchema.safeParse(await req.json())
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }

      const { orgId, entryId } = parsed.data
      const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
      if (!access.ok) return access.response

      const result = await replayDlqEntry({
        orgId,
        entryId,
        actorUserId: access.context.userId,
      })

      await recordAuditEvent({
        orgId,
        targetType: 'integration_dlq_entry',
        targetId: entryId,
        action: result.replayed ? 'integration.dlq.replay' : 'integration.dlq.replay_failed',
        actorClerkUserId: access.context.userId,
        afterJson: result,
      })

      return NextResponse.json(result, { status: result.replayed ? 200 : 409 })
    }),
  )
}
