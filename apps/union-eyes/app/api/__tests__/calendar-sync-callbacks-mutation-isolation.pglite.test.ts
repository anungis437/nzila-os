import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { externalCalendarConnections } from '@/db/schema/calendar-schema';
import { createTableDatabase } from './support/pglite-tables';

// UE-CONV-K-006: the OAuth callbacks update the caller's stored connection. The statement itself carries the
// caller's organization and user, so another organization's connection is never modified.

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/api-auth-guard', () => ({
  BaseAuthContext: {},
  withRoleAuth: (_role: string, handler: (request: unknown, context: unknown) => unknown) =>
    (request: unknown, context: unknown) => handler(request, context),
}));
vi.mock('@/lib/external-calendar-sync/token-crypto', () => ({ encryptCalendarToken: (value: string) => `enc:${value}` }));
vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  exchangeCodeForTokens: async () => ({ accessToken: 'access-new', refreshToken: 'refresh-new', expiresAt: new Date(Date.now() + 3_600_000) }),
}));
vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({
  exchangeCodeForTokens: async () => ({
    accessToken: 'access-new',
    refreshToken: 'refresh-new',
    expiresAt: new Date(Date.now() + 3_600_000),
    providerAccountId: 'ms-account',
    providerEmail: 'member@example.org',
  }),
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER = 'user-1';

let pg: PGlite;

async function insertConnection(organizationId: string, provider: string, userId = USER) {
  const id = crypto.randomUUID();
  await pg.query(
    `INSERT INTO external_calendar_connections
       (id, organization_id, user_id, provider, provider_account_id, access_token, refresh_token, sync_status, is_active)
     VALUES ($1, $2, $3, $4, 'acct', 'enc:old', 'enc:old-refresh', 'error', false)`,
    [id, organizationId, userId, provider],
  );
  return id;
}

async function connection(id: string) {
  return (await pg.query<{ access_token: string; sync_status: string; is_active: boolean }>(
    'SELECT access_token, sync_status, is_active FROM external_calendar_connections WHERE id = $1',
    [id],
  )).rows[0];
}

beforeAll(async () => {
  const created = await createTableDatabase([externalCalendarConnections]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE external_calendar_connections');
});

describe.each([
  ['google', () => import('../calendar-sync/google/callback/route')],
  ['microsoft', () => import('../calendar-sync/microsoft/callback/route')],
])('calendar-sync/%s/callback — organization-bound mutation', (provider, load) => {
  async function callback(organizationId: string) {
    const { GET } = await load();
    return (GET as unknown as (request: NextRequest, context: unknown) => Promise<Response>)(
      new NextRequest(`http://localhost/api/calendar-sync/${provider}/callback?code=abc&state=${USER}`),
      { userId: USER, organizationId },
    );
  }

  it('refreshes the caller\'s own connection in the caller\'s organization', async () => {
    const own = await insertConnection(ORG_A, provider);

    const response = await callback(ORG_A);

    expect(response.status).toBe(307);
    expect(await connection(own)).toEqual({ access_token: 'enc:access-new', sync_status: 'synced', is_active: true });
  });

  it('leaves the same user\'s connection in another organization untouched', async () => {
    const foreign = await insertConnection(ORG_B, provider);

    const response = await callback(ORG_A);

    expect(response.status).toBe(307);
    expect(await connection(foreign)).toEqual({ access_token: 'enc:old', sync_status: 'error', is_active: false });
    const created = await pg.query<{ organization_id: string }>(
      'SELECT organization_id FROM external_calendar_connections WHERE id <> $1',
      [foreign],
    );
    expect(created.rows.map((r) => r.organization_id)).toEqual([ORG_A]);
  });
});
