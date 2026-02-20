/**
 * Evidence Collector: Incident Simulations
 *
 * Collects tabletop exercise results and chaos/incident simulation
 * reports as evidence of operational readiness.
 */
import type { EvidenceArtifact } from '../types'

export interface IncidentSimRecord {
  simulationId: string
  scenarioName: string
  conductedAt: string
  participantCount: number
  rtoAchievedMinutes: number
  rpoAchievedMinutes: number
  passedGates: string[]
  failedGates: string[]
  remediationItems: string[]
  facilitator: string
}

export interface IncidentSimOptions {
  periodLabel: string
  simRecords: IncidentSimRecord[]
}

export function collectIncidentSimEvidence(
  opts: IncidentSimOptions,
): EvidenceArtifact[] {
  const { simRecords, periodLabel } = opts

  const rtoValues = simRecords.map((r) => r.rtoAchievedMinutes)
  const rpoValues = simRecords.map((r) => r.rpoAchievedMinutes)

  const p95 = (arr: number[]): number => {
    if (!arr.length) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.95)
    return sorted[Math.min(idx, sorted.length - 1)]
  }

  const allRemediations = simRecords.flatMap((r) => r.remediationItems)
  const openRemediations = allRemediations.length

  return [
    {
      type: 'incident-simulation-summary',
      periodLabel,
      simulationCount: simRecords.length,
      rto: {
        p95Minutes: p95(rtoValues),
        maxMinutes: Math.max(...rtoValues, 0),
        targetMinutes: 240, // 4h RTO target
        allPassed: rtoValues.every((v) => v <= 240),
      },
      rpo: {
        p95Minutes: p95(rpoValues),
        maxMinutes: Math.max(...rpoValues, 0),
        targetMinutes: 60, // 1h RPO target
        allPassed: rpoValues.every((v) => v <= 60),
      },
      openRemediationCount: openRemediations,
      simulations: simRecords,
      collectedAt: new Date().toISOString(),
    },
  ]
}
