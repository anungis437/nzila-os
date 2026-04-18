'use server'

/**
 * AI-Powered Actions — Partners.
 *
 * Deal scoring, commission forecasting, and certification recommendations
 * via the governed @nzila/ai-sdk and @nzila/ml-sdk layers.
 *
 * Integration points:
 *   1. `runAICompletion`  → Deal scoring + partner performance analysis
 *   2. `runAIExtraction`  → Auto-extract deal details from partner emails
 *   3. `runPrediction`    → Deal conversion prediction + commission forecasting
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed, runAIExtractionDetailed } from '@/lib/ai-client'
import { runPredictionDetailed } from '@/lib/ml-client'
import { buildPartnerEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export type DealScore = CanonicalAiOutput<{
  dealId: string
  score: number
  tier: 'high' | 'medium' | 'low'
  factors: Array<{ name: string; impact: number; description: string }>
  suggestedActions: string[]
}>

export type CommissionForecast = CanonicalAiOutput<{
  partnerId: string
  period: string
  forecasted: number
  confidence: number
  breakdown: Array<{ dealId: string; expected: number; probability: number }>
}>

export type CertificationRecommendation = CanonicalAiOutput<{
  partnerId: string
  currentTier: string
  recommendedPath: string
  requiredActions: Array<{ action: string; deadline: string; priority: 'high' | 'medium' | 'low' }>
  projectedTierDate: string | null
}>

export type DealExtraction = CanonicalAiOutput<{
  accountName: string | null
  contactName: string | null
  contactEmail: string | null
  vertical: string | null
  estimatedArr: number | null
  notes: string | null
}>

/* ─── Deal Scoring ─── */

export async function scoreDeal(dealId: string): Promise<DealScore | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    // Try ML model first
    const mlResult = await runPredictionDetailed({
      model: 'deal-conversion-scorer',
      features: { dealId },
    })

    if (mlResult.data && typeof mlResult.data.score === 'number') {
      const mlPayload = mlResult.data as Record<string, unknown>
      const mlScore = typeof mlPayload.score === 'number' ? mlPayload.score : 0
      return buildCanonicalAiOutput({
        payload: {
          dealId: typeof mlPayload.dealId === 'string' ? mlPayload.dealId : dealId,
          score: mlScore,
          tier: (mlPayload.tier as DealScore['tier']) ?? 'medium',
          factors: Array.isArray(mlPayload.factors) ? mlPayload.factors as DealScore['factors'] : [],
          suggestedActions: Array.isArray(mlPayload.suggestedActions) ? mlPayload.suggestedActions as string[] : [],
        },
        appKey: 'partners',
        orgId: 'platform',
        execution: mlResult.execution ?? {
          modelUsed: 'deal-conversion-scorer',
          provider: 'ml',
          engineVersion: 'ml:deal-conversion-scorer',
        },
        confidenceScore: Math.min(1, Math.max(0, mlScore / 100)),
        evidenceRefs: ['ml:model:deal-conversion-scorer'],
        domain: 'commerce',
      })
    }

    // Fallback: AI heuristic from deal data
    const [dealRow] = (await platformDb.execute(
      sql`SELECT metadata FROM audit_log
      WHERE org_id = ${dealId}
        AND (action = 'deal.registered' OR action = 'deal.submitted')
      ORDER BY created_at DESC LIMIT 1`,
    )) as unknown as [{ metadata: Record<string, unknown> } | undefined]

    if (!dealRow) return null

    // Get partner's historical win rate for context
    const [history] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) FILTER (WHERE action = 'deal.won')::int as wins,
        COUNT(*) FILTER (WHERE action = 'deal.lost')::int as losses,
        COUNT(*)::int as total
      FROM audit_log
      WHERE action LIKE 'deal.%' AND actor_id = ${userId}`,
    )) as unknown as [{ wins: number; losses: number; total: number }]

    const prompt = `Score this partner deal for conversion likelihood.

Deal data: ${JSON.stringify(dealRow.metadata)}
Partner history: ${history?.wins ?? 0} wins, ${history?.losses ?? 0} losses out of ${history?.total ?? 0} total deals.

