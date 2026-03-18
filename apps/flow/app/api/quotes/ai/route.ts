import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  getSmartPricing,
  findSimilarProducts,
  extractFromRfp,
  predictConversion,
} from '@/lib/ai-actions'

/**
 * POST /api/quotes/ai
 *
 * AI-powered quote assistance. Dispatches to different functions based on `action`:
 *   - "smart-pricing"   → getSmartPricing
 *   - "similar-products" → findSimilarProducts
 *   - "extract-rfp"     → extractFromRfp
 *   - "predict"         → predictConversion
 */
export async function POST(request: NextRequest) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.ai', { 'http.method': 'POST' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    const body = await request.json()
  const action = body.action as string

  switch (action) {
    case 'smart-pricing': {
      const { tier, boxCount, theme, clientHistory } = body
      if (!tier || !boxCount) {
        return NextResponse.json({ error: 'tier and boxCount are required' }, { status: 400 })
      }
      const suggestions = await getSmartPricing({ tier, boxCount, theme: theme ?? '', clientHistory })
      return NextResponse.json({ suggestions })
    }

    case 'similar-products': {
      const { description, limit } = body
      if (!description) {
        return NextResponse.json({ error: 'description is required' }, { status: 400 })
      }
      const products = await findSimilarProducts(description, limit ?? 5)
      return NextResponse.json({ products })
    }

    case 'extract-rfp': {
      const { rfpText } = body
      if (!rfpText || typeof rfpText !== 'string') {
        return NextResponse.json({ error: 'rfpText is required' }, { status: 400 })
      }
      if (rfpText.length > 50000) {
        return NextResponse.json({ error: 'RFP text too long (max 50,000 chars)' }, { status: 400 })
      }
      const extraction = await extractFromRfp(rfpText)
      return NextResponse.json({ extraction })
    }

    case 'predict': {
      const { quoteId } = body
      if (!quoteId) {
        return NextResponse.json({ error: 'quoteId is required' }, { status: 400 })
      }
      const prediction = await predictConversion(quoteId)
      return NextResponse.json({ prediction })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
    }),
  )
}
