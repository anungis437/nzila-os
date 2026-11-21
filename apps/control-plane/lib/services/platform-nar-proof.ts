import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import {
  findPreviousAuditHash,
  persistAuditRecord,
} from '@/lib/repositories/audit-record-repository'

export function createPlatformNarProofAdapter() {
  return createNarProofAdapter({
    keyId: process.env.NAR_SIGNING_KEY_ID,
    getPreviousHash: async (organizationId) =>
      (await findPreviousAuditHash(organizationId))[0]?.hash,
    persistRecord: async (record) => {
      await persistAuditRecord(record)
      return { auditRecordId: record.id }
    },
    getSigningSecret: getNarSigningSecret,
  })
}
