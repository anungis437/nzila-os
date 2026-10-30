import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { workplaceIncidents } from '@/db/schema';
import { createTableDatabase } from './support/pglite-tables';

// DEF-0B8-HS-ANONYMOUS-REPORTER-STAMPED-IN-CREATED-BY: the real incident POST (crudRoutes) against real SQL.

const state = vi.hoisted(() => ({ db: null as unknown }));
const audit = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(state.db),
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
let pg: PGlite;

const post = async (body: Record<string, unknown>) => {
  const { POST } = await import('../health-safety/incidents/route');
  return (POST as any)({
    organizationId: ORG,
    userId: 'steward-1',
    request: { json: async () => body },
    body,
  });
};

beforeAll(async () => {
  const created = await createTableDatabase([workplaceIncidents]);
  pg = created.pg;
  // The mocked withApi skips the body coercion the real one applies, so timestamps arrive as ISO strings.
  const real = created.db as any;
  state.db = new Proxy(real, {
    get: (target, prop) => {
      if (prop !== 'insert') return target[prop];
      return (table: unknown) => {
        const builder = target.insert(table);
        return {
          values: (values: Record<string, unknown>) =>
            builder.values(
              Object.fromEntries(
                Object.entries(values).map(([k, v]) => [k, typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v]),
              ),
            ),
        };
      };
    },
  });
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  audit.mockClear();
  await pg.exec('TRUNCATE workplace_incidents');
});

const base = { description: 'Guard missing on press', locationDescription: 'Line 3', incidentType: 'near_miss', severity: 'minor', incidentDate: '2026-10-29T13:00:00.000Z' };
const stored = async () => (await pg.query<{ created_by: string; metadata: Record<string, unknown> }>('SELECT created_by, metadata FROM workplace_incidents')).rows;

describe('POST /api/health-safety/incidents', () => {
  it('attributes an ordinary report to the session user in the row and the audit entry', async () => {
    await post({ ...base, reportedBy: 'Jo' });
    const [row] = await stored();
    expect(row.created_by).toBe('steward-1');
    expect(audit.mock.calls[0][1]).toMatchObject({ userId: 'steward-1' });
  });

  it('does not attribute an anonymous report to the session user anywhere', async () => {
    await post({ ...base, isAnonymous: true, reportedBy: 'Jo' });
    const [row] = await stored();
    expect(row.created_by).toBe('anonymous');
    expect(JSON.stringify(row.metadata)).not.toContain('Jo');
    expect(JSON.stringify(row.metadata)).not.toContain('jo@example.ca');
    expect(JSON.stringify(audit.mock.calls.map((c) => c[1]))).not.toContain('steward-1');
  });

  it('rejects forged creator attribution before writing either ordinary or anonymous incidents', async () => {
    await expect(post({ ...base, createdBy: 'anonymous' })).rejects.toThrow(/createdBy cannot be assigned/);
    await expect(post({ ...base, isAnonymous: true, createdBy: 'someone-else' })).rejects.toThrow(/createdBy cannot be assigned/);
    expect(await stored()).toEqual([]);

    await post({ ...base });
    await post({ ...base, isAnonymous: true });
    const rows = await stored();
    expect(rows.map((r) => r.created_by).sort()).toEqual(['anonymous', 'steward-1']);
  });

  it('rejects unsupported reporter contact rather than silently dropping a sensitive field', async () => {
    await expect(post({ ...base, reporterContact: 'jo@example.ca' })).rejects.toThrow(/reporterContact cannot be assigned/);
    expect(await stored()).toEqual([]);
  });

});
