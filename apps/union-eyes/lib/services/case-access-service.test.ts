import { describe, expect, it } from 'vitest';

import { collaboratorPermissions, validateCaseAccessGrantTerms } from './case-access-service';

// Grant terms are pure policy. Who may grant, read or revoke is decided by the authority kernel and proven against real
// kernel storage in case-access-service.pglite.test.ts.
describe('case-access grant terms', () => {
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

  it('enforces expiry and role-scope terms', async () => {
    const { validateCaseAccessGrantTerms } = await import('./case-access-service');

    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer' })).toMatchObject({ code: 'EXPIRY_REQUIRED' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'secondary_lro', canViewPrivateDocuments: true })).toMatchObject({ code: 'EXPIRY_REQUIRED' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'secondary_lro' })).toBeNull();
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(-1) })).toMatchObject({ code: 'INVALID_EXPIRY' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(400) })).toMatchObject({ code: 'INVALID_EXPIRY' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(10), canEditCaseNotes: true })).toMatchObject({ code: 'SCOPE_EXCEEDS_ROLE' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'read_only', expiresAt: inDays(10) })).toBeNull();
  });


  it('maps a role and scope to kernel permissions without exceeding the role', () => {
    expect(collaboratorPermissions({ accessRole: 'read_only' })).toEqual(['read', 'read_internal']);
    expect(collaboratorPermissions({ accessRole: 'reviewer' })).toEqual(['read', 'read_internal', 'comment']);
    expect(collaboratorPermissions({ accessRole: 'reviewer', canEditCaseNotes: true })).not.toContain('write');
    expect(collaboratorPermissions({ accessRole: 'secondary_lro', canEditCaseNotes: true, canViewPrivateDocuments: true })).toEqual(['read', 'read_internal', 'comment', 'write', 'read_third_party_restricted']);
  });
});
