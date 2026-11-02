import { describe, expect, it } from 'vitest';
import { attendanceHoursForUpdate, isAttendanceEditable } from '../attendance-policy';

const active = {
  registrationStatus: 'registered',
  completed: false,
  cancellationDate: null,
  requiresApproval: false,
  approvedBy: null,
};

describe('education attendance mutation eligibility', () => {
  it.each(['registered', 'confirmed', 'attended'])('permits active %s registration', status => {
    expect(isAttendanceEditable({ ...active, registrationStatus: status })).toBe(true);
  });

  it.each(['cancelled', 'withdrawn', 'waitlisted', 'completed', 'no_show', '', null])(
    'refuses inactive or unknown status %s', status => {
      expect(isAttendanceEditable({ ...active, registrationStatus: status })).toBe(false);
    },
  );

  it('refuses completed or cancelled records even if status remains registered', () => {
    expect(isAttendanceEditable({ ...active, completed: true })).toBe(false);
    expect(isAttendanceEditable({ ...active, completed: null })).toBe(false);
    expect(isAttendanceEditable({ ...active, cancellationDate: '2026-11-02' })).toBe(false);
  });

  it('requires recorded approval for registrations that need approval', () => {
    expect(isAttendanceEditable({ ...active, requiresApproval: true })).toBe(false);
    expect(isAttendanceEditable({ ...active, requiresApproval: null })).toBe(false);
    expect(isAttendanceEditable({ ...active, requiresApproval: true, approvedBy: 'officer-a' })).toBe(true);
  });

  it('clears hours on absence and refuses contradictory hour assertions', () => {
    expect(attendanceHoursForUpdate(false, undefined, '4.00')).toBeNull();
    expect(attendanceHoursForUpdate(false, 0, '4.00')).toBeNull();
    expect(() => attendanceHoursForUpdate(false, 2, '4.00')).toThrow();
  });

  it('preserves previously recorded hours unless explicitly replaced', () => {
    expect(attendanceHoursForUpdate(true, undefined, '3.50')).toBe('3.50');
    expect(attendanceHoursForUpdate(true, 1.25, '3.50')).toBe('1.25');
    expect(attendanceHoursForUpdate(true, 0, null)).toBe('0.00');
  });
});
