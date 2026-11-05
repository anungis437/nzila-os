import { describe, expect, it } from 'vitest';
import { assertEducationRegistrationCreated, readEducationCrudRows } from '../crud-response';

const courseId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const row = { id: '33333333-3333-4333-8333-333333333333', courseId, sessionId };

describe('education CRUD response integrity', () => {
  it('reads only the actual nested paginated CRUD collection', () => {
    expect(readEducationCrudRows({ success: true, data: { data: [row], pagination: { total: 1 } } }))
      .toEqual([row]);
    expect(readEducationCrudRows({ success: true, data: { data: [] } })).toEqual([]);
  });
  it.each([
    { success: true, data: [] },
    { success: true, data: { pagination: { total: 0 } } },
    { success: false, data: { data: [row] } },
    { success: true, data: { data: 'not rows' } },
    null,
  ])('rejects malformed or deceptive list envelopes', bad => {
    expect(() => readEducationCrudRows(bad)).toThrow();
  });
  it('requires the created registration identity and exact selected course/session', () => {
    expect(() => assertEducationRegistrationCreated({ success: true, data: { data: row } }, courseId, sessionId))
      .not.toThrow();
    for (const bad of [
      { success: true, data: row },
      { success: true, data: { data: { ...row, sessionId: courseId } } },
      { success: true, data: { data: { ...row, courseId: 'foreign' } } },
      { success: true, data: { data: { courseId, sessionId } } },
      { success: false, data: { data: row } },
      null,
    ]) expect(() => assertEducationRegistrationCreated(bad, courseId, sessionId)).toThrow();
  });
});
