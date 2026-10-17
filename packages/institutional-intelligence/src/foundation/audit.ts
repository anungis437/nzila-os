import { z } from 'zod'
import type { InstitutionalMutationContext, InstitutionalReference, InstitutionalScope } from '@nzila/platform-contracts'
import { institutionalReferenceSchema, institutionalMutationContextSchema } from '@nzila/platform-contracts'
import { foundationHash, type InstitutionalAuthority } from './authority'
import type { LocalInstitutionalStore, StoredInstitutionalRecord } from './local-store'
import { storedInstitutionalRecordSchema } from './local-store'

const auditIntentSchema = z.object({
  eventId: z.string().uuid(), context: institutionalMutationContextSchema,
  before: storedInstitutionalRecordSchema.nullable(), after: storedInstitutionalRecordSchema,
  linkedMission: institutionalReferenceSchema.nullable(),
  linkedChange: institutionalReferenceSchema.nullable(),
  linkedDecision: institutionalReferenceSchema.nullable(),
})

export interface InstitutionalAuditIntent {
  eventId: string
  context: InstitutionalMutationContext
  before: StoredInstitutionalRecord | null
  after: StoredInstitutionalRecord
  linkedMission: InstitutionalReference | null
  linkedChange: InstitutionalReference | null
  linkedDecision: InstitutionalReference | null
}
export interface InstitutionalAuditProofPort {
  record(intent: InstitutionalAuditIntent): Promise<{ eventId: string, intentHash: string, receiptRef: string }>
  verify(receiptRef: string, intent: InstitutionalAuditIntent): Promise<boolean>
}
const receiptSchema = z.object({
  eventId: z.string(), status: z.enum(['PENDING', 'RECORDED']),
  intentHash: z.string(), receiptRef: z.string().nullable(),
})

export class InstitutionalMutationBoundary {
  constructor(
    readonly store: LocalInstitutionalStore,
    readonly authority: InstitutionalAuthority,
    readonly proof: InstitutionalAuditProofPort,
    readonly beforeIntent?: () => void,
  ) {}

  commit(context: InstitutionalMutationContext, expectedVersion: number, work: () => StoredInstitutionalRecord,
    links: { mission?: InstitutionalReference, change?: InstitutionalReference, decision?: InstitutionalReference } = {},
  ): StoredInstitutionalRecord {
    return this.store.transaction(() => {
      this.authority.revalidate(context)
      for (const ref of Object.values(links)) {
        institutionalReferenceSchema.parse(ref)
        if (ref.scope.type !== context.target.scope.type || ref.scope.id !== context.target.scope.id) {
          this.authority.deny('CROSS_SCOPE_LINK_DENIED', context.requestId)
        }
      }
      const receipt = this.store.get(context.target.scope, 'MutationReceipt', context.requestId)
      if (receipt) {
        const previous = z.object({ payloadHash: z.string(), after: z.unknown() }).parse(receipt.data)
        if (previous.payloadHash !== context.payloadHash) this.authority.deny('IDEMPOTENCY_CONFLICT', context.requestId)
        const result = this.store.get(context.target.scope, context.target.kind, context.target.sourceId, expectedVersion + 1)
        if (!result) throw new Error('RECEIPT_INTEGRITY_ERROR')
        return result
      }
      const before = this.store.get(context.target.scope, context.target.kind, context.target.sourceId) ?? null
      if ((before?.version ?? 0) !== expectedVersion) this.authority.deny('CONFLICT', context.requestId)
      if (context.target.revision !== Math.max(1, expectedVersion)) this.authority.deny('AUTHORIZATION_REVISION_MISMATCH', context.requestId)
      const after = work()
      const intent: InstitutionalAuditIntent = {
        eventId: context.requestId, context: structuredClone(context), before, after,
        linkedMission: links.mission ?? null, linkedChange: links.change ?? null, linkedDecision: links.decision ?? null,
      }
      this.beforeIntent?.()
      this.store.append(context.target.scope, 'AuditIntent', context.requestId, 0, intent)
      this.store.append(context.target.scope, 'AuditProofState', context.requestId, 0, {
        eventId: context.requestId, status: 'PENDING', intentHash: foundationHash(intent), receiptRef: null,
      })
      this.store.append(context.target.scope, 'MutationReceipt', context.requestId, 0, {
        payloadHash: context.payloadHash, after, auditEventId: context.requestId,
      })
      return after
    })
  }

  async deliver(scope: InstitutionalScope, eventId: string): Promise<'RECORDED'> {
    const row = this.store.get(scope, 'AuditIntent', eventId)
    if (!row) throw new Error('AUDIT_INTENT_NOT_FOUND')
    const intent = auditIntentSchema.parse(row.data)
    const stateRow = this.store.get(scope, 'AuditProofState', eventId)
    const state = receiptSchema.parse(stateRow?.data)
    if (foundationHash(intent) !== state.intentHash) throw new Error('AUDIT_INTENT_INTEGRITY_ERROR')
    if (state.status === 'RECORDED') return 'RECORDED'
    try {
      const proof = await this.proof.record(intent)
      if (proof.eventId !== eventId || proof.intentHash !== state.intentHash
        || !proof.receiptRef || !await this.proof.verify(proof.receiptRef, intent)) throw new Error('AUDIT_PROOF_INVALID')
      this.store.transaction(() => {
        const current = this.store.get(scope, 'AuditProofState', eventId)
        if (!current) throw new Error('AUDIT_STATE_NOT_FOUND')
        const parsed = receiptSchema.parse(current.data)
        if (parsed.status !== 'RECORDED') this.store.append(scope, 'AuditProofState', eventId, current.version,
          { ...parsed, status: 'RECORDED', receiptRef: proof.receiptRef })
      })
      return 'RECORDED'
    } catch (error) {
      this.authority.ports.reportFailure('AUDIT_DELIVERY_PENDING', eventId)
      throw error
    }
  }

  requireRecorded(scope: InstitutionalScope, eventId: string): void {
    const state = receiptSchema.parse(this.store.get(scope, 'AuditProofState', eventId)?.data)
    if (state.status !== 'RECORDED') this.authority.deny('AUDIT_PROOF_PENDING', eventId)
  }

  deliveryState(scope: InstitutionalScope, eventId: string): 'PENDING' | 'RECORDED' {
    return receiptSchema.parse(this.store.get(scope, 'AuditProofState', eventId)?.data).status
  }
}
