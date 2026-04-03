/**
 * API — /api/subscriptions
 * GET  → current listener subscription status
 * POST → create checkout session or portal session
 *
 * Body for POST:
 *   { action: 'checkout_premium' }
 *   { action: 'checkout_label', creatorId: string }
 *   { action: 'portal' }
 *   { action: 'portal_creator', creatorId: string }
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  getListenerSubscription,
  createListenerPremiumCheckout,
  createLabelPlanCheckout,
  createListenerPortalSession,
  createCreatorPortalSession,
} from '@/lib/actions/subscription-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.subscriptions.status', { 'http.method': 'GET' }, async () => {
      const subscription = await getListenerSubscription()
      return NextResponse.json({ ok: true, data: subscription })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.subscriptions.action', { 'http.method': 'POST' }, async () => {

      const body = await request.json()
      const action = body?.action

      if (!action) {
        return NextResponse.json(
          { ok: false, error: 'action is required' },
          { status: 400 },
        )
      }

      switch (action) {
        case 'checkout_premium': {
          const result = await createListenerPremiumCheckout()
          if (result.error) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
          }
          return NextResponse.json({ ok: true, data: { url: result.url } })
        }

        case 'checkout_label': {
          if (!body.creatorId) {
            return NextResponse.json(
              { ok: false, error: 'creatorId is required for label checkout' },
              { status: 400 },
            )
          }
          const result = await createLabelPlanCheckout(body.creatorId)
          if (result.error) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
          }
          return NextResponse.json({ ok: true, data: { url: result.url } })
        }

        case 'portal': {
          const result = await createListenerPortalSession()
          if (result.error) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
          }
          return NextResponse.json({ ok: true, data: { url: result.url } })
        }

        case 'portal_creator': {
          if (!body.creatorId) {
            return NextResponse.json(
              { ok: false, error: 'creatorId is required for creator portal' },
              { status: 400 },
            )
          }
          const result = await createCreatorPortalSession(body.creatorId)
          if (result.error) {
            return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
          }
          return NextResponse.json({ ok: true, data: { url: result.url } })
        }

        default:
          return NextResponse.json(
            { ok: false, error: `Unknown action: ${action}` },
            { status: 400 },
          )
      }
    }),
  )
}
