import { syntheticScenario } from '../scenario'
import type { Operation } from './model'
import { DurableCivic } from './store'

export function proofOperations(institution: 'A' | 'B') {
  const s = syntheticScenario(institution)
  let tick = 0
  const at = () => new Date(Date.parse('2026-10-10T18:30:00Z') + tick++ * 1000).toISOString()
  const operations: Operation[] = [
    { kind: 'authorize', resourceId: s.itemId, at: at() },
    { kind: 'evidence', resourceId: s.itemId, at: at(), evidence: s.engagement },
    {
      kind: 'commitment',
      resourceId: s.itemId,
      at: at(),
      commitment: {
        sourceId: s.engagement.id,
        ceilingCad: 80000,
        expectedDeliverables: 4,
      },
    },
    ...[s.receipts, s.contraryReceipts, s.observation, s.derived].map((evidence) => ({
      kind: 'evidence' as const,
      resourceId: s.itemId,
      at: at(),
      evidence,
    })),
    {
      kind: 'execution',
      resourceId: s.itemId,
      at: at(),
      execution: { sourceId: s.receipts.id, receivedDeliverables: 3 },
    },
    {
      kind: 'outcome',
      resourceId: s.itemId,
      at: at(),
      outcome: {
        value: 14,
        unit: 'working_days',
        window: 'synthetic:2026-Q3',
        evidenceId: s.observation.id,
      },
    },
    ...['Fictional staffing interruption', 'Fictional knowledge-transfer gap'].map(
      (statement, i) => ({
        kind: 'interpretation' as const,
        resourceId: s.itemId,
        at: at(),
        interpretation: {
          syntheticOnly: true as const,
          orgId: s.principal.orgId,
          id: `${s.prefix}-INTERPRETATION-${i}`,
          resourceId: s.itemId,
          authorId: s.principal.actorId,
          evidenceIds: [s.receipts.id, s.observation.id],
          statement,
        },
      }),
    ),
    {
      kind: 'decision',
      resourceId: s.itemId,
      at: at(),
      id: `${s.prefix}-DECISION-1`,
      disposition: 'request_evidence',
      rationale:
        'Fictional human requests missing deliverable/spend; preserve unresolved competing accounts',
      supersedes: null,
    },
  ]
  return { s, operations }
}
export function populate(store: DurableCivic, institution: 'A' | 'B') {
  const { s, operations } = proofOperations(institution)
  let version = store.create(s.seed, 'genesis').sequence
  const receipts = operations.map((op, i) => {
    const result = store.submit(s.principal, op, `chain-${i}`, version)
    version = result.sequence
    return result
  })
  return { s, operations, receipts, read: store.read(s.principal) }
}
