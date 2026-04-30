import 'server-only'
import { getOperatingEvidenceService } from '@nzila/operating-evidence'

export async function getOperatingEvidenceDashboard(windowDays = 30) {
  const service = getOperatingEvidenceService()
  return service.getDashboard(windowDays)
}

export async function ingestOperatingEvidenceEvent(event: {
  app: string
  domain: 'labour' | 'legal' | 'commerce' | 'media-rights' | 'platform'
  type: 'request' | 'error' | 'override' | 'policy_violation' | 'decision_correction' | 'admin_action'
  policyVersion?: string
  latencyMs?: number
  statusCode?: number
  severity?: 'low' | 'medium' | 'high' | 'critical'
  confidence?: number
  correctedByHuman?: boolean
  overrideReason?: string
  payload?: Record<string, unknown>
}) {
  const service = getOperatingEvidenceService()
  return service.record(event)
}

export async function createDailyEvidenceSnapshot() {
  const service = getOperatingEvidenceService()
  return service.createDailySnapshot()
}

export async function exportSealedEvidence(windowDays = 30) {
  const service = getOperatingEvidenceService()
  return service.exportSealedAudit(windowDays)
}
