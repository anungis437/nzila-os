import { describe, expect, it } from 'vitest';
import { creatorRetainsAccess } from './creator-access';

const base = { createdBy: 'u1', userId: 'u1', unionRepId: 'u2', callerIsRepresentative: false };

describe('creator access', () => {
  it('never grants access to someone who did not create the matter', () => {
    expect(creatorRetainsAccess({ ...base, userId: 'u9' })).toBe(false);
    expect(creatorRetainsAccess({ ...base, createdBy: null })).toBe(false);
    expect(creatorRetainsAccess({ ...base, createdBy: undefined })).toBe(false);
  });

  it('lets a member keep the view of the matter they filed, whoever is assigned', () => {
    expect(creatorRetainsAccess(base)).toBe(true);
    expect(creatorRetainsAccess({ ...base, unionRepId: null })).toBe(true);
  });

  it('lets a representative-creator keep access while unassigned or while still the representative', () => {
    expect(creatorRetainsAccess({ ...base, callerIsRepresentative: true, unionRepId: null })).toBe(true);
    expect(creatorRetainsAccess({ ...base, callerIsRepresentative: true, unionRepId: 'u1' })).toBe(true);
  });

  it('ends a representative-creator access once the matter is reassigned', () => {
    expect(creatorRetainsAccess({ ...base, callerIsRepresentative: true, unionRepId: 'u2' })).toBe(false);
  });
});
