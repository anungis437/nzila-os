import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { resolveOrgContext } from '@/lib/resolve-org'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  COMMERCIAL_ANALYTICS_EVENTS,
  PlatformEventBus,
  emitSubscriptionStarted,
  emitSubscriptionUpgraded,
} from '@nzila/platform-events'
import { planPriceCad, toCheckoutUrl } from '@/lib/billing-plans'

const planChangeSchema = z.object({
  plan: z.enum(['starter', 'growth', 'pro']),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
  currentPlan: z.enum(['starter', 'growth', 'pro']).optional(),
})

const bus = new PlatformEventBus()

function resolveFlowPriceId(plan: 'starter' | 'growth' | 'pro', interval: 'monthly' | 'annual'): string | null {
  const catalog = {
    starter: {
      monthly: process.env.STRIPE_FLOW_STARTER_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_FLOW_STARTER_ANNUAL_PRICE_ID,
    },
    growth: {
      monthly: process.env.STRIPE_FLOW_GROWTH_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_FLOW_GROWTH_ANNUAL_PRICE_ID,
    },
    pro: {
      monthly: process.env.STRIPE_FLOW_PRO_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_FLOW_PRO_ANNUAL_PRICE_ID,
    },
  }
  return catalog[plan][interval] ?? null
}

export async function POST(request: NextRequest) {
  return withRequestContext(request, () =>
    withSpan('flow.billing.plan.change', { 'http.method': 'POST' }, async () => {
      const authResult = await authenticateUser()
      if (!authResult.ok) return authResult.response

      const body = await request.json().catch(() => null)
      const parsed = planChangeSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Invalid billing request', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        )
      }

      const ctx = await resolveOrgContext()
      const { plan, interval, currentPlan } = parsed.data
      const fallbackCheckoutUrl = toCheckoutUrl({
        baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3007',
        orgId: ctx.orgId,
        plan,
        interval,
      })

      const priceId = resolveFlowPriceId(plan, interval)
      const checkoutUrl = priceId
        ? `${fallbackCheckoutUrl}&priceId=${encodeURIComponent(priceId)}`
        : fallbackCheckoutUrl

      const mrrCad = planPriceCad(plan, interval)
      const metadata = {
        orgId: ctx.orgId,
        actorId: authResult.userId,
        source: COMMERCIAL_ANALYTICS_EVENTS.FLOW_PLAN_CHANGED,
      }

      if (currentPlan && currentPlan !== plan) {
        void bus.emit(
          emitSubscriptionUpgraded(
            {
              userId: authResult.userId,
              orgId: ctx.orgId,
              appId: 'flow',
              fromPlanId: currentPlan,
              toPlanId: plan,
              expansionMrrUsd: mrrCad,
            },
            metadata,
          ),
        )
      } else {
        void bus.emit(
          emitSubscriptionStarted(
            {
              userId: authResult.userId,
              orgId: ctx.orgId,
              appId: 'flow',
              planId: plan,
              billingCycle: interval,
              mrrUsd: mrrCad,
              trialConverted: false,
            },
            metadata,
          ),
        )
      }

      return NextResponse.json({
        ok: true,
        eventName: COMMERCIAL_ANALYTICS_EVENTS.FLOW_PLAN_CHANGED,
        checkoutUrl,
        selectedPlan: plan,
        interval,
      })
    }),
  )
}
