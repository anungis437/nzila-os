'use server'

/**
 * Supplier Server Actions
 *
 * Next.js server actions for supplier management.
 */

import { auth } from '@clerk/nextjs/server'
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
  input: Omit<CreateSupplierInput, 'entityId'>,
): Promise<ActionResult<typeof commerceSuppliers.$inferSelect>> {
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // In production, get entityId from user's organization
    const entityId = userId // Replace with actual entity lookup

    const supplier = await createSupplier({ ...input, entityId })

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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const entityId = userId // Replace with actual entity lookup

    const suppliers = await listSuppliers({ entityId, ...filter })

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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

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
  const { userId } = await auth()
  if (!userId) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // Note: In production, initialize ZohoBooksClient with proper credentials
    // const booksClient = new ZohoBooksClient(entityId, accessToken, organizationId)
    // const zohoVendorId = await syncSupplierToZoho(supplierId, booksClient)

    return { success: false, error: 'Zoho sync not configured. Please connect your Zoho account.' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync supplier to Zoho',
    }
  }
}
