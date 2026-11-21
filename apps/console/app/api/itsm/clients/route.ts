import { createItsmClient } from '@/lib/services/itsm-client-service'
import { requirePlatformRole } from '@/lib/api-guards'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getExecutiveOrgId } from '@/lib/executive-os'
import { withSpan } from '@nzila/os-core/telemetry'

const CreateClientSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  product: z.string().optional(),
  onboardingStage: z.string().optional(),
  contractValue: z.string().optional(),
  renewalDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: Request) {
  return withSpan('api.console.itsm.clients.create', { 'http.method': 'POST' }, async () => {
    const access = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
    if (!access.ok) return access.response
    const { userId } = access

    const orgId = await getExecutiveOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await createItsmClient(orgId, userId, parsed.data)
    return NextResponse.json(result.body, { status: result.status })
  })
}
