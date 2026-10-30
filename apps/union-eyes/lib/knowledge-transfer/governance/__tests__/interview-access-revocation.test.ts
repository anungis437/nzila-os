import { describe, expect, it } from 'vitest';
import { canReadInterview, type InterviewReader } from '../interview-access';

const steward: InterviewReader = {
  userId: 'steward-1', stewardPlus: true, levels: new Set(['public_internal', 'restricted']),
};
const author: InterviewReader = {
  userId: 'author-1', stewardPlus: true, levels: new Set(['public_internal', 'restricted']),
};
const admin: InterviewReader = {
  userId: 'admin-1', stewardPlus: true,
  levels: new Set(['public_internal', 'restricted', 'privileged', 'legal_sensitive', 'executive_confidential']),
};
const subject = { status: 'published', createdBy: 'author-1', sensitivityLevel: 'restricted', consentGranted: false };

describe('exit interview consent revocation — direct and list parity', () => {
  it.each([steward, author, admin])('blocks published text despite steward/author/administrator status', reader => {
    expect(canReadInterview(subject, reader)).toBe(false);
    expect(canReadInterview({ ...subject, status: 'archived' }, reader)).toBe(false);
  });
  it('permits published copy only with actual consent AND the required sensitivity', () => {
    expect(canReadInterview({ ...subject, consentGranted: true }, steward)).toBe(true);
    const member: InterviewReader = { userId: 'member', stewardPlus: false, levels: new Set(['public_internal']) };
    expect(canReadInterview({ ...subject, consentGranted: true }, member)).toBe(false);
  });
  it('lets author work on an unpublished draft, without implying consent to publish', () => {
    expect(canReadInterview({ ...subject, status: 'draft' }, author)).toBe(true);
    expect(canReadInterview({ ...subject, status: 'draft' }, steward)).toBe(true);
  });
});
