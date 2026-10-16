import { z } from 'zod'
import { rightsSnapshotSchema } from './contracts'
import { evaluateRights, type RightsAction } from './rights'

export const continuityEventTypeSchema = z.enum([
  'CAPTURED',
  'CAPTURE_VALIDATED',
  'MAPPING_APPLIED',
  'CAPSULE_ASSEMBLED',
  'EXPORTED',
  'REHYDRATED',
  'REVOCATION_RECORDED',
  'DELETION_REQUESTED',
  'DELETION_OBLIGATIONS_RECONCILED',
  'SOURCE_TRUTH_CHANGED',
  'CORA_INTERPRETATION_CHANGED',
  'SOURCE_SCHEMA_CHANGED',
])

export const continuityEventSchema = z
  .object({
    eventId: z.string().min(1),
    lineageId: z.string().min(1),
    orgId: z.string().min(1),
    eventType: continuityEventTypeSchema,
    occurredAt: z.string().datetime(),
    actorId: z.string().min(1),
    purpose: z.string().min(1),
    recipientId: z.string().min(1),
    rights: rightsSnapshotSchema,
    changeRef: z.string().min(1).optional(),
    mappingVersion: z.string().min(1).optional(),
    integritySha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    unresolvedReplicaIds: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      event.eventType === 'DELETION_OBLIGATIONS_RECONCILED' &&
      event.unresolvedReplicaIds === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['unresolvedReplicaIds'],
        message: 'Deletion reconciliation must enumerate unresolved replicas',
      })
    }

    if (event.eventType === 'MAPPING_APPLIED' && event.mappingVersion === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['mappingVersion'],
        message: 'Mapping transitions must identify the applied version',
      })
    }

    if (
      ['CAPTURED', 'CAPSULE_ASSEMBLED', 'EXPORTED'].includes(event.eventType) &&
      event.integritySha256 === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['integritySha256'],
        message: 'Integrity-bearing lifecycle transitions require a digest',
      })
    }

    if (
      ['SOURCE_TRUTH_CHANGED', 'CORA_INTERPRETATION_CHANGED', 'SOURCE_SCHEMA_CHANGED'].includes(
        event.eventType,
      ) &&
      event.changeRef === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['changeRef'],
        message: 'Change transitions require an explicit change reference',
      })
    }
  })

export type ContinuityEvent = z.infer<typeof continuityEventSchema>
export type ContinuityLedger = ContinuityEvent[]

const requiredRights: Partial<Record<ContinuityEvent['eventType'], RightsAction>> = {
  CAPTURED: 'CAPTURE',
  CAPTURE_VALIDATED: 'CAPTURE',
  MAPPING_APPLIED: 'TRANSFORM',
  CAPSULE_ASSEMBLED: 'PERSIST',
  EXPORTED: 'EXPORT',
  REHYDRATED: 'REHYDRATE',
  REVOCATION_RECORDED: 'REVOKE',
  CORA_INTERPRETATION_CHANGED: 'TRANSFORM',
}

function latestType(events: ContinuityEvent[]): ContinuityEvent['eventType'] | undefined {
  return events[events.length - 1]?.eventType
}

function assertTransition(
  previous: ContinuityEvent['eventType'] | undefined,
  next: ContinuityEvent,
): void {
  const allowed = (() => {
    switch (next.eventType) {
      case 'CAPTURED':
        return previous === undefined
      case 'CAPTURE_VALIDATED':
        return previous === 'CAPTURED' || previous === 'CAPTURE_VALIDATED'
      case 'MAPPING_APPLIED':
        return previous === 'CAPTURE_VALIDATED' || previous === 'MAPPING_APPLIED'
      case 'CAPSULE_ASSEMBLED':
        return previous === 'MAPPING_APPLIED'
      case 'EXPORTED':
        return previous === 'CAPSULE_ASSEMBLED' || previous === 'EXPORTED'
      case 'REHYDRATED':
        return previous === 'EXPORTED' || previous === 'REHYDRATED'
      case 'REVOCATION_RECORDED':
      case 'DELETION_REQUESTED':
      case 'SOURCE_TRUTH_CHANGED':
      case 'CORA_INTERPRETATION_CHANGED':
      case 'SOURCE_SCHEMA_CHANGED':
        return previous !== undefined
      case 'DELETION_OBLIGATIONS_RECONCILED':
        return previous === 'DELETION_REQUESTED'
    }
  })()

  if (!allowed) {
    throw new Error(`Invalid continuity transition: ${previous ?? 'EMPTY'} -> ${next.eventType}`)
  }
}

function actionContext(event: ContinuityEvent) {
  return {
    purpose: event.purpose,
    recipientId: event.recipientId,
    at: event.occurredAt,
    actorId: event.actorId,
  }
}

export function appendContinuityEvent(
  ledger: ContinuityLedger,
  input: ContinuityEvent,
  trustedOrgId: string,
): ContinuityLedger {
  const event = continuityEventSchema.parse(input)
  if (event.orgId !== trustedOrgId) {
    throw new Error('Ledger event organization does not match trusted Cora organization')
  }
  if (ledger.some((item) => item.eventId === event.eventId)) {
    throw new Error(`Duplicate continuity event ID: ${event.eventId}`)
  }

  const lineage = ledger.filter((item) => item.lineageId === event.lineageId)
  if (lineage.some((item) => item.orgId !== event.orgId)) {
    throw new Error('Continuity lineage cannot cross organization boundaries')
  }
  const previous = lineage[lineage.length - 1]
  if (previous && Date.parse(previous.occurredAt) > Date.parse(event.occurredAt)) {
    throw new Error('Continuity ledger event time cannot move backwards')
  }
  assertTransition(latestType(lineage), event)

  const action = requiredRights[event.eventType]
  if (action) {
    const decision = evaluateRights(event.rights, action, actionContext(event))
    if (!decision.allowed) {
      throw new Error(`Ledger transition is not authorized: ${decision.reasons.join(', ')}`)
    }
  }

  return [...ledger, event]
}

export function getContinuityLineage(
  ledger: ContinuityLedger,
  lineageId: string,
  trustedOrgId: string,
): ContinuityEvent[] {
  const lineage = ledger.filter((event) => event.lineageId === lineageId)
  if (lineage.some((event) => event.orgId !== trustedOrgId)) {
    throw new Error('Continuity lineage organization does not match trusted Cora organization')
  }
  return lineage
}
