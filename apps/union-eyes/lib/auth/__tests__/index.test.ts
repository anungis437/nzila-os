import { beforeAll, describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies that the barrel import chain pulls in
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: vi.fn(() => ({ userId: null, getToken: vi.fn() })),
  currentUser: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: { json: vi.fn((b: any, i?: { status?: number }) => ({ body: b, status: i?.status || 200 })), redirect: vi.fn() },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    query: {},
  },
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })),
    query: {},
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: {},
  organizations: {},
  users: {},
}));

vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, relations: vi.fn(() => ({})) };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The index.ts just re-exports from other modules.
// Verify it re-exports correctly.
describe('lib/auth/index re-exports', { timeout: 60_000 }, () => {
  let mod: Awaited<typeof import('../index')>;

  beforeAll(async () => {
    mod = await import('../index');
  }, 60_000);

  it('exports Permission', async () => {
    expect(mod.Permission).toBeDefined();
  });

  it('exports ROLE_PERMISSIONS', async () => {
    expect(mod.ROLE_PERMISSIONS).toBeDefined();
    expect(typeof mod.ROLE_PERMISSIONS).toBe('object');
  });

  it('exports hasPermission function', async () => {
    expect(typeof mod.hasPermission).toBe('function');
  });

  it('exports getRoleLevel function', async () => {
    expect(typeof mod.getRoleLevel).toBe('function');
  });

  it('exports AuthError class', async () => {
    expect(mod.AuthError).toBeDefined();
  });

  it('exports AuthErrorType enum', async () => {
    expect(mod.AuthErrorType).toBeDefined();
  });
});
