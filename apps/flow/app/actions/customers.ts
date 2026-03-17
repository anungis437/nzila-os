'use server'

import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@nzila/commerce-db'
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

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
  return createCustomer(ctx, data)
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
  return updateCustomer(ctx, customerId, data)
}

export async function deleteCustomerAction(customerId: string) {
  const ctx = await getDbContext()
  return deleteCustomer(ctx, customerId)
}
