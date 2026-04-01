import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies that the barrel import chain pulls in
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: null, getToken: vi.fn() })),
  currentUser: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: { json: vi.fn((b: unknown, i?: { status?: number }) => ({ body: b, status: i?.status || 200 })), redirect: vi.fn() },
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
describe('lib/auth/index re-exports', { timeout: 15_000 }, () => {
  it('exports Permission', async () => {
    // Dynamic import to avoid circular issues in top-level
    const mod = await import('../index');
    expect(mod.Permission).toBeDefined();
  });

  it('exports ROLE_PERMISSIONS', async () => {
    const mod = await import('../index');
    expect(mod.ROLE_PERMISSIONS).toBeDefined();
    expect(typeof mod.ROLE_PERMISSIONS).toBe('object');
  });

  it('exports hasPermission function', async () => {
    const mod = await import('../index');
    expect(typeof mod.hasPermission).toBe('function');
  });

  it('exports getRoleLevel function', async () => {
    const mod = await import('../index');
    expect(typeof mod.getRoleLevel).toBe('function');
  });

  it('exports AuthError class', async () => {
    const mod = await import('../index');
    expect(mod.AuthError).toBeDefined();
  });

  it('exports AuthErrorType enum', async () => {
    const mod = await import('../index');
    expect(mod.AuthErrorType).toBeDefined();
  });
});
