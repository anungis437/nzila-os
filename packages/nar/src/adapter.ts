import type { DecisionProofAdapter } from '@nzila/decision-core'
import type { NarProofAdapterOptions } from './types'
import { createNarRecord } from './record'
import { uploadNarToAzureImmutableBlob } from './storage/azure-blob'

export function createNarProofAdapter(options: NarProofAdapterOptions): DecisionProofAdapter {
  return {
    async createProof(decision, context) {
      const previousHash = await options.getPreviousHash(decision.organizationId)
      const secret = options.getSigningSecret ? await options.getSigningSecret() : undefined
      const persistImmutableStorage = options.persistImmutableStorage ?? ((record) => uploadNarToAzureImmutableBlob(record, options.retentionYears ?? 7))

      const narWithoutStorage = await createNarRecord({
        decision,
        decisionType: context.decisionType,
        actionType: context.actionType,
        previousHash,
        isGenesis: !previousHash,
        keyId: options.keyId,
        secret,
      })

      const storage = await persistImmutableStorage(narWithoutStorage)

      const narRecord = await createNarRecord({
        recordId: narWithoutStorage.id,
        decision,
        decisionType: context.decisionType,
        actionType: context.actionType,
        previousHash,
        isGenesis: !previousHash,
        createdAt: narWithoutStorage.createdAt,
        keyId: options.keyId,
        secret,
        storage,
      })

      const persisted = await options.persistRecord(narRecord)

      return {
        auditRecordId: persisted.auditRecordId,
        hash: narRecord.seal.hash,
        signature: narRecord.seal.signature,
        previousHash: narRecord.seal.previousHash,
        verified: true,
      }
    },
  }
}
