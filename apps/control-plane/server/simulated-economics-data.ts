import 'server-only'
import { getMetricsCommercialService } from '@nzila/metrics-commercial'

export async function getSimulatedEconomics(windowDays = 120) {
  return getMetricsCommercialService().getSimulatedEconomics(windowDays)
}
