import 'server-only'
import { getMetricsCommercialService } from '@nzila/metrics-commercial'

export async function getCommercialMetricsDashboard(windowDays = 90) {
  return getMetricsCommercialService().getDashboard(windowDays)
}

export async function ingestCommercialEvent(event: {
  userId: string
  app: string
  type: 'acquisition' | 'activation' | 'retention' | 'feature_usage' | 'conversion_signal'
  feature?: string
  metadata?: Record<string, unknown>
}) {
  return getMetricsCommercialService().record(event)
}
