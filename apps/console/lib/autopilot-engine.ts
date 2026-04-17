import 'server-only'

import { getFounderFocusData, getRunwayData, getCapitalPriorityRows, getTopExecutionActions, getWeeklyBriefingData } from './executive-intelligence'
import { getFinanceSpineSnapshot } from './finance-spine'

export interface AutopilotRecommendation {
  action: string
  rationale: string
  expectedUpside: string
  urgency: 'critical' | 'high' | 'medium'
  confidence: number
  owner: string
  category: 'sales' | 'capital' | 'hiring' | 'product' | 'risk'
  ventureId: string | null
  dueDays: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export async function generateAutopilotRecommendations(): Promise<AutopilotRecommendation[]> {
  const [focus, runway, capitalRows, briefing, finance, executionActions] = await Promise.all([
    getFounderFocusData(),
    getRunwayData(),
    getCapitalPriorityRows(),
    getWeeklyBriefingData(),
    getFinanceSpineSnapshot(),
    getTopExecutionActions(12),
  ])

  const recommendations: AutopilotRecommendation[] = []
  const topVenture = capitalRows[0]
  const overdueReceivables = finance.receivablesAging.find((bucket) => bucket.bucket === '61+d overdue')?.amountUsd ?? 0
  const baseRunway = runway.scenarioRows.find((scenario) => scenario.mode === 'base')?.runwayMonths ?? 0
  const flowRow = capitalRows.find((row) => row.ventureId === 'flow')
  const zongaRow = capitalRows.find((row) => row.ventureId === 'zonga')

  if (flowRow && flowRow.score >= 70) {
    recommendations.push({
      action: `Allocate +10 founder hours to ${flowRow.ventureName} this week.`,
      rationale: `${flowRow.ventureName} has top capital score (${flowRow.score}) with strong traction signal.`,
      expectedUpside: 'Faster pipeline conversion and clearer venture compounding.',
      urgency: 'high',
      confidence: 0.82,
      owner: 'Founder',
      category: 'sales',
      ventureId: flowRow.ventureId,
      dueDays: 2,
    })
  }

  if (zongaRow && zongaRow.score <= 45) {
    recommendations.push({
      action: `Pause non-core ${zongaRow.ventureName} build tasks this week.`,
      rationale: `${zongaRow.ventureName} signal is weak (score ${zongaRow.score}) relative to current capital pressure.`,
      expectedUpside: 'Recovered founder bandwidth and lower distraction tax.',
      urgency: 'medium',
      confidence: 0.74,
      owner: 'COO',
      category: 'product',
      ventureId: zongaRow.ventureId,
      dueDays: 4,
    })
  }

  if (overdueReceivables > 0) {
    const topInvoice = finance.collectionsPriority[0]
    recommendations.push({
      action: topInvoice
        ? `Push collections on invoice ${topInvoice.ref} immediately.`
        : 'Launch collections sprint on 61+ day receivables.',
      rationale: `Overdue receivables above 60 days total $${overdueReceivables.toFixed(0)} and are eroding runway quality.`,
      expectedUpside: 'Improved cash conversion and stronger near-term runway.',
      urgency: 'critical',
      confidence: 0.88,
      owner: 'CFO',
      category: 'capital',
      ventureId: topInvoice?.ventureId ?? null,
      dueDays: 1,
    })
  }

  if (baseRunway < 6) {
    recommendations.push({
      action: 'Defer net-new engineering hiring; prioritize fractional sales support.',
      rationale: `Base runway is ${baseRunway.toFixed(1)} months and below safe growth threshold.`,
      expectedUpside: 'Revenue lift without locking fixed burn too early.',
      urgency: 'high',
      confidence: 0.79,
      owner: 'Founder',
      category: 'hiring',
      ventureId: topVenture?.ventureId ?? null,
      dueDays: 3,
    })
  }

  const staleExecution = executionActions.filter((action) => !action.urgent && action.dueDate && action.dueDate < new Date())
  if (staleExecution.length >= 2) {
    recommendations.push({
      action: 'Run Friday execution reset for stale initiatives and reassign clear owners.',
      rationale: `${staleExecution.length} initiatives are stale and reducing weekly throughput.`,
      expectedUpside: 'Higher execution velocity and less owner ambiguity.',
      urgency: 'high',
      confidence: 0.77,
      owner: 'COO',
      category: 'risk',
      ventureId: null,
      dueDays: 2,
    })
  }

  if (focus.contextSwitchTaxPct > 15) {
    recommendations.push({
      action: 'Block two daily 90-minute deep-work windows for sales and decision work.',
      rationale: `Context-switch tax is ${focus.contextSwitchTaxPct.toFixed(0)}%, currently too high for compounding execution.`,
      expectedUpside: 'Higher founder leverage and better quality decisions.',
      urgency: 'medium',
      confidence: 0.8,
      owner: 'Founder',
      category: 'product',
      ventureId: topVenture?.ventureId ?? null,
      dueDays: 1,
    })
  }

  for (const candidate of briefing.decisionCandidates.slice(0, 2)) {
    recommendations.push({
      action: candidate.title,
      rationale: candidate.rationale,
      expectedUpside: 'Closed-loop decision converted into measurable execution.',
      urgency: candidate.priority === 'p0' ? 'critical' : candidate.priority === 'p1' ? 'high' : 'medium',
      confidence: clamp(candidate.priority === 'p0' ? 0.81 : 0.7, 0, 1),
      owner: candidate.owner,
      category: candidate.category,
      ventureId: candidate.ventureId,
      dueDays: clamp(candidate.dueDays, 1, 30),
    })
  }

  const deduped = new Map<string, AutopilotRecommendation>()
  for (const recommendation of recommendations) {
    if (!recommendation.action.trim()) continue
    const key = `${recommendation.action.toLowerCase()}::${recommendation.owner.toLowerCase()}`
    if (!deduped.has(key)) deduped.set(key, recommendation)
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      const weight = { critical: 3, high: 2, medium: 1 }
      return weight[right.urgency] - weight[left.urgency] || right.confidence - left.confidence
    })
    .slice(0, 8)
}
