import { db } from '@/db';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { appendPublicIntakeAudit, type PublicIntakeOperation } from '@/lib/public-intake/intake-audit';
import type { ClaimedWorkbookAuthority } from '@/lib/workbook/access-control';

interface WorkbookAuditEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
}

/**
 * What a pseudonymous record may carry: names of fields and counts, never a value. The workbook names people who have no notice that they
 * are recorded, so a role, a name or a note never goes into evidence about who looked at them.
 */
const PSEUDONYMOUS_DETAIL_KEYS = new Set(['fields', 'holderCount', 'format', 'bytes', 'authority']);

function operationOf(action: string): PublicIntakeOperation {
  if (action.includes('.create')) return 'create';
  if (action.includes('.update')) return 'update';
  if (action.includes('.delete')) return 'delete';
  return 'read';
}

async function recordPreclaim(authority: ClaimedWorkbookAuthority, entry: WorkbookAuditEntry, operation: PublicIntakeOperation): Promise<void> {
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry.details)) if (PSEUDONYMOUS_DETAIL_KEYS.has(key)) details[key] = value;
  await appendPublicIntakeAudit(db as unknown as RLSTx, {
    surface: entry.action.split('.').slice(0, 2).join('.'),
    action: entry.action,
    operation,
    subjectKind: 'unclaimed_workbook',
    subjectId: authority.workbookId,
    // The workbook identifier is the credential: it is never written, so a record about the workbook itself carries no resource reference.
    resourceRef: entry.resourceId === authority.workbookId ? null : entry.resourceId,
    details,
  });
}

async function recordClaimed(authority: ClaimedWorkbookAuthority, entry: WorkbookAuditEntry): Promise<void> {
  if (!authority.actorUserId || !authority.claimedOrgId) {
    throw new Error('A claimed workbook access has no organization to record its audit under.');
  }
  await persistAtomicAudit(db as unknown as RLSTx, {
    organizationId: authority.claimedOrgId,
    userId: authority.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: { workbookId: authority.workbookId, ...entry.details },
  });
}

/**
 * Records a write to a workbook's identity-linked data on the executor the access boundary established, so the write and its audit row
 * commit or roll back together. Call it inside the `withClaimedWorkbookAccess` callback.
 *
 * A claimed workbook is recorded under the claiming organization and the acting person; one with no organization to attribute to fails
 * closed. An unclaimed workbook has neither, and none is invented: it is recorded in the platform's append-only public-intake audit under
 * a keyed pseudonymous reference (see lib/public-intake/intake-audit.ts), and fails closed when that cannot be written.
 */
export async function auditClaimedWorkbookWrite(authority: ClaimedWorkbookAuthority, entry: WorkbookAuditEntry): Promise<void> {
  if (authority.kind === 'preclaim') return recordPreclaim(authority, entry, operationOf(entry.action));
  return recordClaimed(authority, entry);
}

/**
 * Records a read of the people a workbook names, BEFORE the data is read, in the same transaction: if the record cannot be written the
 * read does not happen. Claimed and unclaimed workbooks are recorded as in `auditClaimedWorkbookWrite`.
 */
export async function auditWorkbookRead(authority: ClaimedWorkbookAuthority, entry: WorkbookAuditEntry): Promise<void> {
  if (authority.kind === 'preclaim') return recordPreclaim(authority, entry, 'read');
  return recordClaimed(authority, entry);
}
