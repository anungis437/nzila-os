/**
 * Console workspace — funding / grants mutations (Server Actions).
 *
 * Create / update / delete grant applications against the real `grants` table,
 * scoped to the executive org (or the stable fallback org when none resolves).
 * Follows the console convention: plain FormData extraction, silent no-op on
 * missing required fields, revalidatePath() to refresh dependent surfaces.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { grants } from '@nzila/db/schema'
import { requireWorkspaceUser } from './workspace-auth'
import { resolveFundingOrgId } from './funding'

const GRANT_STATUSES = [
  'prospecting',
  'drafting',
  'submitted',
  'awarded',
  'rejected',
  'reporting',
  'closed',
] as const
type GrantStatus = (typeof GRANT_STATUSES)[number]

function isGrantStatus(value: string): value is GrantStatus {
  return (GRANT_STATUSES as readonly string[]).includes(value)
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

/** Numeric column value, or null when blank/invalid (amounts are nullable). */
function moneyOrNull(formData: FormData, key: string): string | null {
  const raw = str(formData, key)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null
}

function dateOrNull(formData: FormData, key: string): string | null {
  return str(formData, key) || null
}

function revalidateFunding() {
  revalidatePath('/workspace/portfolio')
  revalidatePath('/workspace/overview')
}

/** Create a new grant application. */
export async function createGrant(formData: FormData): Promise<void> {
  await currentUser()
  await requireWorkspaceUser()

  const programName = str(formData, 'programName')
  if (!programName) return

  const statusInput = str(formData, 'status')
  const status: GrantStatus = isGrantStatus(statusInput) ? statusInput : 'prospecting'

  const organizationId = await resolveFundingOrgId()

  await platformDb.insert(grants).values({
    organizationId,
    programName,
    grantor: str(formData, 'grantor') || null,
    status,
    amountRequested: moneyOrNull(formData, 'amountRequested'),
    amountAwarded: moneyOrNull(formData, 'amountAwarded'),
    amountDrawnDown: moneyOrNull(formData, 'amountDrawnDown'),
    currency: str(formData, 'currency') || 'CAD',
    applicationDeadline: dateOrNull(formData, 'applicationDeadline'),
    decisionDate: dateOrNull(formData, 'decisionDate'),
    reportDueDate: dateOrNull(formData, 'reportDueDate'),
    owner: str(formData, 'owner') || null,
    productKey: str(formData, 'productKey') || null,
    notes: str(formData, 'notes') || null,
  })

  revalidateFunding()
}

/** Update an existing grant application. */
export async function updateGrant(formData: FormData): Promise<void> {
  await currentUser()
  await requireWorkspaceUser()

  const grantId = str(formData, 'grantId')
  if (!grantId) return

  const programName = str(formData, 'programName')
  if (!programName) return

  const statusInput = str(formData, 'status')
  const status: GrantStatus = isGrantStatus(statusInput) ? statusInput : 'prospecting'

  await platformDb
    .update(grants)
    .set({
      programName,
      grantor: str(formData, 'grantor') || null,
      status,
      amountRequested: moneyOrNull(formData, 'amountRequested'),
      amountAwarded: moneyOrNull(formData, 'amountAwarded'),
      amountDrawnDown: moneyOrNull(formData, 'amountDrawnDown'),
      currency: str(formData, 'currency') || 'CAD',
      applicationDeadline: dateOrNull(formData, 'applicationDeadline'),
      decisionDate: dateOrNull(formData, 'decisionDate'),
      reportDueDate: dateOrNull(formData, 'reportDueDate'),
      owner: str(formData, 'owner') || null,
      productKey: str(formData, 'productKey') || null,
      notes: str(formData, 'notes') || null,
      updatedAt: new Date(),
    })
    .where(eq(grants.id, grantId))

  revalidateFunding()
}

/** Delete a grant application. */
export async function deleteGrant(formData: FormData): Promise<void> {
  await currentUser()
  await requireWorkspaceUser()

  const grantId = str(formData, 'grantId')
  if (!grantId) return

  await platformDb.delete(grants).where(eq(grants.id, grantId))

  revalidateFunding()
}