Return JSON: {
  "dealId": "${dealId}",
  "score": number (0-100),
  "tier": "high"|"medium"|"low",
  "factors": [{ "name": string, "impact": number (-10 to +10), "description": string }],
  "suggestedActions": [string, ...]
}`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, { profile: 'partners-deal-score' })

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const score = typeof parsed.score === 'number' ? parsed.score : 0
      return buildCanonicalAiOutput({
        payload: {
          dealId: typeof parsed.dealId === 'string' ? parsed.dealId : dealId,
          score,
          tier: (parsed.tier as DealScore['tier']) ?? 'medium',
          factors: Array.isArray(parsed.factors) ? parsed.factors as DealScore['factors'] : [],
          suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions as string[] : [],
        },
        appKey: 'partners',
        orgId: 'platform',
        execution,
        confidenceScore: Math.min(1, Math.max(0, score / 100)),
        evidenceRefs: ['audit_log:deal.registered', 'audit_log:deal.submitted', 'ai-profile:partners-deal-score'],
        domain: 'commerce',
      })
    } catch {
      return null
    }
  } catch (error) {
    logger.error('Deal scoring failed', { error, dealId })
    return null
  }
}

/* ─── Commission Forecasting ─── */

export async function forecastCommissions(
  partnerId: string,
  months: number = 3,
): Promise<CommissionForecast | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const mlResult = await runPredictionDetailed({
      model: 'commission-forecaster',
      features: { partnerId, months },
    })

    if (mlResult.data && typeof mlResult.data.forecasted === 'number') {
      const mlPayload = mlResult.data as Record<string, unknown>
      const mlConfidence = typeof mlPayload.confidence === 'number' ? mlPayload.confidence : 0.5
      return buildCanonicalAiOutput({
        payload: {
          partnerId: typeof mlPayload.partnerId === 'string' ? mlPayload.partnerId : partnerId,
          period: typeof mlPayload.period === 'string' ? mlPayload.period : `${months} months`,
          forecasted: typeof mlPayload.forecasted === 'number' ? mlPayload.forecasted : 0,
          confidence: mlConfidence,
          breakdown: Array.isArray(mlPayload.breakdown)
            ? mlPayload.breakdown as CommissionForecast['breakdown']
            : [],
        },
        appKey: 'partners',
        orgId: 'platform',
        execution: mlResult.execution ?? {
          modelUsed: 'commission-forecaster',
          provider: 'ml',
          engineVersion: 'ml:commission-forecaster',
        },
        confidenceScore: mlConfidence,
        evidenceRefs: ['ml:model:commission-forecaster'],
        domain: 'commerce',
      })
    }

    // Fallback: AI based on historical commission data
    const commissions = (await platformDb.execute(
      sql`SELECT
        metadata->>'amount' as amount,
        metadata->>'dealId' as "dealId",
        metadata->>'status' as status,
        created_at as "createdAt"
      FROM audit_log
      WHERE action LIKE 'commission.%'
        AND metadata->>'partnerId' = ${partnerId}
      ORDER BY created_at DESC LIMIT 50`,
    )) as unknown as Array<Record<string, string>>

    const prompt = `Forecast commissions for partner ${partnerId} over the next ${months} months.

Historical commission data: ${JSON.stringify(commissions)}

