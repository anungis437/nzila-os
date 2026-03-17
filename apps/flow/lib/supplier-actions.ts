'use server'

/**
 * Supplier Server Actions
 *
 * Next.js server actions for supplier management.
 */

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  deleteSupplier,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierWithStats,
  type SupplierStatus,
} from './supplier-service'
import { commerceSuppliers } from '@nzila/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function createSupplierAction(
  input: Omit<CreateSupplierInput, 'orgId'>,
): Promise<ActionResult<typeof commerceSuppliers.$inferSelect>> {
  const ctx = await resolveOrgContext()

  try {
    const supplier = await createSupplier({ ...input, orgId: ctx.orgId })

    revalidatePath('/suppliers')

    return { success: true, data: supplier }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create supplier',
    }
  }
}

export async function getSupplierAction(
  supplierId: string,
): Promise<ActionResult<SupplierWithStats>> {
  await resolveOrgContext()

  try {
    const data = await getSupplier(supplierId)
    if (!data) {
      return { success: false, error: 'Supplier not found' }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get supplier',
    }
  }
}

export async function listSuppliersAction(filter?: {
  status?: SupplierStatus | SupplierStatus[]
  search?: string
  tags?: string[]
}): Promise<ActionResult<SupplierWithStats[]>> {
  const ctx = await resolveOrgContext()

  try {
    const suppliers = await listSuppliers({ orgId: ctx.orgId, ...filter })

    return { success: true, data: suppliers }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list suppliers',
    }
  }
}

export async function updateSupplierAction(
  supplierId: string,
  input: UpdateSupplierInput,
): Promise<ActionResult<typeof commerceSuppliers.$inferSelect>> {
  await resolveOrgContext()

  try {
    const supplier = await updateSupplier(supplierId, input)
    if (!supplier) {
      return { success: false, error: 'Supplier not found' }
    }

    revalidatePath('/suppliers')
    revalidatePath(`/suppliers/${supplierId}`)

    return { success: true, data: supplier }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update supplier',
    }
  }
}

export async function deleteSupplierAction(supplierId: string): Promise<ActionResult<boolean>> {
  await resolveOrgContext()

  try {
    await deleteSupplier(supplierId)

    revalidatePath('/suppliers')

    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete supplier',
    }
  }
}

export async function syncSupplierToZohoAction(_supplierId: string): Promise<ActionResult<string>> {
  await resolveOrgContext()

  try {
    // Note: In production, initialize ZohoBooksClient with proper credentials
    // const booksClient = new ZohoBooksClient(orgId, accessToken, organizationId)
    // const zohoVendorId = await syncSupplierToZoho(supplierId, booksClient)

    return { success: false, error: 'Zoho sync not configured. Please connect your Zoho account.' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync supplier to Zoho',
    }
  }
}
