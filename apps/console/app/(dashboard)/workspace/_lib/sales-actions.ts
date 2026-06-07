/**
 * Console workspace — sales/pipeline mutations (Server Actions).
 *
 * Create / update / delete partner-sourced deals against the real `deals` table.
 * Executive-created deals are attached to an internal "house" partner so the
 * `partner_id` FK is always satisfied without forcing the operator to pick one.
 * Follows the console convention: plain FormData extraction, silent no-op on
 * missing required fields, revalidatePath() to refresh dependent surfaces.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { deals as dealsTable } from '@nzila/db/schema'
import { requireWorkspaceUser, resolveWorkspaceOrgIdForUser } from './workspace-auth'
import { getHousePartnerId } from './house-partner'
import { pushDealToHubspot, pullHubspotDeals, toPushInput, type PullSummary } from './hubspot-sync'
import { PARTNER_STAGES, type PartnerStage } from './sales'

function isPartnerStage(value: string): value is PartnerStage {
  return (PARTNER_STAGES as readonly string[]).includes(value)
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function money(formData: FormData, key: string): string {
  const n = Number(formData.get(key) ?? 0)
  return (Number.isFinite(n) && n > 0 ? n : 0).toFixed(2)
}

function dateOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  return v || null
}

function revalidateSales() {
  revalidatePath('/workspace/sales')
  revalidatePath('/workspace/portfolio')
  revalidatePath('/workspace/overview')
}

/** Create a new deal. */
export async function createDeal(formData: FormData): Promise<void> {
  const userId = await requireWorkspaceUser()
  const orgId = await resolveWorkspaceOrgIdForUser(userId)

  const accountName = str(formData, 'accountName')
  const contactName = str(formData, 'contactName')
  const contactEmail = str(formData, 'contactEmail')
  const vertical = str(formData, 'vertical')
  if (!accountName || !contactName || !contactEmail || !vertical) return

  const stageInput = str(formData, 'stage')
  const stage: PartnerStage = isPartnerStage(stageInput) ? stageInput : 'registered'

  const partnerId = await getHousePartnerId()

  const [created] = await platformDb
    .insert(dealsTable)
    .values({
      partnerId,
      accountName,
      contactName,
      contactEmail,
      vertical,
      estimatedArr: money(formData, 'estimatedArr'),
      stage,
      expectedCloseDate: dateOrNull(formData, 'expectedCloseDate'),
      nzilaReviewerId: str(formData, 'owner') || null,
      notes: str(formData, 'notes') || null,
    })
    .returning()

  // Mirror to HubSpot (best-effort; no-op when unconfigured, never throws).
  if (created) await pushDealToHubspot(toPushInput(created), orgId)

  revalidateSales()
}

/** Update an existing deal. */
export async function updateDeal(formData: FormData): Promise<void> {
  const userId = await requireWorkspaceUser()
  const orgId = await resolveWorkspaceOrgIdForUser(userId)

  const dealId = str(formData, 'dealId')
  if (!dealId) return

  const accountName = str(formData, 'accountName')
  const vertical = str(formData, 'vertical')
  if (!accountName || !vertical) return

  const stageInput = str(formData, 'stage')
  const stage: PartnerStage = isPartnerStage(stageInput) ? stageInput : 'registered'

  const [saved] = await platformDb
    .update(dealsTable)
    .set({
      accountName,
      vertical,
      estimatedArr: money(formData, 'estimatedArr'),
      stage,
      expectedCloseDate: dateOrNull(formData, 'expectedCloseDate'),
      nzilaReviewerId: str(formData, 'owner') || null,
      notes: str(formData, 'notes') || null,
      updatedAt: new Date(),
    })
    .where(eq(dealsTable.id, dealId))
    .returning()

  // Mirror the change to HubSpot (best-effort; no-op when unconfigured).
  if (saved) await pushDealToHubspot(toPushInput(saved), orgId)

  revalidateSales()
}

/** Delete a deal. */
export async function deleteDeal(formData: FormData): Promise<void> {
  await requireWorkspaceUser()

  const dealId = str(formData, 'dealId')
  if (!dealId) return

  await platformDb.delete(dealsTable).where(eq(dealsTable.id, dealId))

  revalidateSales()

  // When invoked from the deal detail page, the row no longer exists — send the
  // operator back to the list instead of re-rendering into a 404. Harmless when
  // called from the list itself (navigates to the same route).
  if (str(formData, 'redirectToList') === '1') {
    redirect('/workspace/sales')
  }
}

/** Import deals from HubSpot into the Sales pipeline (manual trigger). */
export async function syncDealsFromHubspot(): Promise<PullSummary> {
  const userId = await requireWorkspaceUser()
  const orgId = await resolveWorkspaceOrgIdForUser(userId)
  const summary = await pullHubspotDeals({ orgId })
  revalidateSales()
  return summary
}
