import {
  createOrganizationSubscription,
  listOrganizationSubscriptions,
} from '@/lib/services/stripe-billing-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/subscriptions — Create a Stripe Subscription
 *
 * Creates a Subscription with payment_behavior='default_incomplete'.
 * Returns the clientSecret for the frontend <PaymentElement> to confirm.
 *
 * GET /api/stripe/subscriptions?orgId=... — List subscriptions for an entity
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'

import { createLogger } from '@nzila/os-core'

const logger = createLogger('stripe:subscriptions')

const CreateSubscriptionSchema = z.object({
  orgId: z.guid(),
  ventureId: z.string().optional(),
  customerId: z.string().min(1),
  priceId: z.string().min(1),
  trialDays: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreateSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const input = parsed.data

  const orgAccess = await requireOrgAccess(input.orgId, {
    minRole: 'org_secretary',
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  const result = await createOrganizationSubscription(input, auth)
  return NextResponse.json(result.body, { status: result.status })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
  }

  const orgAccess = await requireOrgAccess(orgId, {
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  try {
    const subs = await listOrganizationSubscriptions(orgId)

    return NextResponse.json({ subscriptions: subs })
  } catch (err) {
    logger.error(
      '[stripe/subscriptions] Error fetching subscriptions:',
      err instanceof Error ? err : { detail: err },
    )
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
