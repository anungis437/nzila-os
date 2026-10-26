import { z } from 'zod'

export type AnomalyType =
  | 'grievance_spike'
  | 'financial_irregularity'
  | 'pricing_outlier'
  | 'usage_anomaly'
  | 'compliance_deviation'
  | 'partner_performance_drop'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Anomaly {
  id: string
  timestamp: string
  anomalyType: AnomalyType
  severity: AnomalySeverity
  app: string
  metric: string
  expectedValue: number
  actualValue: number
  deviationFactor: number
  description: string
  suggestedAction: string
}

export const anomalySchema = z.object({
  id: z.guid(),
  timestamp: z.string().datetime(),
  anomalyType: z.enum([
    'grievance_spike',
    'financial_irregularity',
    'pricing_outlier',
    'usage_anomaly',
    'compliance_deviation',
    'partner_performance_drop',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  app: z.string(),
  metric: z.string(),
  expectedValue: z.number(),
  actualValue: z.number(),
  deviationFactor: z.number(),
  description: z.string(),
  suggestedAction: z.string(),
})

export interface AnomalyRule {
  name: string
  anomalyType: AnomalyType
  metric: string
  thresholdFactor: number
  severityMap: Record<string, AnomalySeverity>
}

export const anomalyRuleSchema = z.object({
  name: z.string(),
  anomalyType: z.enum([
    'grievance_spike',
    'financial_irregularity',
    'pricing_outlier',
    'usage_anomaly',
    'compliance_deviation',
    'partner_performance_drop',
  ]),
  metric: z.string(),
  thresholdFactor: z.number().positive(),
  severityMap: z.record(z.string(), z.enum(['low', 'medium', 'high', 'critical'])),
})

export interface MetricDataPoint {
  app: string
  metric: string
  value: number
  baseline: number
  timestamp: string
}
