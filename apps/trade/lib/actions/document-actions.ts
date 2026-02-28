/**
 * Trade Server Actions — Documents.
 *
 * Document upload for deals.
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  uploadDocumentSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeDocument,
} from '@nzila/trade-core'

export async function uploadDocument(
  data: unknown,
): Promise<TradeServiceResult<{ documentId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = uploadDocumentSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_document',
    targetEntityId: id,
    action: 'document.uploaded',
    label: `Uploaded ${parsed.data.docType} for deal ${parsed.data.dealId}`,
    metadata: {
      dealId: parsed.data.dealId,
      docType: parsed.data.docType,
      contentHash: parsed.data.contentHash,
    },
  })

  // TODO: persist document + audit entry via trade-db repository

  revalidatePath('/trade/deals')

  return { ok: true, data: { documentId: id }, error: null, auditEntries: [entry] }
}

export async function listDocumentsForDeal(
  dealId: string,
): Promise<TradeServiceResult<{ documents: TradeDocument[] }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { documents: [] },
    error: null,
    auditEntries: [],
  }
}
