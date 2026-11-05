import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';

/**
 * An arbitration record belongs to the grievance it arises from, so writing one is an act on that case: it needs the kernel's verdict
 * that the caller may edit the case (hold it as owner, or collaborate with editing permissions), not only a steward role floor.
 */
export async function mayWriteArbitrationFor(params: { organizationId: string; grievanceId: string; userId: string }): Promise<boolean> {
  const access = await getEffectiveCaseAccess(params);
  return access.canViewCase && (access.isPrimaryOwner || access.canEditCaseNotes);
}
