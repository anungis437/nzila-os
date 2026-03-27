/**
 * Unit Tests — POST /api/claims
 *
 * Covers the two bugs fixed in the custom POST handler:
 *   1. incidentDate string → Date coercion (Drizzle PgTimestamp requires Date object)
 *   2. null organizationId → clean 400 instead of DB NOT NULL crash
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

// Capture inserted values for assertions
let capturedInsertValues: Record<string, unknown> | null = null;

vi.mock('@/db/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ max_num: null }]),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        capturedInsertValues = vals;
        return {
          returning: vi.fn().mockResolvedValue([{
            claimId: '11111111-1111-1111-1111-111111111111',
            claimNumber: 'CLM-20260327-0001',
            claimType: 'grievance_discipline',
            organizationId: '9210418f-6a4f-4dab-a7d2-4450d581dc81',
            memberId: 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV',
            incidentDate: new Date('2026-03-27'),
            location: 'Main Floor',
            description: 'Test incident',
            desiredOutcome: 'Resolution',
            witnessesPresent: false,
            status: 'submitted',
          }]),
        };
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  claims: { name: 'claims' },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn().mockImplementation(
    (_options: unknown, handler: (ctx: Record<string, unknown>) => Promise<unknown>) =>
      handler,
  ),
}));

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn().mockReturnValue({ GET: vi.fn() }),
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn().mockReturnValue({ sql: 'mock' }),
}));

// ── Import handler after mocks are established ─────────────────────────────
// We import the raw handler function (withApi mock returns it directly)
const { POST } = await import('@/app/api/claims/route');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: '9210418f-6a4f-4dab-a7d2-4450d581dc81',
    userId: 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV',
    request: {
      json: vi.fn().mockResolvedValue({
        claimType: 'grievance_discipline',
        incidentDate: '2026-03-27',
        description: 'Main floor altercation on March 27th',
        location: 'Main Floor',
        desiredOutcome: 'Written apology and policy change',
        witnessesPresent: false,
        witnessDetails: '',
      }),
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/claims', () => {
  beforeEach(() => {
    capturedInsertValues = null;
    vi.clearAllMocks();
  });

  it('converts incidentDate string to Date before insert', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await handler(makeCtx());

    expect(capturedInsertValues).not.toBeNull();
    expect(capturedInsertValues!.incidentDate).toBeInstanceOf(Date);
    expect((capturedInsertValues!.incidentDate as Date).toISOString()).toContain('2026-03-27');
  });

  it('generates claimNumber with CLM- prefix', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await handler(makeCtx());

    expect(capturedInsertValues!.claimNumber).toMatch(/^CLM-\d{8}-\d{4}$/);
  });

  it('sets memberId from userId context, not from body', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await handler(makeCtx());

    expect(capturedInsertValues!.memberId).toBe('user_3BP6IlC0zg9MwHJDDNn7KCcR0MV');
  });

  it('sets organizationId from auth context', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await handler(makeCtx());

    expect(capturedInsertValues!.organizationId).toBe('9210418f-6a4f-4dab-a7d2-4450d581dc81');
  });

  it('throws ApiError.badRequest when organizationId is null', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await expect(
      handler(makeCtx({ organizationId: null })),
    ).rejects.toMatchObject({
      message: expect.stringContaining('No active organization'),
    });
  });

  it('does not pass incidentDate as raw string to DB', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    await handler(makeCtx());

    // If this were a string, Drizzle's mapToDriverValue would throw
    // "value.toISOString is not a function"
    expect(typeof capturedInsertValues!.incidentDate).not.toBe('string');
  });

  it('returns inserted row data', async () => {
    const handler = POST as unknown as (ctx: Record<string, unknown>) => Promise<unknown>;
    const result = await handler(makeCtx()) as { data: Record<string, unknown> };

    expect(result).toHaveProperty('data');
    expect(result.data.claimNumber).toBe('CLM-20260327-0001');
    expect(result.data.claimType).toBe('grievance_discipline');
  });
});
