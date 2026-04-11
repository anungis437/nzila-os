'use server'

import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/org-resolver'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getSuppliersAction(opts?: {
  limit?: number
  offset?: number
  status?: 'active' | 'inactive' | 'pending' | 'blocked'
  search?: string
}) {
  const ctx = await getReadContext()
  return listSuppliers(ctx, opts)
}

export async function getSupplierAction(supplierId: string) {
  const ctx = await getReadContext()
  return getSupplierById(ctx, supplierId)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createSupplierAction(data: {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: Record<string, unknown> | null
  paymentTerms?: string | null
  leadTimeDays?: number
  notes?: string | null
  tags?: string[]
}) {
  const ctx = await getDbContext()
  const result = await createSupplier(ctx, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'SUPPLIER_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result
}

export async function updateSupplierAction(
  supplierId: string,
  data: Partial<{
    name: string
    contactName: string | null
    email: string | null
    phone: string | null
    address: Record<string, unknown> | null
    paymentTerms: string | null
    leadTimeDays: number
    status: 'active' | 'inactive' | 'pending' | 'blocked'
    notes: string | null
    tags: string[]
  }>,
) {
  const ctx = await getDbContext()
  const result = await updateSupplier(ctx, supplierId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'SUPPLIER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { supplierId } }))
  return result
}

export async function deleteSupplierAction(supplierId: string) {
  const ctx = await getDbContext()
  const result = await deleteSupplier(ctx, supplierId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'SUPPLIER_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { supplierId } }))
  return result
}
