/**
 * Reads the answers of the routes the priorities screen ranks, in the shapes the routes send.
 *
 * GET /api/deadlines/overdue and /api/deadlines/upcoming are the crud factory's list of claim_deadlines: { success, data: { data: rows, pagination } }.
 * GET /api/grievances answers { success, data: rows } (an array at `data`): a full row for a case the caller owns or holds a grant for, and a trimmed
 * triage row (no title, no response deadline) for an unassigned intake.
 */
import { ApiShapeError, isRecord } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredDate, requiredString } from '@/lib/client/row-fields';

export type Urgency = 'critical' | 'high' | 'normal';

export interface DeadlineRow {
  id: string;
  claimId: string;
  deadlineName: string;
  dueDate: Date;
  priority: string | null;
}

export interface GrievanceRow {
  id: string;
  grievanceNumber: string;
  title: string | null;
  status: string;
  priority: string | null;
  responseDeadline: Date | null;
}

export function readDeadlinePage(body: unknown): { rows: DeadlineRow[]; total: number } {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.data)) throw new ApiShapeError('no list');
  const pagination = body.data.pagination;
  const total = isRecord(pagination) ? pagination.total : undefined;
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0) throw new ApiShapeError('no total');
  const rows = body.data.data.map((value): DeadlineRow => {
    const row = asRecord(value, 'deadline');
    return {
      id: requiredString(row, 'id'),
      claimId: requiredString(row, 'claimId'),
      deadlineName: requiredString(row, 'deadlineName'),
      dueDate: requiredDate(row, 'dueDate'),
      priority: optionalString(row, 'priority'),
    };
  });
  return { rows, total };
}

function dateOrNull(row: Record<string, unknown>, key: string): Date | null {
  return row[key] === null || row[key] === undefined ? null : requiredDate(row, key);
}

export function readGrievances(body: unknown): GrievanceRow[] {
  if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError('no list');
  return body.data.map((value): GrievanceRow => {
    const row = asRecord(value, 'grievance');
    return {
      id: requiredString(row, 'id'),
      grievanceNumber: requiredString(row, 'grievanceNumber'),
      title: optionalString(row, 'title'),
      status: requiredString(row, 'status'),
      priority: optionalString(row, 'priority'),
      responseDeadline: dateOrNull(row, 'responseDeadline'),
    };
  });
}
