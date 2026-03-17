'use server'

import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '@nzila/commerce-db'
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

// Helper to construct context from Clerk auth
async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return {
    orgId: orgId,
    actorId: userId,
    actorRole: 'user',
  }
}

async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return { orgId: orgId }
}

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
