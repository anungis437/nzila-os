import { describe, expect, it } from 'vitest';
import { buildMembersFetchUrl } from '../build-members-fetch-url';

describe('buildMembersFetchUrl', () => {
  it('calls the single authoritative /api/members endpoint with no org id when auto', () => {
    expect(buildMembersFetchUrl('auto')).toBe('/api/members');
  });

  it('includes an explicit organizationId query param when provided', () => {
    expect(buildMembersFetchUrl('org-123')).toBe('/api/members?organizationId=org-123');
  });

  it('URL-encodes an organization id containing special characters', () => {
    expect(buildMembersFetchUrl('org/with space')).toBe(
      '/api/members?organizationId=org%2Fwith%20space',
    );
  });

  it('never targets the legacy /api/organization/members or /api/organizations/:id/members fallback endpoints', () => {
    const autoUrl = buildMembersFetchUrl('auto');
    const scopedUrl = buildMembersFetchUrl('org-123');
    for (const url of [autoUrl, scopedUrl]) {
      expect(url).not.toContain('/api/organization/members');
      expect(url).not.toMatch(/\/api\/organizations\/.+\/members/);
    }
  });
});
