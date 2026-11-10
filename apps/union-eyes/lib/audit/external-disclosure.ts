import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'

/**
 * Records that identifying data left the application boundary to a named external processor.
 * This is a disclosure RECORD, not a consent or disclosure DECISION: it does not gate, permit or
 * forbid the send it describes, and it must be written in the same transaction as (or immediately
 * after) the call it documents, never instead of one. `dataClasses` names categories (e.g.
 * "organization_id", "member_user_id", "email"), never the raw disclosed values themselves, so the
 * audit trail cannot become a second copy of the disclosed PII.
 */
export async function recordExternalDisclosure(
  tx: RLSTx,
  entry: {
    organizationId: string
    userId?: string | null
    processor: string
    resourceType: string
    resourceId?: string | null
    dataClasses: string[]
    purpose: string
    merchantOfRecord?: string
  },
): Promise<void> {
  await persistAtomicAudit(tx, {
    organizationId: entry.organizationId,
    userId: entry.userId ?? null,
    action: `external_disclosure.${entry.processor}`,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    details: {
      processor: entry.processor,
      dataClasses: entry.dataClasses,
      purpose: entry.purpose,
      ...(entry.merchantOfRecord ? { merchantOfRecord: entry.merchantOfRecord } : {}),
    },
  })
}
