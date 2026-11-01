import { describe, expect, it, vi } from 'vitest';

// A SCIM stream has no signed-in user. The tenant context needs one, so a SCIM route that opened it would fail for the identity provider on a real
// deployment while passing every test that mocks the context. This runs the real context for a session-less caller and pins the SCIM routes to the
// system context.
vi.mock('@/lib/api-auth-guard', () => ({ auth: async () => ({ userId: null, orgId: null }), currentUser: async () => null }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/system-db', () => ({ systemDb: {} }));
vi.mock('@/lib/auth/canonical-context', () => ({ getCanonicalOrganizationContext: vi.fn() }));
vi.mock('@/lib/auth/canonical-organization-selection', () => ({ withCanonicalOrganizationBinding: vi.fn() }));
vi.mock('@nzila/platform-auth/org-binding', () => ({ AuthOrgBindingError: class extends Error {}, authenticatedOrgBindingSql: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('a session-less machine caller', () => {
  it('cannot open the tenant context, with or without an organization', async () => {
    const { withRLSContext } = await import('@/lib/db/with-rls-context');
    await expect(withRLSContext({ organizationId: 'org_1' }, async () => 1)).rejects.toThrow('No authenticated user found');
    await expect(withRLSContext(async () => 1)).rejects.toThrow('No authenticated user found');
  });

  it('is served by the system context only: every SCIM route and the modules behind them never reference the tenant context', () => {
    const routes = [
      'app/api/scim/v2/[organizationId]/Users/route.ts',
      'app/api/scim/v2/[organizationId]/Users/[id]/route.ts',
      'app/api/scim/v2/[organizationId]/ServiceProviderConfig/route.ts',
    ];
    for (const file of [...routes, 'lib/scim/provisioned-members.ts', 'lib/scim/user-operations.ts', 'lib/scim/route-support.ts', 'lib/scim/responses.ts']) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/withRLSContext|withExplicitUserContext/);
    }
    for (const file of routes) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      // Each declares the bearer token as its machine credential, every method of it, and none leaves authentication optional.
      const methods = source.match(/export const (GET|POST|PUT|PATCH|DELETE) = withApi\(/g) ?? [];
      expect(methods.length, file).toBeGreaterThan(0);
      expect(source.match(/auth: \{ machine: scimCaller \}/g)?.length, file).toBe(methods.length);
      expect(source, file).not.toMatch(/required\s*:\s*false/);
    }
    const users = readFileSync(join(process.cwd(), routes[0]), 'utf8');
    expect(users).toContain('withSystemContext');
    expect(users).not.toContain("from '@/db/schema/organization-members-schema'");
    expect(readFileSync(join(process.cwd(), routes[1]), 'utf8')).toContain('withSystemContext');
  });

  it('answers in SCIM messages, not in the framework envelope an identity provider cannot read', () => {
    for (const file of [
      'app/api/scim/v2/[organizationId]/Users/route.ts',
      'app/api/scim/v2/[organizationId]/Users/[id]/route.ts',
      'app/api/scim/v2/[organizationId]/ServiceProviderConfig/route.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('handleScim(');
      // Nothing a handler returns is a bare object: the framework would wrap it in { success, data, timestamp }.
      expect(source, file).not.toMatch(/=>\s*\{\s*return\s*\{/);
    }
  });
});
