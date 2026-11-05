import { stewardAssignments } from '@/db/schema';

/**
 * Steward directory policy.
 *
 * A steward assignment row carries the steward's personal phone number, free-text notes and a link to a grievance.
 * Every member of the organization may find out who their steward is and how to reach them at work; the rest is for
 * officers, who administer the assignments.
 */
export type StewardAssignmentRow = typeof stewardAssignments.$inferSelect;

/** Fields a member may see: who covers which area, the tenure, and the work contact the steward chose to publish. */
export const MEMBER_DIRECTORY_FIELDS = [
  'id',
  'stewardId',
  'stewardType',
  'status',
  'unitId',
  'worksiteId',
  'department',
  'shift',
  'floor',
  'area',
  'startDate',
  'endDate',
  'isInterim',
  'responsibilityAreas',
  'workPhone',
  'preferredContactMethod',
] as const satisfies ReadonlyArray<keyof StewardAssignmentRow>;

export type MemberDirectoryEntry = Pick<StewardAssignmentRow, (typeof MEMBER_DIRECTORY_FIELDS)[number]>;

/** Allow-list projection: a column added to the table later is withheld from members until it is listed above. */
export function toMemberDirectoryEntry(row: StewardAssignmentRow): MemberDirectoryEntry {
  const entry: Record<string, unknown> = {};
  for (const field of MEMBER_DIRECTORY_FIELDS) entry[field] = row[field];
  return entry as MemberDirectoryEntry;
}
