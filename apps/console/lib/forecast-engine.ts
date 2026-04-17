import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { commerceQuotes } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { getFounderFocusData, getRunwayData, getCapitalPriorityRows } from './executive-intelligence'

export interface ForecastScenario {
  name: 'best' | 'base' | 'worst'
  runwayMonths: number
  expectedRevenue30d: number
  expectedRevenue90d: number
  expectedRevenue180d: number
  founderOverloadRiskPct: number
  hiringAffordability: number
  narrative: string
}

export interface ForecastOutput {
  generatedAt: Date
  pipelineWeightedUsd: number
  closeSignals: {
    draft: number
    sent: number
    accepted: number
  }
  scenarios: ForecastScenario[]
  rankingShiftSignals: string[]
}

const STATUS_WEIGHTS: Record<string, number> = {
  draft: 0.1,
  sent: 0.35,
  reviewing: 0.45,
  accepted: 0.8,
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export async function getForecastOutput(): Promise<ForecastOutput> {
  const [runway, focus, capitalRows, draftRows, sentRows, acceptedRows] = await Promise.all([
    getRunwayData(),
    getFounderFocusData(),
    getCapitalPriorityRows(),
    platformDb.select({ total: commerceQuotes.total }).from(commerceQuotes).where(eq(commerceQuotes.status, 'draft')),
    platformDb.select({ total: commerceQuotes.total }).from(commerceQuotes).where(eq(commerceQuotes.status, 'sent')),
    platformDb.select({ total: commerceQuotes.total }).from(commerceQuotes).where(eq(commerceQuotes.status, 'accepted')),
  ])

  const closeSignals = {
    draft: Math.max(0, draftRows.reduce((sum, row) => sum + safeNumber(row.total), 0)),
    sent: Math.max(0, sentRows.reduce((sum, row) => sum + safeNumber(row.total), 0)),
    accepted: Math.max(0, acceptedRows.reduce((sum, row) => sum + safeNumber(row.total), 0)),
  }

  const pipelineWeightedUsd =
    closeSignals.draft * STATUS_WEIGHTS.draft +
    closeSignals.sent * STATUS_WEIGHTS.sent +
    closeSignals.accepted * STATUS_WEIGHTS.accepted

  const baseRunway = runway.scenarioRows.find((row) => row.mode === 'base')?.runwayMonths ?? 0
  const baseRevenue30d = Math.max(0, pipelineWeightedUsd * 0.35)

  const founderOverloadRiskPct = clamp(
    focus.contextSwitchTaxPct * 2 + (focus.adminDragPct > 25 ? 15 : 0) + (focus.focusedVentures7 >= 5 ? 20 : 0),
    0,
    100,
  )

  const scenarios: ForecastScenario[] = [
    {
      name: 'best',
      runwayMonths: baseRunway + 4.2,
      expectedRevenue30d: baseRevenue30d * 1.4,
      expectedRevenue90d: baseRevenue30d * 4.3,
      expectedRevenue180d: baseRevenue30d * 9.1,
      founderOverloadRiskPct: Math.max(0, founderOverloadRiskPct - 20),
      hiringAffordability: runway.hiringAffordability + 1,
      narrative: 'If top pipeline closes on schedule and focus tax drops, runway extends materially.',
    },
    {
      name: 'base',
      runwayMonths: baseRunway,
      expectedRevenue30d: baseRevenue30d,
      expectedRevenue90d: baseRevenue30d * 3,
      expectedRevenue180d: baseRevenue30d * 6,
      founderOverloadRiskPct,
      hiringAffordability: runway.hiringAffordability,
      narrative: 'Current execution trend with weighted close probabilities and present burn profile.',
    },
    {
      name: 'worst',
      runwayMonths: Math.max(0, baseRunway - 2.6),
      expectedRevenue30d: baseRevenue30d * 0.55,
      expectedRevenue90d: baseRevenue30d * 1.9,
      expectedRevenue180d: baseRevenue30d * 3.7,
      founderOverloadRiskPct: clamp(founderOverloadRiskPct + 18, 0, 100),
      hiringAffordability: Math.max(0, runway.hiringAffordability - 1),
      narrative: 'If stale opportunities persist and context-switch remains high, velocity drops and runway compresses.',
    },
  ]

  const rankingShiftSignals = [
    capitalRows[0] ? `${capitalRows[0].ventureName} likely to stay #1 if current momentum holds.` : null,
    capitalRows.find((row) => row.action === 'Cut review') ? 'At least one venture projects into cut-review band over 90 days.' : null,
    founderOverloadRiskPct > 60 ? 'Founder overload risk implies ranking volatility in lower-signal ventures.' : null,
  ].filter(Boolean) as string[]

  return {
    generatedAt: new Date(),
    pipelineWeightedUsd,
    closeSignals,
    scenarios,
    rankingShiftSignals,
  }
}
