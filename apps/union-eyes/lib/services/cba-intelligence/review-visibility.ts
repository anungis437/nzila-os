import { isPlatformAdminUser } from '@/lib/api-auth-guard'

/**
 * Which extraction rows a reader may see. Extracted agreements, wage adjustments and clauses are machine output until a reviewer
 * approves them, so a reader sees only approved rows. The dataset is shared by every organization and holds no organization's own
 * data, so who may read what is a property of the dataset, not of an organization's role titles: only the platform staff who curate
 * it may name any review status, and an organization's steward or administrator is a reader like any other.
 */
export const APPROVED = 'approved' as const

/**
 * Authority over the CBA intelligence dataset, stated once so the source says who curates it and who may read it.
 * `readerScopeApprovedBy` stays null until the institution decides which organizations may read the shared dataset; until then
 * the narrowest scope the product already sells applies (the commercial reporting entitlement, approved rows only).
 */
export const CBA_DATASET_AUTHORITY = Object.freeze({
  scope: 'platform_shared',
  holdsTenantData: false,
  curator: 'platform_staff',
  readers: Object.freeze({ entitlement: 'commercial_reporting', floor: 'member', sees: APPROVED }),
  unreviewedVisibleTo: 'platform_staff',
  readerScopeApprovedBy: null as string | null,
})

/** Whether this caller curates the dataset and may therefore read rows no reviewer has approved. */
export async function canReadUnreviewed(userId: string | null | undefined): Promise<boolean> {
  return Boolean(userId) && (await isPlatformAdminUser(userId as string))
}

export function reviewStatusFilter(isCurator: boolean, requested: string | undefined): string | undefined {
  return isCurator ? requested : APPROVED
}
