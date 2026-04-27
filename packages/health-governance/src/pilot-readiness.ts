import type { PilotReadinessItem, PilotReadinessReport } from './types.js'

export function buildPilotReadinessReport(
  orgId: string,
  siteId: string,
  items: PilotReadinessItem[],
): PilotReadinessReport {
  const overallReady = items.every((item) => item.status === 'ready')
  return {
    organizationId: orgId,
    siteId,
    generatedAt: new Date().toISOString(),
    items,
    overallReady,
  }
}
