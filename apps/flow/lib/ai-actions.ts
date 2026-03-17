'use server'

/**
 * AI-Powered Actions — Flow.
 *
 * Smart pricing, product recommendation, and RFP auto-populate
 * via the governed @nzila/ai-sdk layer.
 *
 * Integration points:
 *   1. `runAICompletion`  → Smart pricing suggestions based on quote history
 *   2. `runAIEmbed`       → Product similarity for "similar gift boxes"
 *   3. `runAIExtraction`  → Auto-populate quote from unstructured RFP emails
 *   4. `runPrediction`    → Quote acceptance/conversion prediction
 */
import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { runAICompletion, runAIEmbed, runAIExtraction } from '@/lib/ai-client'
import { runPrediction } from '@/lib/ml-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface PricingSuggestion {
  sku: string
  description: string
  suggestedPrice: number
  confidence: number
  reasoning: string
}

export interface SimilarProduct {
  sku: string
  name: string
  similarity: number
}

export interface RfpExtraction {
  clientName: string | null
  clientEmail: string | null
  items: Array<{ description: string; quantity: number }>
  budget: number | null
  deadline: string | null
  notes: string | null
}

export interface ConversionPrediction {
  probability: number
  factors: Array<{ name: string; impact: 'positive' | 'negative'; weight: number }>
  recommendation: string
}

/* ─── Smart Pricing ─── */

export async function getSmartPricing(opts: {
  tier: string
  boxCount: number
  theme: string
  clientHistory?: string
}): Promise<PricingSuggestion[]> {
  const _ctx = await resolveOrgContext()

  try {
    // Pull recent quote history for context
    const recentQuotes = await platformDb.execute(
      sql`SELECT metadata->>'tier' as tier, metadata->>'total' as total,
          metadata->>'boxCount' as "boxCount", metadata->>'status' as status
      FROM audit_log
      WHERE action = 'quote.created' OR action = 'quote.approved'
      ORDER BY created_at DESC LIMIT 50`,
    )

    const historyContext = JSON.stringify(recentQuotes)

    const prompt = `You are a gift-box pricing advisor for a luxury gift company.
Given this quote request:
- Tier: ${opts.tier}
- Box count: ${opts.boxCount}
- Theme: ${opts.theme}
${opts.clientHistory ? `- Client history: ${opts.clientHistory}` : ''}

Recent quote data: ${historyContext}

Suggest optimal pricing for each line item. Return a JSON array with objects:
{ "sku": string, "description": string, "suggestedPrice": number, "confidence": number (0-1), "reasoning": string }

Consider: tier multipliers, volume discounts, seasonal trends, and client loyalty.`

    const raw = await runAICompletion(prompt, { profile: 'Flow-pricing' })

    try {
      const suggestions = JSON.parse(raw)
      return Array.isArray(suggestions) ? suggestions : []
    } catch {
      logger.warn('AI pricing returned non-JSON', { raw: raw.slice(0, 200) })
      return []
    }
  } catch (error) {
    logger.error('Smart pricing failed', { error })
    return []
  }
}

/* ─── Similar Products ─── */

export async function findSimilarProducts(
  description: string,
  limit: number = 5,
): Promise<SimilarProduct[]> {
  const _ctx = await resolveOrgContext()

  try {
    const embeddings = await runAIEmbed(description, { profile: 'Flow-embed' })

    if (!embeddings?.length) return []

    // In production, this would query a vector index.
    // For now, return a completion-based similarity ranking.
    const prompt = `Given this product description: "${description}"
List the ${limit} most similar gift-box products from a luxury gift catalog.
Return JSON array: [{ "sku": string, "name": string, "similarity": number (0-1) }]`

    const raw = await runAICompletion(prompt, { profile: 'Flow-recommend' })

    try {
      const products = JSON.parse(raw)
      return Array.isArray(products) ? products.slice(0, limit) : []
    } catch {
      return []
    }
  } catch (error) {
    logger.error('Similar products search failed', { error })
    return []
  }
}

/* ─── RFP Auto-Populate ─── */

export async function extractFromRfp(
  rfpText: string,
): Promise<RfpExtraction | null> {
  const ctx = await resolveOrgContext()

  try {
    logger.info('Extracting from RFP', { actorId: ctx.actorId, textLength: rfpText.length })

    const data = await runAIExtraction(rfpText, 'rfp-extraction', {
      profile: 'Flow-extract',
      variables: { format: 'quote-fields' },
    })

    const pack = buildEvidencePackFromAction({
      actionType: 'RFP_EXTRACTION',
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      metadata: { inputLength: rfpText.length },
    })
    await processEvidencePack(pack)

    return {
      clientName: (data.clientName as string) ?? null,
      clientEmail: (data.clientEmail as string) ?? null,
      items: Array.isArray(data.items) ? data.items as RfpExtraction['items'] : [],
      budget: typeof data.budget === 'number' ? data.budget : null,
      deadline: (data.deadline as string) ?? null,
      notes: (data.notes as string) ?? null,
    }
  } catch (error) {
    logger.error('RFP extraction failed', { error })
    return null
  }
}

/* ─── Quote Conversion Prediction ─── */

export async function predictConversion(quoteId: string): Promise<ConversionPrediction | null> {
  const _ctx = await resolveOrgContext()

  try {
    const prediction = await runPrediction({
      model: 'quote-conversion-predictor',
      features: { quoteId, scope: 'platform' },
    })

    if (!prediction) {
      // Fallback to AI-based heuristic
      const [quoteRow] = (await platformDb.execute(
        sql`SELECT metadata FROM audit_log
        WHERE org_id = ${quoteId} AND action = 'quote.created'
        LIMIT 1`,
      )) as unknown as [{ metadata: Record<string, unknown> } | undefined]

      if (!quoteRow) return null

      const prompt = `Analyze this quote and predict conversion likelihood:
${JSON.stringify(quoteRow.metadata)}
Return JSON: { "probability": number (0-1), "factors": [{ "name": string, "impact": "positive"|"negative", "weight": number }], "recommendation": string }`

      const raw = await runAICompletion(prompt, { profile: 'Flow-predict' })

      try {
        return JSON.parse(raw) as ConversionPrediction
      } catch {
        return null
      }
    }

    return prediction as unknown as ConversionPrediction
  } catch (error) {
    logger.error('Conversion prediction failed', { error, quoteId })
    return null
  }
}
