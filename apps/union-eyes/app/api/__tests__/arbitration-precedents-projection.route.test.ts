import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { getTableColumns } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { arbitrationDecisions } from '@/db/schema';
import { PUBLIC_DETAIL_COLUMNS, PUBLIC_SUMMARY_COLUMNS, WITHHELD_DECISION_COLUMNS } from '@/lib/precedents/public-decision-view';

// The generic arbitration routes (/api/arbitration/precedents and /:id) are the real ones, run through the real withApi and crud factory; only the
// identity, the database and the audit are stood in for. Every column of the decision the stand-in database holds carries a recognizable value, so
// what the routes answer with is compared with what the platform's public projection allows, column by column.
const state = vi.hoisted(() => ({
  decisions: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'member@example.test', role: 'member', organizationId: 'org-1' })),
  };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: vi.fn(async () => 'org-1'),
  getUserRoleInOrganization: vi.fn(async () => 'member'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({}),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/db/db', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core');
  const dialect = new PgDialect();
  return {
    db: {
      select: (selection?: unknown) => {
        // A count query selects an aggregate; a list read ends in offset(); an item read is awaited right after its where clause,
        // which names the id it wants.
        const counting = selection !== undefined;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = (clause: unknown) => {
          chain.clause = clause;
          return chain;
        };
        chain.orderBy = () => chain;
        chain.limit = () => chain;
        chain.offset = () => Promise.resolve(state.decisions);
        chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const params = chain.clause ? dialect.sqlToQuery(chain.clause as SQL).params : [];
          const result = counting ? [{ total: state.decisions.length }] : state.decisions.filter((decision) => params.includes(decision.id));
          return Promise.resolve(result).then(resolve, reject);
        };
        return chain;
      },
    },
  };
});

import { GET as listDecisions } from '@/app/api/arbitration/precedents/route';
import { GET as getDecision } from '@/app/api/arbitration/precedents/[id]/route';

const COLUMNS = Object.keys(getTableColumns(arbitrationDecisions));

/** A decision with a value in every column of the table, each one naming the column it is in. */
const decisionWithId = (id: string): Record<string, unknown> => ({
  ...Object.fromEntries(COLUMNS.map((column) => [column, `secret-in-${column}`])),
  id,
});

async function body<T>(response: Response): Promise<T> {
  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}

const listed = async () => {
  const json = await body<{ success: boolean; data: { data: Record<string, unknown>[] } }>(await listDecisions(new NextRequest('http://localhost/api/arbitration/precedents?limit=20')));
  return json.data.data;
};
const read = async (id: string) => {
  const json = await body<{ success: boolean; data: { data: Record<string, unknown> } }>(
    await getDecision(new NextRequest(`http://localhost/api/arbitration/precedents/${id}`), { params: Promise.resolve({ id }) }),
  );
  return json.data.data;
};

beforeEach(() => {
  state.decisions = [decisionWithId('d-1'), decisionWithId('d-2')];
});

describe('GET /api/arbitration/precedents answers with the platform’s public projection', () => {
  it('serves exactly the list projection’s columns for each decision, and nothing else the row carries', async () => {
    const rows = await listed();

    expect(rows).toHaveLength(2);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual([...PUBLIC_SUMMARY_COLUMNS].sort());
  });

  it('never carries the grievor, the remedy, the full text, the embedding, provenance or the access metadata, in any form', async () => {
    const text = JSON.stringify(await listed());

    for (const column of WITHHELD_DECISION_COLUMNS) expect(text, column).not.toContain(`secret-in-${column}`);
    for (const column of PUBLIC_DETAIL_COLUMNS) expect(text, column).not.toContain(`secret-in-${column}`);
    for (const column of PUBLIC_SUMMARY_COLUMNS.filter((name) => name !== 'id')) expect(text, column).toContain(`secret-in-${column}`);
  });
});

describe('GET /api/arbitration/precedents/:id answers with the projection and the decision’s own reasoning', () => {
  it('serves the list projection’s columns plus the detail columns, and nothing else the row carries', async () => {
    const row = await read('d-1');

    expect(Object.keys(row).sort()).toEqual([...PUBLIC_SUMMARY_COLUMNS, ...PUBLIC_DETAIL_COLUMNS].sort());
    expect(row.reasoning).toBe('secret-in-reasoning');
    expect(row.keyFacts).toBe('secret-in-keyFacts');
  });

  it('never carries the grievor, the remedy, the full text, the embedding, provenance or the access metadata, in any form', async () => {
    const text = JSON.stringify(await read('d-1'));

    for (const column of WITHHELD_DECISION_COLUMNS) expect(text, column).not.toContain(`secret-in-${column}`);
  });

  it('withholds the supplying organization’s identity from every other organization', async () => {
    const row = await read('d-2');

    expect(row).not.toHaveProperty('sourceOrganizationId');
    expect(JSON.stringify(row)).not.toContain('secret-in-sourceOrganizationId');
  });
});

describe('the routes’ own lists', () => {
  const source = (route: string) => readFileSync(path.resolve(__dirname, '..', 'arbitration', 'precedents', ...route.split('/')), 'utf8');

  it('are the lists the platform’s projection defines, not a copy that could drift', () => {
    expect(source('route.ts')).toContain('omitFromResponse: [...WITHHELD_DECISION_COLUMNS, ...PUBLIC_DETAIL_COLUMNS]');
    expect(source('[id]/route.ts')).toContain('omitFromResponse: [...WITHHELD_DECISION_COLUMNS]');
    for (const route of ['route.ts', '[id]/route.ts']) expect(source(route)).toContain("from '@/lib/precedents/public-decision-view'");
  });
});
