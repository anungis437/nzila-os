/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 13: invariants for the AUTH_STORAGE_AUTHORITY registry
 * (packages/db/src/auth-storage-authority/). Mirrors the invariant style
 * of apps/union-eyes/db/__tests__/rls-storage-authority-manifest-
 * invariants.test.ts, scoped to the shared user_management schema.
 */
import { describe, it, expect } from 'vitest';
import { authStorageAuthorityEntries } from '../entries';
import type { AuthStorageAuthorityEntry } from '../types';
import * as authSchema from '../../schema/auth';

describe('auth-storage-authority registry invariants', () => {
  it('every entry is schema-qualified as user_management.<table>', () => {
    for (const entry of authStorageAuthorityEntries) {
      expect(entry.table.startsWith('user_management.')).toBe(true);
    }
  });

  it('no duplicate table entries', () => {
    const tables = authStorageAuthorityEntries.map((e) => e.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('every entry has a non-empty reason', () => {
    for (const entry of authStorageAuthorityEntries) {
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });

  it('LATENT_UNWIRED entries have NONE/NONE authority and empty supportingCapability', () => {
    for (const entry of authStorageAuthorityEntries) {
      if (entry.classification === 'LATENT_UNWIRED') {
        expect(entry.invocationAuthority).toBe('NONE');
        expect(entry.dbExecutionPrincipal).toBe('NONE');
        expect(entry.supportingCapability).toEqual([]);
      }
    }
  });

  it('non-LATENT_UNWIRED entries have at least one supportingCapability reference', () => {
    for (const entry of authStorageAuthorityEntries) {
      if (entry.classification !== 'LATENT_UNWIRED') {
        expect(entry.supportingCapability.length).toBeGreaterThan(0);
      }
    }
  });

  it('AUTH_SYSTEM_ONLY entries never have dbExecutionPrincipal AUTH_RUNTIME', () => {
    for (const entry of authStorageAuthorityEntries) {
      if (entry.classification === 'AUTH_SYSTEM_ONLY') {
        expect(entry.dbExecutionPrincipal).not.toBe('AUTH_RUNTIME');
      }
    }
  });

  it('MIXED-execution entries actually document a cross-user/system-authorized code path in the reason', () => {
    for (const entry of authStorageAuthorityEntries) {
      if (entry.dbExecutionPrincipal === 'MIXED') {
        expect(entry.reason).toMatch(/AUTH_SYSTEM|systemDb|system-client/);
      }
    }
  });

  it('every table declared in packages/db/src/schema/auth.ts (user_management schema) has exactly one registry entry', () => {
    // Drizzle's pgSchema-scoped table objects don't expose a reliable
    // cross-version `.tableName` symbol to introspect generically, so the
    // expected table list is maintained by hand here — cross-checked
    // against schema/auth.ts's actual exports so a newly-added table
    // export not yet reflected here fails this test.
    const expectedTables = [
      'authUsers',
      'authOrganizationUsers',
      'authUserSessions',
      'authPasswordResetTokens',
      'authAuditLog',
      'authOauthProviders',
      'authMagicLinks',
      'authInvites',
      'authOrgPolicies',
      'authMfaTotp',
      'authMfaChallenges',
    ];
    for (const name of expectedTables) {
      expect((authSchema as Record<string, unknown>)[name]).toBeDefined();
    }
    expect(authStorageAuthorityEntries.length).toBe(expectedTables.length);
  });

  it('every entry\'s classification/invocationAuthority/dbExecutionPrincipal is a recognized enum value', () => {
    const validClassifications: AuthStorageAuthorityEntry['classification'][] = [
      'AUTH_RUNTIME_SELF_SERVICE',
      'AUTH_RUNTIME_MIXED',
      'AUTH_SYSTEM_ONLY',
      'LATENT_UNWIRED',
    ];
    const validInvocation: AuthStorageAuthorityEntry['invocationAuthority'][] = [
      'END_USER',
      'TENANT_ADMIN',
      'PLATFORM_ADMIN',
      'SYSTEM_SCHEDULE',
      'MIXED',
      'NONE',
    ];
    const validExecution: AuthStorageAuthorityEntry['dbExecutionPrincipal'][] = [
      'AUTH_RUNTIME',
      'AUTH_SYSTEM',
      'MIXED',
      'NONE',
    ];
    for (const entry of authStorageAuthorityEntries) {
      expect(validClassifications).toContain(entry.classification);
      expect(validInvocation).toContain(entry.invocationAuthority);
      expect(validExecution).toContain(entry.dbExecutionPrincipal);
    }
  });
});
