import { describe, expect, it } from 'vitest';
import { canReadInterview, type InterviewReader } from '../interview-access';

// The list predicate (interviewListCondition) is the same rule in SQL; it runs against real SQL in
// app/api/__tests__/exit-interviews-read-gates.pglite.test.ts.

const ALL_LEVELS = ['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential'];
const member: InterviewReader = { userId: 'member-1', stewardPlus: false, levels: new Set(['public_internal']) };
const steward: InterviewReader = { userId: 'steward-1', stewardPlus: true, levels: new Set(['public_internal', 'restricted']) };
const admin: InterviewReader = { userId: 'admin-1', stewardPlus: true, levels: new Set(ALL_LEVELS) };
const authorAdmin: InterviewReader = { ...admin, userId: 'author-1' };
const authorMember: InterviewReader = { ...member, userId: 'author-1' };

const withdrawn = { status: 'published', createdBy: 'author-1', sensitivityLevel: 'public_internal', consentGranted: false };

describe('canReadInterview', () => {
  it.each(['published', 'archived'])('a %s interview without consent is read by nobody, author and administrator included', (status) => {
    for (const reader of [member, steward, admin, authorAdmin, authorMember]) {
      expect(canReadInterview({ ...withdrawn, status }, reader)).toBe(false);
    }
  });

  it('a finished interview with consent is read at the reader\'s level only, by an author too', () => {
    const consented = { ...withdrawn, consentGranted: true };
    expect(canReadInterview(consented, member)).toBe(true);
    expect(canReadInterview({ ...consented, sensitivityLevel: 'restricted' }, member)).toBe(false);
    expect(canReadInterview({ ...consented, sensitivityLevel: 'restricted' }, authorMember)).toBe(false);
    expect(canReadInterview({ ...consented, sensitivityLevel: 'restricted' }, steward)).toBe(true);
  });

  it('an unfinished interview stays with its author at any level and with stewards-or-above at their level', () => {
    const draft = { ...withdrawn, status: 'draft', sensitivityLevel: 'privileged' };
    expect(canReadInterview(draft, authorMember)).toBe(true);
    expect(canReadInterview(draft, steward)).toBe(false);
    expect(canReadInterview(draft, admin)).toBe(true);
    expect(canReadInterview(draft, member)).toBe(false);
  });
});
