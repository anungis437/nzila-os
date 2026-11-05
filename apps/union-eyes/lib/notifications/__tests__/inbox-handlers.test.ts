import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// The route test of the notifications (app/api/__tests__/notifications-atomic-audit.route.test.ts) replaces drizzle's `sql` and `and` with stubs, so it cannot
// see the SQL the create handler builds. This test keeps drizzle real and renders the hourly fan-out count to the SQL it sends, because a fragment that
// lacked its column once made every steward-authored notification fail in the database.
const m = vi.hoisted(() => ({ wheres: [] as unknown[], total: 0, inserted: [] as unknown[] }));

vi.mock('@/lib/api/framework', () => {
  class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
    static badRequest(message: string) {
      return new ApiError('BAD_REQUEST', message);
    }
    static notFound(what: string) {
      return new ApiError('NOT_FOUND', `${what} not found`);
    }
  }
  return { ApiError, ErrorCode: { RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED' } };
});
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));

const tx = {
  select: () => {
    const chain = {
      from: () => chain,
      where: (condition: unknown) => {
        m.wheres.push(condition);
        return chain;
      },
      // The recipient lookup ends in limit(); the fan-out count is awaited as it stands.
      limit: async () => [{ userId: 'u2' }],
      then: (resolve: (rows: unknown) => unknown) => Promise.resolve([{ total: m.total }]).then(resolve),
    };
    return chain;
  },
  insert: () => ({
    values: (row: unknown) => {
      m.inserted.push(row);
      return { returning: async () => [{ id: 'n1' }] };
    },
  }),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_scope: unknown, run: (t: unknown) => Promise<unknown>) => run(tx)),
}));

import { createNotification } from '../inbox-handlers';
import { and, eq, sql } from 'drizzle-orm';
import { inAppNotifications } from '@/db/schema';

const call = (body: unknown) =>
  createNotification({ body, organizationId: 'org_1', userId: 'steward_1' } as unknown as Parameters<typeof createNotification>[0]);
const request = { userId: 'u2', title: 'Dues are due', message: 'Please pay by Friday' };
// An operator with nothing to its left: the shape of the defect this test guards against.
const DANGLING_OPERATOR = /(\(|\band\b)\s*>/i;

describe('createNotification: the hourly fan-out bound', () => {
  beforeEach(() => {
    m.wheres.length = 0;
    m.inserted.length = 0;
    m.total = 0;
  });

  it('recognises the broken fragment it guards against', () => {
    const broken = and(eq(inAppNotifications.organizationId, 'org_1'), sql` > now() - interval '1 hour'`);
    expect(new PgDialect().sqlToQuery(broken as SQL).sql).toMatch(DANGLING_OPERATOR);
  });

  it("counts the author's notifications of the last hour on the created_at column, in SQL the database can run", async () => {
    await call(request);

    const count = new PgDialect().sqlToQuery(m.wheres[1] as SQL);
    expect(count.sql).toContain(`"in_app_notifications"."created_at" > now() - interval '1 hour'`);
    expect(count.sql).toContain(`-> 'origin' ->> 'userId'`);
    expect(count.sql).not.toMatch(DANGLING_OPERATOR);
    expect(count.params).toEqual(expect.arrayContaining(['org_1', 'steward_1']));
  });

  it('creates the notification while the author is under the bound', async () => {
    m.total = 99;

    await expect(call(request)).resolves.toEqual({ id: 'n1' });
    expect(m.inserted).toHaveLength(1);
  });

  it('refuses the notification, and writes nothing, once the author has sent the hour\u2019s limit', async () => {
    m.total = 100;

    await expect(call(request)).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many notifications sent this hour' });
    expect(m.inserted).toHaveLength(0);
  });
});
