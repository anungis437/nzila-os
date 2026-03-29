import { describe, it, expect } from 'vitest';
import {
  assertOrgId,
  OrgBoundaryError,
  createOrgScopedQuery,
} from '../db-adapter';

describe('db-adapter', () => {
  describe('assertOrgId', () => {
    it('extracts orgId from session', () => {
      expect(assertOrgId({ orgId: 'org-1' })).toBe('org-1');
    });

    it('extracts organizationId as fallback', () => {
      expect(assertOrgId({ organizationId: 'org-2' })).toBe('org-2');
    });

    it('extracts org_id as fallback', () => {
      expect(assertOrgId({ org_id: 'org-3' })).toBe('org-3');
    });

    it('trims whitespace from orgId', () => {
      expect(assertOrgId({ orgId: '  org-4  ' })).toBe('org-4');
    });

    it('throws OrgBoundaryError when orgId is missing', () => {
      expect(() => assertOrgId({})).toThrow(OrgBoundaryError);
    });

    it('throws OrgBoundaryError when orgId is empty string', () => {
      expect(() => assertOrgId({ orgId: '' })).toThrow(OrgBoundaryError);
    });

    it('throws OrgBoundaryError when orgId is whitespace only', () => {
      expect(() => assertOrgId({ orgId: '   ' })).toThrow(OrgBoundaryError);
    });
  });

  describe('OrgBoundaryError', () => {
    it('has correct name', () => {
      const err = new OrgBoundaryError('test');
      expect(err.name).toBe('OrgBoundaryError');
      expect(err.message).toBe('test');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('createOrgScopedQuery', () => {
    it('throws if orgId is falsy', () => {
      expect(() => createOrgScopedQuery('')).toThrow(OrgBoundaryError);
    });

    it('returns object with orgId', () => {
      const scoped = createOrgScopedQuery('org-5');
      expect(scoped.orgId).toBe('org-5');
    });

    it('applyFilter calls eq on query with orgId', () => {
      const scoped = createOrgScopedQuery('org-6');
      const mockQuery = { eq: (col: string, val: string) => ({ col, val }) };
      const result = scoped.applyFilter(mockQuery as any);
      expect(result).toEqual({ col: 'organization_id', val: 'org-6' });
    });

    it('applyFilter uses custom column name', () => {
      const scoped = createOrgScopedQuery('org-7');
      const mockQuery = { eq: (col: string, val: string) => ({ col, val }) };
      const result = scoped.applyFilter(mockQuery as any, 'tenant_id');
      expect(result).toEqual({ col: 'tenant_id', val: 'org-7' });
    });

    it('scopeInsert injects organization_id into payload', () => {
      const scoped = createOrgScopedQuery('org-8');
      const result = scoped.scopeInsert({ name: 'test', status: 'active' });
      expect(result).toEqual({
        name: 'test',
        status: 'active',
        organization_id: 'org-8',
      });
    });

    it('scopeInsert overrides existing organization_id', () => {
      const scoped = createOrgScopedQuery('org-9');
      const result = scoped.scopeInsert({ organization_id: 'spoofed' });
      expect(result.organization_id).toBe('org-9');
    });
  });
});
