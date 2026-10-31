/**
 * Cross-route calendar event privacy policy.
 * Organization membership alone does not authorize reading another member's
 * personal calendar or a private/confidential event.
 */
export interface CalendarAccessRow {
  organizerId: string;
  isPrivate: boolean | null;
  visibility: string | null;
  calendarOwnerId: string;
  calendarIsPersonal: boolean | null;
}
export function canSeeCalendarEvent(row: CalendarAccessRow, userId: string): boolean {
  if (row.calendarIsPersonal !== false && row.calendarOwnerId !== userId) return false;
  if ((row.isPrivate || row.visibility === 'private' || row.visibility === 'confidential')
      && row.organizerId !== userId) return false;
  return true;
}
export function canModifyCalendarEvent(row: CalendarAccessRow, userId: string): boolean {
  return canSeeCalendarEvent(row, userId) && row.organizerId === userId;
}
