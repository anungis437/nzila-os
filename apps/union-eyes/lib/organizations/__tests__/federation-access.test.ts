import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AffiliateRow } from '../affiliates';

const m = vi.hoisted(() => ({ role: 'fed_staff' as string | null, fail: false }));

vi.mock('@/lib/organization-utils', () => ({
  getUserRoleInOrganization: vi.fn(async () => {
    if (m.fail) throw new Error('role lookup failed');
    return m.role;
  }),
}));

import { hasFederationAccess } from '../federation-access';
import { filterAffiliates } from '../affiliate-filter';

beforeEach(() => {
  m.role = 'fed_staff';
  m.fail = false;
});

describe('hasFederationAccess', () => {
  it.each(['fed_staff', 'fed_executive', 'admin', 'system_admin'])('admits %s', async (role) => {
    m.role = role;
    expect(await hasFederationAccess('user-1', 'org-1')).toBe(true);
  });

  it.each([['member'], ['steward'], ['clc_staff'], [''], [null]])('refuses %s', async (role) => {
    m.role = role;
    expect(await hasFederationAccess('user-1', 'org-1')).toBe(false);
  });

  it('refuses when the role cannot be read, instead of guessing', async () => {
    m.fail = true;
    expect(await hasFederationAccess('user-1', 'org-1')).toBe(false);
  });
});

const affiliate = (overrides: Partial<AffiliateRow> = {}): AffiliateRow => ({
  id: 'a-1',
  name: 'Local 100',
  organizationType: 'local',
  provinceTerritory: 'ON',
  clcAffiliateCode: 'L-100',
  email: 'office@local100.test',
  phone: null,
  address: null,
  description: null,
  status: 'active',
  memberCount: 10,
  ...overrides,
});

describe('filterAffiliates', () => {
  const rows = [
    affiliate(),
    affiliate({ id: 'a-2', name: 'Teachers Union', organizationType: 'union', clcAffiliateCode: null, email: 'info@teachers.test', status: 'inactive' }),
    affiliate({ id: 'a-3', name: 'Nurses Local', organizationType: 'local', clcAffiliateCode: 'N-7', email: null }),
  ];

  it('keeps everything when no field is filled', () => {
    expect(filterAffiliates(rows, { q: '', type: '', status: '' })).toHaveLength(3);
    expect(filterAffiliates(rows, { q: '   ', type: '', status: '' })).toHaveLength(3);
  });

  it('looks for the text in the name, the CLC code and the e-mail, in any case', () => {
    expect(filterAffiliates(rows, { q: 'nurses', type: '', status: '' }).map((row) => row.id)).toEqual(['a-3']);
    expect(filterAffiliates(rows, { q: 'l-100', type: '', status: '' }).map((row) => row.id)).toEqual(['a-1']);
    expect(filterAffiliates(rows, { q: 'TEACHERS.TEST', type: '', status: '' }).map((row) => row.id)).toEqual(['a-2']);
    expect(filterAffiliates(rows, { q: 'nothing like this', type: '', status: '' })).toEqual([]);
  });

  it('matches type and status exactly, and combines every field it is given', () => {
    expect(filterAffiliates(rows, { q: '', type: 'local', status: '' }).map((row) => row.id)).toEqual(['a-1', 'a-3']);
    expect(filterAffiliates(rows, { q: '', type: '', status: 'inactive' }).map((row) => row.id)).toEqual(['a-2']);
    expect(filterAffiliates(rows, { q: 'local', type: 'local', status: 'active' }).map((row) => row.id)).toEqual(['a-1', 'a-3']);
    expect(filterAffiliates(rows, { q: 'teachers', type: 'local', status: '' })).toEqual([]);
    expect(filterAffiliates(rows, { q: '', type: 'loc', status: '' })).toEqual([]);
  });
});
