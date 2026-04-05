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
import { runAICompletion } from '@/lib/ai-client'
import { runPrediction } from '@/lib/ml-client'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Insight {
  id: string
  type: 'anomaly' | 'trend' | 'recommendation' | 'alert'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: Date
  actionable: boolean
}

export async function askAdvisor(
  question: string,
  context?: { orgId?: string; conversationHistory?: ChatMessage[] },
): Promise<{ answer: string; sources: string[] }> {
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
    const result = await runAICompletion(fullPrompt)
    const answer = result ?? 'Unable to generate response.'

    // Log for evidence trail
    const pack = buildEvidencePackFromAction({
      actionId: `advisory-${Date.now()}`,
      actionType: 'ADVISORY_QUERY',
      orgId: context?.orgId ?? 'platform',
      executedBy: userId,
    })
    await processEvidencePack(pack)

    return {
      answer,
      sources: ['Recent transaction data', 'Ledger entries', 'Payment history'],
    }
  } catch (error) {
    logger.error('Advisory AI query failed', { error })
    return {
      answer: 'I apologize, but I am unable to process your request at this time. Please try again shortly.',
      sources: [],
    }
  }
}

export async function getAIInsights(): Promise<Insight[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('ai_insights:view')

  try {
    // Run anomaly detection via ML SDK
    const prediction = await runPrediction({
      model: 'financial-anomaly-detector',
      features: { scope: 'platform', lookbackDays: 90 },
    })

    const insights: Insight[] = []

    if (prediction?.anomalies && Array.isArray(prediction.anomalies)) {
      for (const anomaly of prediction.anomalies) {
        insights.push({
          id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'anomaly',
          title: anomaly.title ?? 'Unusual Activity Detected',
          description: anomaly.description ?? 'Anomalous pattern found in financial data.',
          severity: anomaly.severity ?? 'warning',
          createdAt: new Date(),
          actionable: true,
        })
      }
    }

    // Also generate trend insights via AI
    const trendPrompt = `Analyze the following financial data context and identify the top 3 actionable
      trends or recommendations for a CFO. Return as JSON array with objects having fields:
      title (string), description (string), severity (info|warning|critical).`
    const trendResult = await runAICompletion(trendPrompt)
    const trendText = trendResult ?? '[]'

    try {
      const trends = JSON.parse(trendText)
      if (Array.isArray(trends)) {
        for (const trend of trends.slice(0, 3)) {
          insights.push({
            id: `trend-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'recommendation',
            title: trend.title ?? 'Financial Trend',
            description: trend.description ?? '',
            severity: trend.severity ?? 'info',
            createdAt: new Date(),
            actionable: true,
          })
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
    const prediction = await runPrediction({
      model: 'cash-flow-forecaster',
      features: { months, scope: 'platform' },
    })

    if (!prediction?.forecast) return null

    const forecast = prediction.forecast as Array<{ month: string; projected: number; confidence: number }>
    const narrative = await runAICompletion(
      `Summarize this cash flow forecast in 2 sentences for a CFO: ${JSON.stringify(forecast)}`,
    )

    return {
      forecast,
      summary: narrative ?? '',
    }
  } catch (error) {
    logger.error('Cash flow forecast failed', { error })
    return null
  }
}
