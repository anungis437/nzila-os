import 'server-only'
import { createNarRecord, getNarSigningSecret, uploadNarToAzureImmutableBlob } from '@nzila/nar'
import type { DecisionRecord } from '@nzila/decision-core'
import { findPreviousAuditHash, persistAuditRecord, listAuditRecords } from '../repositories/audit-record-repository'

export async function recordDecisionProof(input: {
  decision: DecisionRecord
  decisionType: string
  actionType: string
}, orgHeader: string) {
  const previous = await findPreviousAuditHash(orgHeader)
  const narWithoutStorage = await createNarRecord({
    decision: input.decision,
    decisionType: input.decisionType,
    actionType: input.actionType,
    previousHash: previous[0]?.hash,
    isGenesis: !previous[0]?.hash,
    keyId: process.env.NAR_SIGNING_KEY_ID,
    secret: await getNarSigningSecret(),
  })
  const storage = await uploadNarToAzureImmutableBlob(narWithoutStorage)
  const nar = await createNarRecord({
    recordId: narWithoutStorage.id,
    decision: input.decision,
    decisionType: input.decisionType,
    actionType: input.actionType,
    previousHash: previous[0]?.hash,
    isGenesis: !previous[0]?.hash,
    createdAt: narWithoutStorage.createdAt,
    keyId: process.env.NAR_SIGNING_KEY_ID,
    secret: await getNarSigningSecret(),
    storage,
  })
  await persistAuditRecord(nar)
  return nar
}

export async function getAuditRecordHistory(orgId: string, resourceId: string | null) {
  return listAuditRecords(orgId, resourceId)
}
