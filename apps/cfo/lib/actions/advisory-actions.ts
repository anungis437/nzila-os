/**
 * CFO Server Actions — Advisory AI.
 *
 * Conversational financial advisor powered by @nzila/ai-sdk.
 * Also exposes proactive insight generation and anomaly detection
 * via @nzila/ml-sdk.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed } from '@/lib/ai-client'
import { runPredictionDetailed } from '@/lib/ml-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export type Insight = CanonicalAiOutput<{
  id: string
  type: 'anomaly' | 'trend' | 'recommendation' | 'alert'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: Date
  actionable: boolean
}>

export async function askAdvisor(
  question: string,
  context?: { orgId?: string; conversationHistory?: ChatMessage[] },
): Promise<CanonicalAiOutput<{ answer: string; sources: string[] }>> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('advisory_ai:use')

  try {
    logger.info('Advisory AI query', { actorId: userId, questionLength: question.length })

    // Build system context with recent financial data
    const [recentActivity] = (await platformDb.execute(
      sql`SELECT
        COUNT(CASE WHEN action LIKE 'payment.%' THEN 1 END) as payment_count,
        COUNT(CASE WHEN action LIKE 'invoice.%' THEN 1 END) as invoice_count,
        COUNT(CASE WHEN action LIKE 'ledger.%' THEN 1 END) as ledger_count
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '30 days'`,
    )) as unknown as [{ payment_count: number; invoice_count: number; ledger_count: number }]

    const systemPrompt = `You are LedgerIQ Advisory AI, a professional financial advisor for CFOs.
You have access to the following recent activity data:
- ${recentActivity?.payment_count ?? 0} payments in the last 30 days
- ${recentActivity?.invoice_count ?? 0} invoices in the last 30 days
- ${recentActivity?.ledger_count ?? 0} ledger entries in the last 30 days

Provide concise, actionable financial advice. Reference specific data points when relevant.
Always maintain a professional, authoritative tone. If you cannot answer definitively,
state your assumptions clearly. Format with markdown for readability.`

    const historyText = context?.conversationHistory
      ?.map((m) => `${m.role}: ${m.content}`)
      .join('\n') ?? ''

    const fullPrompt = `${systemPrompt}\n\n${historyText}\n\nUser: ${question}`
    const { content, execution } = await runAICompletionDetailed(fullPrompt, {
      orgId: context?.orgId ?? 'platform',
      profile: 'cfo-default',
      dataClass: 'sensitive',
    })
    const answer = content ?? 'Unable to generate response.'

    // Log for evidence trail
    const pack = buildEvidencePackFromAction({
      actionId: `advisory-${Date.now()}`,
      actionType: 'ADVISORY_QUERY',
      orgId: context?.orgId ?? 'platform',
      executedBy: userId,
    })
    await processEvidencePack(pack)

    return buildCanonicalAiOutput({
      payload: {
        answer,
        sources: ['Recent transaction data', 'Ledger entries', 'Payment history'],
      },
      appKey: 'cfo',
      orgId: context?.orgId ?? 'platform',
      execution,
      confidenceScore: 0.7,
      evidenceRefs: ['audit_log:payment.*', 'audit_log:invoice.*', 'audit_log:ledger.*'],
      domain: 'finance',
    })
  } catch (error) {
    logger.error('Advisory AI query failed', { error })
    return buildCanonicalAiOutput({
      payload: {
        answer: 'I apologize, but I am unable to process your request at this time. Please try again shortly.',
        sources: [],
      },
      appKey: 'cfo',
      orgId: context?.orgId ?? 'platform',
      execution: {
        modelUsed: 'unavailable',
        engineVersion: 'error:cfo-advisory',
      },
      confidenceScore: 0,
      evidenceRefs: [],
      domain: 'finance',
    })
  }
}

export async function getAIInsights(): Promise<Insight[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('ai_insights:view')

  try {
    // Run anomaly detection via ML SDK
    const prediction = await runPredictionDetailed({
      model: 'financial-anomaly-detector',
      features: { scope: 'platform', lookbackDays: 90 },
    })

    const insights: Insight[] = []

    if (prediction.data?.anomalies && Array.isArray(prediction.data.anomalies)) {
      for (const anomaly of prediction.data.anomalies) {
        insights.push(buildCanonicalAiOutput({
          payload: {
            id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'anomaly',
            title: anomaly.title ?? 'Unusual Activity Detected',
            description: anomaly.description ?? 'Anomalous pattern found in financial data.',
            severity: anomaly.severity ?? 'warning',
            createdAt: new Date(),
            actionable: true,
          },
          appKey: 'cfo',
          orgId: 'platform',
          execution: prediction.execution ?? {
            modelUsed: 'financial-anomaly-detector',
            provider: 'ml',
            engineVersion: 'ml:financial-anomaly-detector',
          },
          confidenceScore: typeof anomaly.confidence === 'number' ? anomaly.confidence : 0.7,
          evidenceRefs: ['ml:model:financial-anomaly-detector'],
          domain: 'finance',
        }))
      }
    }

    // Also generate trend insights via AI
    const trendPrompt = `Analyze the following financial data context and identify the top 3 actionable
      trends or recommendations for a CFO. Return as JSON array with objects having fields:
      title (string), description (string), severity (info|warning|critical).`
    const { content: trendText, execution } = await runAICompletionDetailed(trendPrompt, {
      orgId: 'platform',
      profile: 'cfo-default',
      dataClass: 'sensitive',
    })

    try {
      const trends = JSON.parse(trendText ?? '[]')
      if (Array.isArray(trends)) {
        for (const trend of trends.slice(0, 3)) {
          insights.push(buildCanonicalAiOutput({
            payload: {
              id: `trend-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'recommendation',
              title: trend.title ?? 'Financial Trend',
              description: trend.description ?? '',
              severity: trend.severity ?? 'info',
              createdAt: new Date(),
              actionable: true,
            },
            appKey: 'cfo',
            orgId: 'platform',
            execution,
            confidenceScore: typeof trend.confidence === 'number' ? trend.confidence : 0.65,
            evidenceRefs: ['ai-profile:cfo-default'],
            domain: 'finance',
          }))
        }
      }
    } catch {
      // AI didn't return valid JSON — that's fine, we still have anomaly insights
    }

    return insights
  } catch (error) {
    logger.error('AI insight generation failed', { error })
    return []
  }
}

export async function getCashFlowForecast(months: number = 6): Promise<{
  forecast: Array<{ month: string; projected: number; confidence: number }>
  summary: string
} | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('advisory_ai:view')

  try {
    const prediction = await runPredictionDetailed({
      model: 'cash-flow-forecaster',
      features: { months, scope: 'platform' },
    })

    if (!prediction.data?.forecast) return null

    const forecast = prediction.data.forecast as Array<{ month: string; projected: number; confidence: number }>
    const { content: narrative, execution } = await runAICompletionDetailed(
      `Summarize this cash flow forecast in 2 sentences for a CFO: ${JSON.stringify(forecast)}`,
      { orgId: 'platform', profile: 'cfo-default', dataClass: 'sensitive' },
    )

    return buildCanonicalAiOutput({
      payload: {
        forecast,
        summary: narrative ?? '',
      },
      appKey: 'cfo',
      orgId: 'platform',
      execution,
      confidenceScore: forecast.length > 0 ? Number(forecast.reduce((sum, item) => sum + item.confidence, 0) / forecast.length) : 0.5,
      evidenceRefs: ['ml:model:cash-flow-forecaster', 'ai-profile:cfo-default'],
      domain: 'finance',
    })
  } catch (error) {
    logger.error('Cash flow forecast failed', { error })
    return null
  }
}
