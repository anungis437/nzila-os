import { z } from 'zod'
import { sha256Canonical } from '../source-continuity/integrity'
import { reuseQualificationSchema, type ReuseQualification } from './contracts'
import {
  crossInstitutionalEvidenceReuseEventSchema,
  type CrossInstitutionalEvidenceReuseEvent,
} from './reuse'

export interface EvidenceReuseRatio {
  numerator: number
  denominator: number
  ratio: number | null
  state: 'MEASURED' | 'NO_ELIGIBLE_OPPORTUNITIES'
  excludedEventCounts: Record<ReuseQualification, number>
  repeatedEvaluationCount: number
}

export function measureEvidenceReuseRatio(
  inputs: CrossInstitutionalEvidenceReuseEvent[],
): EvidenceReuseRatio {
  const excludedEventCounts = Object.fromEntries(
    reuseQualificationSchema.options.map((key) => [key, 0]),
  ) as Record<ReuseQualification, number>
  const seen = new Map<string, string>()
  const eventIds = new Map<string, string>()
  let numerator = 0
  let denominator = 0
  let repeatedEvaluationCount = 0
  for (const input of inputs) {
    const event = crossInstitutionalEvidenceReuseEventSchema.parse(input)
    const { eventId, reuseTimestamp: _timestamp, ...content } = event
    const digest = sha256Canonical(content)
    if (eventIds.has(eventId) && eventIds.get(eventId) !== digest)
      throw new Error('Reuse event ID has conflicting content')
    eventIds.set(eventId, digest)
    const key = event.eligibleOpportunity
      ? event.opportunityKey
      : `${event.opportunityKey}:${event.qualification}`
    const previous = seen.get(key)
    if (previous !== undefined) {
      if (previous !== digest)
        throw new Error('Reuse opportunity has conflicting evaluations; reconcile before measuring')
      repeatedEvaluationCount++
      continue
    }
    seen.set(key, digest)
    if (event.eligibleOpportunity) {
      denominator++
      if (event.qualification === 'QUALIFIED_REUSE') numerator++
    } else excludedEventCounts[event.qualification]++
  }
  return {
    numerator,
    denominator,
    ratio: denominator === 0 ? null : numerator / denominator,
    state: denominator === 0 ? 'NO_ELIGIBLE_OPPORTUNITIES' : 'MEASURED',
    excludedEventCounts,
    repeatedEvaluationCount,
  }
}

const count = z.number().int().nonnegative()
export const evidenceMobilityFrictionSchema = z
  .object({
    proofKind: z.literal('SYNTHETIC_ACTION_COUNTS'),
    contextId: z.string().min(1),
    evidenceId: z.string().min(1),
    evidenceVersion: z.string().min(1),
    scenario: z.enum(['BASELINE_WITHOUT_REUSE', 'GOVERNED_REUSE']),
    events: z
      .object({
        sourceRetrieval: count,
        manualReentry: count,
        duplicateDocumentProduction: count,
        semanticClarification: count,
        permissionRemediation: count,
        institutionalReverification: count,
        evidenceReconstruction: count,
      })
      .strict(),
  })
  .strict()

export type EvidenceMobilityFriction = z.infer<typeof evidenceMobilityFrictionSchema>

export function compareEvidenceMobilityFriction(
  baselineInput: EvidenceMobilityFriction,
  reuseInput: EvidenceMobilityFriction,
) {
  const baseline = evidenceMobilityFrictionSchema.parse(baselineInput)
  const reuse = evidenceMobilityFrictionSchema.parse(reuseInput)
  if (
    baseline.scenario !== 'BASELINE_WITHOUT_REUSE' ||
    reuse.scenario !== 'GOVERNED_REUSE' ||
    baseline.contextId !== reuse.contextId ||
    baseline.evidenceId !== reuse.evidenceId ||
    baseline.evidenceVersion !== reuse.evidenceVersion
  )
    throw new Error(
      'Friction comparison requires the same context and evidence version with baseline and reuse scenarios',
    )
  const steps = Object.keys(baseline.events) as (keyof EvidenceMobilityFriction['events'])[]
  const baselineTotal = steps.reduce((total, step) => total + baseline.events[step], 0)
  const reuseTotal = steps.reduce((total, step) => total + reuse.events[step], 0)
  return {
    proofKind: 'SYNTHETIC_ACTION_COUNTS' as const,
    baseline,
    reuse,
    baselineTotal,
    reuseTotal,
    frictionDelta: baselineTotal - reuseTotal,
    avoided: steps
      .filter((step) => baseline.events[step] > reuse.events[step])
      .map((step) => ({ step, count: baseline.events[step] - reuse.events[step] })),
    remaining: steps
      .filter((step) => reuse.events[step] > 0)
      .map((step) => ({ step, count: reuse.events[step] })),
    added: steps
      .filter((step) => reuse.events[step] > baseline.events[step])
      .map((step) => ({ step, count: reuse.events[step] - baseline.events[step] })),
  }
}
