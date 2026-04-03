'use server'

import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getCustomersAction(opts?: {
  limit?: number
  offset?: number
  status?: string
  search?: string
}) {
  const ctx = await getReadContext()
  return listCustomers(ctx, opts)
}

export async function getCustomerAction(customerId: string) {
  const ctx = await getReadContext()
  return getCustomerById(ctx, customerId)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createCustomerAction(data: {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  shippingAddress?: Record<string, unknown> | null
  billingAddress?: Record<string, unknown> | null
  notes?: string | null
}) {
  const ctx = await getDbContext()
  const result = await createCustomer(ctx, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'CUSTOMER_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result
}

export async function updateCustomerAction(
  customerId: string,
  data: Partial<{
    name: string
    email: string | null
    phone: string | null
    company: string | null
    shippingAddress: Record<string, unknown> | null
    billingAddress: Record<string, unknown> | null
    status: string
    notes: string | null
  }>,
) {
  const ctx = await getDbContext()
  const result = await updateCustomer(ctx, customerId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'CUSTOMER_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { customerId } }))
  return result
}

export async function deleteCustomerAction(customerId: string) {
  const ctx = await getDbContext()
  const result = await deleteCustomer(ctx, customerId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'CUSTOMER_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { customerId } }))
  return result
}
