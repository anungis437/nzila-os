import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

interface WorkbenchRouteCase { claimId: string; organizationId: string; access: 'case' | 'triage'; canAssign: boolean }

function readWorkbenchRouteCase(value: unknown): WorkbenchRouteCase {
  if (!isRecord(value) || typeof value.claimId !== 'string' || !UUID.test(value.claimId) ||
    typeof value.organizationId !== 'string' || !UUID.test(value.organizationId) ||
    !(value.access === 'case' || value.access === 'triage') || typeof value.canAssign !== 'boolean')
    throw new ApiShapeError('workbench case standing');
  return { claimId: value.claimId, organizationId: value.organizationId, access: value.access, canAssign: value.canAssign };
}

/** Presentation only: these rows have already passed the queue's live case or triage decisions. */
export function readWorkbenchRouteAccess(value: unknown): boolean {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data) || !Array.isArray(value.data.claims)) return false;
  const rows = value.data.claims.map(readWorkbenchRouteCase);
  return rows.length > 0;
}

export async function verifyWorkbenchRouteAccess(signal: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/workbench/assigned', { cache: 'no-store', signal });
  if (!response.ok) return false;
  const data: unknown = await response.json();
  return readWorkbenchRouteAccess(data);
}
