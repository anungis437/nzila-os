'use server'

import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'

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
  return createSupplier(ctx, data)
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
  return updateSupplier(ctx, supplierId, data)
}

export async function deleteSupplierAction(supplierId: string) {
  const ctx = await getDbContext()
  return deleteSupplier(ctx, supplierId)
}
