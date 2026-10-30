/**
 * Defense in depth for Gate 0: a hierarchy relationship is not an
 * independently ratified disclosure agreement, and revocation must remove
 * a person from finance calculations as well as organization lookups.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const api = resolve(__dirname, '..');
const app = resolve(api, '..', '..');
const readApi = (rel: string) => readFileSync(resolve(api, rel), 'utf8');

describe('sensitive tenant projections must not widen with hierarchy or status', () => {
  it('the organization item keeps private member counts, contacts, and grievances behind direct office authority', () => {
    const source = readApi('organizations/[id]/route.ts');
    expect(source).toContain('isAdministrativeRole(access.direct.get(id))');
    expect(source).toContain("activeClaims: claims!.active");
    expect(source).toContain('...(administrative ? {');
    expect(source).toContain('member_count: _memberCount');
    expect(source).toContain('email: _email');
  });

  it('the organization listing redacts counts of subordinate unions without direct grants', () => {
    const source = readApi('organizations/route.ts');
    expect(source).toContain('isAdministrativeRole(access.direct.get(row.id))');
    expect(source).toMatch(/\.\.\.\(administrative \? \{\s*member_count:/);
  });

  it('billing candidates are active and have not been soft-deleted', () => {
    const source = readFileSync(resolve(app, 'lib/services/billing-cycle-service.ts'), 'utf8');
    expect(source).toContain("eq(organizationMembers.status, 'active')");
    expect(source).toContain('isNull(organizationMembers.deletedAt)');
  });
});
