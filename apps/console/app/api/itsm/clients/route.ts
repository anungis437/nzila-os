// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { opsClients } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { createLogger, withSpan } from '@nzila/os-core/telemetry'

const logger = createLogger('console.itsm.clients')

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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getExecutiveOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const parsed = CreateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const companyName = parsed.data.companyName.trim()
    const contactName = parsed.data.contactName?.trim() || null
    const contactEmail = parsed.data.contactEmail?.trim() || null
    const product = parsed.data.product?.trim() || 'other'
    const onboardingStage = parsed.data.onboardingStage?.trim() || 'prospect'
    const contractValue = parsed.data.contractValue?.trim() || null
    const renewalDate = parsed.data.renewalDate?.trim() || null
    const notes = parsed.data.notes?.trim() || null

    try {
      const created = await platformDb
        .insert(opsClients)
        .values({
          orgId,
          companyName,
          contactName,
          contactEmail,
          product,
          onboardingStage: onboardingStage as 'prospect' | 'contract_signed' | 'tenant_created' | 'kickoff_booked' | 'training_complete' | 'live' | 'churned',
          health: 'healthy',
          contractValue,
          renewalDate,
          notes,
          accountOwnerId: userId,
        })
        .returning({ id: opsClients.id })
        .then((rows) => rows[0] ?? null)

      if (!created) {
        return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
      }

      return NextResponse.json({ id: created.id }, { status: 201 })
    } catch (error) {
      logger.error('itsm.client.create.failed', {
        orgId,
        userId,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
    }
  })
}
