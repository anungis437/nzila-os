import { describe, expect, it } from 'vitest';
import { buildEducationEnrollment, type EnrollmentSession } from '../enrollment-selection';

const courseId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const active: EnrollmentSession = {
  id: sessionId, courseId, sessionStatus: 'scheduled',
  registrationOpenDate: '2026-11-01', registrationCloseDate: '2026-11-10',
  maxEnrollment: 10, registrationCount: 3,
};

describe('education enrollment session identity', () => {
  it('submits the selected real session id, never the course id or client member authority', () => {
    expect(buildEducationEnrollment(courseId, sessionId, [active], '2026-11-02'))
      .toEqual({ courseId, sessionId });
    expect(() => buildEducationEnrollment(courseId, courseId, [active], '2026-11-02'))
      .toThrow('Select an available session');
  });
  it.each([
    ['wrong course', { courseId: 'foreign' }],
    ['cancelled', { sessionStatus: 'cancelled' }],
    ['not yet open', { registrationOpenDate: '2026-11-03' }],
    ['closed', { registrationCloseDate: '2026-11-01' }],
    ['full', { registrationCount: 10 }],
    ['over capacity', { registrationCount: 11 }],
  ])('refuses %s without a registration request', (_label, override) => {
    expect(() => buildEducationEnrollment(courseId, sessionId, [{ ...active, ...override }], '2026-11-02'))
      .toThrow('Select an available session');
  });
  it('refuses missing sessions and accepts inclusive registration-window boundaries', () => {
    expect(() => buildEducationEnrollment(courseId, sessionId, [], '2026-11-02')).toThrow();
    expect(buildEducationEnrollment(courseId, sessionId, [active], '2026-11-01')).toEqual({ courseId, sessionId });
    expect(buildEducationEnrollment(courseId, sessionId, [active], '2026-11-10')).toEqual({ courseId, sessionId });
  });
});
