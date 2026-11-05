import { z } from 'zod'

// ── Event Aggregation ───────────────────────────────────

export interface AggregatedEvent {
  id: string
  source: string
  eventType: string
  timestamp: string
  app: string
  orgId: string
  payload: Record<string, unknown>
}

export const aggregatedEventSchema = z.object({
  id: z.guid(),
  source: z.string(),
  eventType: z.string(),
  timestamp: z.string().datetime(),
  app: z.string(),
  orgId: z.string(),
  payload: z.record(z.string(), z.unknown()),
})

// ── Cross-App Insights ──────────────────────────────────

export type InsightSeverity = 'info' | 'warning' | 'critical'
export type InsightCategory =
  | 'performance'
  | 'usage'
  | 'anomaly'
  | 'compliance'
  | 'cost'

export interface CrossAppInsight {
  id: string
  timestamp: string
  category: InsightCategory
  severity: InsightSeverity
  apps: string[]
  title: string
  description: string
  dataPoints: Record<string, unknown>
  recommendations: string[]
}

export const crossAppInsightSchema = z.object({
  id: z.guid(),
  timestamp: z.string().datetime(),
  category: z.enum(['performance', 'usage', 'anomaly', 'compliance', 'cost']),
  severity: z.enum(['info', 'warning', 'critical']),
  apps: z.array(z.string()),
  title: z.string(),
  description: z.string(),
  dataPoints: z.record(z.string(), z.unknown()),
  recommendations: z.array(z.string()),
})

// ── Operational Signals ─────────────────────────────────

export type SignalType =
  | 'spike'
  | 'drop'
  | 'threshold_breach'
  | 'trend_change'
  | 'correlation'

export interface OperationalSignal {
  id: string
  timestamp: string
  signalType: SignalType
  app: string
  metric: string
  currentValue: number
  baselineValue: number
  deviationPercent: number
  confidence: number
}

export const operationalSignalSchema = z.object({
  id: z.guid(),
  timestamp: z.string().datetime(),
  signalType: z.enum([
    'spike',
    'drop',
    'threshold_breach',
    'trend_change',
    'correlation',
  ]),
  app: z.string(),
  metric: z.string(),
  currentValue: z.number(),
  baselineValue: z.number(),
  deviationPercent: z.number(),
  confidence: z.number().min(0).max(1),
})
