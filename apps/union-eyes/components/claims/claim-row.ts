/**
 * A case as the claims list shows it, read from what GET /api/cases lists (lib/cases/case-list.ts).
 *
 * The route's answer is the rows of a case the caller may read in full and, for a caller who triages, the rows of the unassigned queue, which carry no member and no assignee by design.
 * A column the database can leave empty is null here, and a screen shows it as nothing: no member name, assignee or date is made up for it, and a row without the columns the database
 * never leaves empty is an error the screen reports, not a row to complete.
 */
import { asRecord, optionalDate, optionalString, requiredDate, requiredString } from '@/lib/client/row-fields';

export interface ClaimRow {
  claimId: string;
  claimNumber: string | null;
  /** The member the case is from, named by the route; null in the triage queue, which shows no member. */
  memberName: string | null;
  claimType: string | null;
  status: string;
  priority: string;
  incidentDate: Date | null;
  createdAt: Date;
  /** Somebody holds the case. */
  assigned: boolean;
  /** The assignee's name; null when the case is unassigned, or when its assignee is no longer a member of the organization. */
  assignedToName: string | null;
  /** The row comes from the triage queue: metadata only. */
  triageOnly: boolean;
}

export function readClaimRow(value: unknown): ClaimRow {
  const row = asRecord(value, 'case');
  return {
    claimId: requiredString(row, 'claimId'),
    claimNumber: optionalString(row, 'claimNumber'),
    memberName: optionalString(row, 'memberName'),
    claimType: optionalString(row, 'claimType'),
    status: requiredString(row, 'status'),
    priority: requiredString(row, 'priority'),
    incidentDate: optionalDate(row, 'incidentDate'),
    createdAt: requiredDate(row, 'createdAt'),
    assigned: optionalString(row, 'assignedTo') !== null,
    assignedToName: optionalString(row, 'assignedToName'),
    triageOnly: row.triageOnly === true,
  };
}
