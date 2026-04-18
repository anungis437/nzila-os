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
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed, runAIEmbedDetailed, runAIExtractionDetailed } from '@/lib/ai-client'
import { runPredictionDetailed } from '@/lib/ml-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export type PricingSuggestion = CanonicalAiOutput<{
  sku: string
  description: string
  suggestedPrice: number
  confidence: number
  reasoning: string
}>

export type SimilarProduct = CanonicalAiOutput<{
  sku: string
  name: string
  similarity: number
}>

export type RfpExtraction = CanonicalAiOutput<{
  clientName: string | null
  clientEmail: string | null
  items: Array<{ description: string; quantity: number }>
  budget: number | null
  deadline: string | null
  notes: string | null
}>

export type ConversionPrediction = CanonicalAiOutput<{
  probability: number
  factors: Array<{ name: string; impact: 'positive' | 'negative'; weight: number }>
  recommendation: string
}>

/* ─── Smart Pricing ─── */

export async function getSmartPricing(opts: {
  tier: string
  boxCount: number
  theme: string
  clientHistory?: string
}): Promise<PricingSuggestion[]> {
  const ctx = await resolveOrgContext()

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

    const { content: raw, execution } = await runAICompletionDetailed(prompt, {
      orgId: ctx.orgId,
      profile: 'Flow-pricing',
    })

    try {
      const suggestions = JSON.parse(raw)
      if (!Array.isArray(suggestions)) return []

      return suggestions.map((suggestion) => {
        const confidence = typeof suggestion?.confidence === 'number' ? suggestion.confidence : 0.65
        return buildCanonicalAiOutput({
          payload: {
            sku: typeof suggestion?.sku === 'string' ? suggestion.sku : 'unknown',
            description: typeof suggestion?.description === 'string' ? suggestion.description : '',
            suggestedPrice: typeof suggestion?.suggestedPrice === 'number' ? suggestion.suggestedPrice : 0,
            confidence,
            reasoning: typeof suggestion?.reasoning === 'string' ? suggestion.reasoning : '',
          },
          appKey: 'flow',
          orgId: ctx.orgId,
          execution,
          confidenceScore: confidence,
          evidenceRefs: ['audit_log:quote.created', 'audit_log:quote.approved', 'ai-profile:Flow-pricing'],
          domain: 'commerce',
        })
      })
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
  const ctx = await resolveOrgContext()

  try {
    const embeddingResult = await runAIEmbedDetailed(description, {
      orgId: ctx.orgId,
      profile: 'Flow-embed',
    })
    const embeddings = embeddingResult.embeddings

    if (!embeddings?.length) return []

    // In production, this would query a vector index.
    // For now, return a completion-based similarity ranking.
    const prompt = `Given this product description: "${description}"
List the ${limit} most similar gift-box products from a luxury gift catalog.
Return JSON array: [{ "sku": string, "name": string, "similarity": number (0-1) }]`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, {
      orgId: ctx.orgId,
      profile: 'Flow-recommend',
    })

    try {
      const products = JSON.parse(raw)
      if (!Array.isArray(products)) return []

      return products.slice(0, limit).map((product) => {
        const similarity = typeof product?.similarity === 'number' ? product.similarity : 0.5
        return buildCanonicalAiOutput({
          payload: {
            sku: typeof product?.sku === 'string' ? product.sku : 'unknown',
            name: typeof product?.name === 'string' ? product.name : '',
            similarity,
          },
          appKey: 'flow',
          orgId: ctx.orgId,
          execution,
          confidenceScore: similarity,
          evidenceRefs: ['embedding:Flow-embed', 'ai-profile:Flow-recommend'],
          domain: 'commerce',
        })
      })
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

    const { data, execution } = await runAIExtractionDetailed(rfpText, 'rfp-extraction', {
      orgId: ctx.orgId,
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

    return buildCanonicalAiOutput({
      payload: {
        clientName: (data.clientName as string) ?? null,
        clientEmail: (data.clientEmail as string) ?? null,
        items: Array.isArray(data.items) ? data.items as RfpExtraction['items'] : [],
        budget: typeof data.budget === 'number' ? data.budget : null,
        deadline: (data.deadline as string) ?? null,
        notes: (data.notes as string) ?? null,
      },
      appKey: 'flow',
      orgId: ctx.orgId,
      execution,
      confidenceScore: 0.78,
      evidenceRefs: ['prompt:rfp-extraction', 'evidence_pack:RFP_EXTRACTION'],
      domain: 'commerce',
    })
  } catch (error) {
    logger.error('RFP extraction failed', { error })
    return null
  }
}

/* ─── Quote Conversion Prediction ─── */

export async function predictConversion(quoteId: string): Promise<ConversionPrediction | null> {
  const ctx = await resolveOrgContext()

  try {
    const predictionResult = await runPredictionDetailed({
      model: 'quote-conversion-predictor',
      features: { quoteId, scope: 'platform' },
      orgId: ctx.orgId,
    })
    const prediction = predictionResult.data

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

      const { content: raw, execution } = await runAICompletionDetailed(prompt, {
        orgId: ctx.orgId,
        profile: 'Flow-predict',
      })

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        return buildCanonicalAiOutput({
          payload: {
            probability: typeof parsed.probability === 'number' ? parsed.probability : 0,
            factors: Array.isArray(parsed.factors) ? parsed.factors as ConversionPrediction['factors'] : [],
            recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
          },
          appKey: 'flow',
          orgId: ctx.orgId,
          execution,
          confidenceScore: typeof parsed.probability === 'number' ? parsed.probability : 0.5,
          evidenceRefs: ['audit_log:quote.created', 'ai-profile:Flow-predict'],
          domain: 'commerce',
        })
      } catch {
        return null
      }
    }

    return buildCanonicalAiOutput({
      payload: {
        probability: typeof prediction.probability === 'number' ? prediction.probability : 0,
        factors: Array.isArray(prediction.factors) ? prediction.factors as ConversionPrediction['factors'] : [],
        recommendation: typeof prediction.recommendation === 'string' ? prediction.recommendation : '',
      },
      appKey: 'flow',
      orgId: ctx.orgId,
      execution: predictionResult.execution ?? {
        modelUsed: 'quote-conversion-predictor',
        provider: 'ml',
        engineVersion: 'ml:quote-conversion-predictor',
      },
      confidenceScore: typeof prediction.probability === 'number' ? prediction.probability : 0.5,
      evidenceRefs: ['ml:model:quote-conversion-predictor'],
      domain: 'commerce',
    })
  } catch (error) {
    logger.error('Conversion prediction failed', { error, quoteId })
    return null
  }
}