Return JSON: {
  "partnerId": "${partnerId}",
  "period": "${months} months",
  "forecasted": number (total CAD),
  "confidence": number (0-1),
  "breakdown": [{ "dealId": string, "expected": number, "probability": number }]
}`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, { profile: 'partners-forecast' })

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return buildCanonicalAiOutput({
        payload: {
          partnerId: typeof parsed.partnerId === 'string' ? parsed.partnerId : partnerId,
          period: typeof parsed.period === 'string' ? parsed.period : `${months} months`,
          forecasted: typeof parsed.forecasted === 'number' ? parsed.forecasted : 0,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown as CommissionForecast['breakdown'] : [],
        },
        appKey: 'partners',
        orgId: 'platform',
        execution,
        confidenceScore: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        evidenceRefs: ['audit_log:commission.paid', 'ai-profile:partners-forecast'],
        domain: 'commerce',
      })
    } catch {
      return null
    }
  } catch (error) {
    logger.error('Commission forecast failed', { error, partnerId })
    return null
  }
}

/* ─── Certification Recommendations ─── */

export async function recommendCertification(
  partnerId: string,
): Promise<CertificationRecommendation | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    const [partnerData] = (await platformDb.execute(
      sql`SELECT metadata FROM audit_log
      WHERE org_id = ${partnerId}
        AND action = 'partner.registered'
      ORDER BY created_at DESC LIMIT 1`,
    )) as unknown as [{ metadata: Record<string, unknown> } | undefined]

    const [activity] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) FILTER (WHERE action = 'deal.won')::int as "dealsWon",
        COUNT(*) FILTER (WHERE action = 'certification.completed')::int as "certsCompleted",
        COALESCE(SUM(CASE WHEN action = 'commission.paid' THEN (metadata->>'amount')::numeric END), 0) as "totalRevenue"
      FROM audit_log
      WHERE metadata->>'partnerId' = ${partnerId}`,
    )) as unknown as [{ dealsWon: number; certsCompleted: number; totalRevenue: number }]

    const prompt = `Recommend a certification advancement path for this partner.

Partner profile: ${JSON.stringify(partnerData?.metadata ?? {})}
Activity: ${activity?.dealsWon ?? 0} deals won, ${activity?.certsCompleted ?? 0} certifications, $${activity?.totalRevenue ?? 0} total revenue.

Our tier system: Registered → Silver → Gold → Platinum
Each tier requires: progressively more deals, revenue thresholds, and certifications.

Return JSON: {
  "partnerId": "${partnerId}",
  "currentTier": string,
  "recommendedPath": string (description),
  "requiredActions": [{ "action": string, "deadline": string, "priority": "high"|"medium"|"low" }],
  "projectedTierDate": string|null (ISO date)
}`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, { profile: 'partners-certification' })

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return buildCanonicalAiOutput({
        payload: {
          partnerId: typeof parsed.partnerId === 'string' ? parsed.partnerId : partnerId,
          currentTier: typeof parsed.currentTier === 'string' ? parsed.currentTier : 'Registered',
          recommendedPath: typeof parsed.recommendedPath === 'string' ? parsed.recommendedPath : '',
          requiredActions: Array.isArray(parsed.requiredActions)
            ? parsed.requiredActions as CertificationRecommendation['requiredActions']
            : [],
          projectedTierDate: typeof parsed.projectedTierDate === 'string' ? parsed.projectedTierDate : null,
        },
        appKey: 'partners',
        orgId: 'platform',
        execution,
        confidenceScore: 0.7,
        evidenceRefs: ['audit_log:partner.registered', 'audit_log:deal.won', 'ai-profile:partners-certification'],
        domain: 'commerce',
      })
    } catch {
      return null
    }
  } catch (error) {
    logger.error('Certification recommendation failed', { error, partnerId })
    return null
  }
}

/* ─── Deal Extraction from Email ─── */

export async function extractDealFromEmail(
  emailBody: string,
): Promise<DealExtraction | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  try {
    logger.info('Extracting deal from email', { actorId: userId, textLength: emailBody.length })

    const { data, execution } = await runAIExtractionDetailed(emailBody, 'deal-extraction', {
      profile: 'partners-extract',
      variables: { format: 'deal-registration' },
    })

    const _pack = buildPartnerEvidencePack({
      actionId: crypto.randomUUID(),
      actionType: 'DEAL_EXTRACTION',
      orgId: 'platform',
      executedBy: userId,
    })
    // Evidence pack is already processed by buildPartnerEvidencePack

    return buildCanonicalAiOutput({
      payload: {
        accountName: (data.accountName as string) ?? null,
        contactName: (data.contactName as string) ?? null,
        contactEmail: (data.contactEmail as string) ?? null,
        vertical: (data.vertical as string) ?? null,
        estimatedArr: typeof data.estimatedArr === 'number' ? data.estimatedArr : null,
        notes: (data.notes as string) ?? null,
      },
      appKey: 'partners',
      orgId: 'platform',
      execution,
      confidenceScore: 0.76,
      evidenceRefs: ['prompt:deal-extraction', 'evidence_pack:DEAL_EXTRACTION'],
      domain: 'commerce',
    })
  } catch (error) {
    logger.error('Deal extraction failed', { error })
    return null
  }
}
