import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';

/**
 * An arbitration record belongs to the grievance it arises from, so writing one is an act on that case: it needs the kernel's verdict
 * that the caller may edit the case (hold it as owner, or collaborate with editing permissions), not only a steward role floor.
 */
export async function mayWriteArbitrationFor(params: { organizationId: string; grievanceId: string; userId: string }): Promise<boolean> {
  const access = await getEffectiveCaseAccess(params);
  return access.canViewCase && (access.isPrimaryOwner || access.canEditCaseNotes);
}

/**
 * Reading an arbitration discloses the case it arises from, so it needs the kernel's verdict that the caller may read that case, not only
 * a steward role floor. A row with no grievance names no case anyone may read.
 */
export async function mayReadArbitrationFor(params: { organizationId: string; grievanceId: string; userId: string }): Promise<boolean> {
  return (await getEffectiveCaseAccess(params)).canViewCase === true;
}

/** The generic route's per-row read hook: the row's own grievance decides. */
export async function arbitrationRowReadable(
  row: Record<string, unknown>,
  caller: { userId: string; organizationId: string | null | undefined },
): Promise<boolean> {
  if (!caller.organizationId || typeof row.grievanceId !== 'string') return false;
  return mayReadArbitrationFor({ organizationId: caller.organizationId, grievanceId: row.grievanceId, userId: caller.userId });
}
