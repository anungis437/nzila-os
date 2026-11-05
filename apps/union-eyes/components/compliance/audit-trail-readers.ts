/**
 * Reads what /api/compliance/audit-logs answers, for the compliance administration page.
 *
 * The route returns { success, data: [entry, ...] }: the handler returns the list itself, so there is no second `data` (a list route built on
 * the crud factory would nest one). A body that is not that shape is an error for the page to report, never an empty trail. The route
 * serves who did what and when; the captured values, network address, user agent and free-form metadata stay in the store.
 */
import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';
import { asRecord, optionalDate, optionalString, requiredString } from '@/lib/client/row-fields';

export interface AuditTrailEntry {
  auditId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actor: string | null;
  severity: string | null;
  outcome: string | null;
  recordedAt: Date | null;
}

export interface AuditTrailSummary {
  total: number;
  unsuccessful: number;
  severe: number;
}

// audit_logs.created_at has a default but is nullable: a row that holds no time is shown without one, not given "now".
export function readAuditTrail(body: unknown): AuditTrailEntry[] {
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError('no list');
  return body.data.map((item, index) => {
    const row = asRecord(item, `entry ${index + 1}`);
    return {
      auditId: requiredString(row, 'auditId'),
      action: requiredString(row, 'action'),
      resourceType: requiredString(row, 'resourceType'),
      resourceId: optionalString(row, 'resourceId'),
      actor: optionalString(row, 'userId'),
      severity: optionalString(row, 'severity'),
      outcome: optionalString(row, 'outcome'),
      recordedAt: optionalDate(row, 'createdAt'),
    };
  });
}

/** Counts of the entries that were read, not of the whole trail: the route serves the most recent entries only. */
export function summarizeAuditTrail(entries: readonly AuditTrailEntry[]): AuditTrailSummary {
  return {
    total: entries.length,
    unsuccessful: entries.filter((entry) => entry.outcome !== null && entry.outcome !== 'success').length,
    severe: entries.filter((entry) => entry.severity === 'error' || entry.severity === 'critical').length,
  };
}
