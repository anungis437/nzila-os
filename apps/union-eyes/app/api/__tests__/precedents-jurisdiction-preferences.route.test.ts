import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ memberJurisdictionPreferences: { userId: 'userId', organizationId: 'organizationId', id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../precedents/jurisdiction-preferences/route');
}

describe('precedents/jurisdiction-preferences route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pref_1', preferredJurisdictions: ['ON'] }]) })) });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pref_1', preferredJurisdictions: ['QC'] }]) })) })) } as any);
  });

  it('returns default preferences when none exist', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', userId: 'u1' });

    expect(result.isConfigured).toBe(false);
  });

  it('creates preferences', async () => {
    const { PUT } = await loadRoute();
    const result = await PUT({
      body: { preferredJurisdictions: ['ON'], preferredLevels: ['provincial'], includeNational: true, autoApply: true },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result.isConfigured).toBe(true);
  });
});