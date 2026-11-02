/**
 * Attendance writes are evidence for completion and certification. A cancelled,
 * withdrawn, waitlisted, unapproved or completed registration cannot be
 * retroactively marked attended by the ordinary steward route.
 */
export type AttendanceEligibility = {
  registrationStatus: string | null;
  completed: boolean | null;
  cancellationDate: string | null;
  requiresApproval: boolean | null;
  approvedBy: string | null;
};

export function isAttendanceEditable(registration: AttendanceEligibility): boolean {
  return (
    (registration.registrationStatus === 'registered' ||
      registration.registrationStatus === 'confirmed' ||
      registration.registrationStatus === 'attended') &&
    registration.completed !== true &&
    registration.cancellationDate == null &&
    (registration.requiresApproval !== true || Boolean(registration.approvedBy))
  );
}

export function attendanceHoursForUpdate(
  attended: boolean,
  hours: number | undefined,
  existingHours: string | null,
): string | null {
  if (!attended) {
    if (hours !== undefined && hours !== 0) {
      throw new Error('Hours cannot be recorded when attendance is false');
    }
    return null;
  }
  return hours === undefined ? existingHours : hours.toFixed(2);
}
