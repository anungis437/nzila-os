/**
 * Opt-in native lock probe against EXISTING, owned synthetic fixtures on an owned PITR copy.
 * This does not prove sign-in, kernel policy, tenant-role binding or durable commit: those
 * boundaries are replaced here to isolate the real handler/service SQL and PostgreSQL locks.
 * All application mutations and audit-lock operations are ROLLED BACK; no fixtures are created
 * or deleted. No connection is opened unless all of these are provided explicitly:
 *
 * UE_DEADLINE_LOCK_PROBE=OWNED_PITR_COPY
 * UE_AUTHORITY_COMBINED_URL=<copy connection, never the live staging/production database>
 * UE_DEADLINE_LOCK_PROBE_FIXTURE=<JSON with organizationId, grievanceId, deadlineId, actorId, incomingUserId>
 *
 * Only nzila-ue-v2-recovery-20261113.postgres.database.azure.com / ue_v2_staging is accepted.
 * DNS and the actual connected socket must both resolve to 10.40.4.5; the primary at
 * 10.40.4.4 is never accepted. TLS must verify the copy hostname and certificate chain.
 * The case title and deadline description must both begin "Synthetic", and the deadline must
 * have the explicit public-manual classification. Database probes are skipped in ordinary
 * test runs; the pure target-guard checks below do not open connections.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type { TLSSocket } from 'node:tls';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RLSTx } from '@/lib/db/with-rls-context';

const enabled = process.env.UE_DEADLINE_LOCK_PROBE === 'OWNED_PITR_COPY';
const COPY_HOST = 'nzila-ue-v2-recovery-20261113.postgres.database.azure.com';
const COPY_DATABASE = 'ue_v2_staging';
const COPY_ADDRESS = '10.40.4.5';

function copyConnectionOptions(rawUrl: string): pg.ClientConfig {
  const target = new URL(rawUrl);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.hostname !== COPY_HOST ||
    decodeURIComponent(target.pathname.slice(1)) !== COPY_DATABASE || (target.port && target.port !== '5432')) {
    throw new Error('Only the named owned recovery server and preserved database are accepted');
  }
  if (!target.username || !target.password) throw new Error('An explicit owned-copy connection identity is required');
  // Do not forward connection-string query parameters: they can override host, database or
  // ssl settings in pg. The known copy target and certificate verification are fixed here.
  return {
    host: COPY_HOST, port: 5432, database: COPY_DATABASE,
    user: decodeURIComponent(target.username), password: decodeURIComponent(target.password),
    ssl: { rejectUnauthorized: true, servername: COPY_HOST },
    connectionTimeoutMillis: 5000, application_name: 'ue-owned-pitr-deadline-lock-probe',
  };
}

describe('owned recovery-copy target guard without connections', () => {
  it('accepts the exact copy host with the database name preserved by PITR and forces verified TLS', () => {
    const config = copyConnectionOptions(`postgresql://probe:example@${COPY_HOST}/${COPY_DATABASE}?sslmode=disable&host=10.40.4.4&dbname=other`);
    expect(config).toMatchObject({ host: COPY_HOST, database: COPY_DATABASE, port: 5432, ssl: { rejectUnauthorized: true, servername: COPY_HOST } });
    expect(config).not.toHaveProperty('connectionString');
  });
  it.each([
    `postgresql://probe:example@staging-db.postgres.database.azure.com/${COPY_DATABASE}`,
    `postgresql://probe:example@10.40.4.4/${COPY_DATABASE}`,
    `postgresql://probe:example@${COPY_HOST}/another_database`,
    `postgresql://probe:example@${COPY_HOST}:6543/${COPY_DATABASE}`,
  ])('rejects a different connection target before DNS or database access: %s', target => {
    expect(() => copyConnectionOptions(target)).toThrow('Only the named owned recovery server');
  });
});
const state = vi.hoisted(() => ({
  run: null as null | ((work: (tx: RLSTx) => Promise<unknown>) => Promise<unknown>),
  incomingUserId: '',
  organizationId: '',
  assignmentEntered: vi.fn(),
  authorityEntered: vi.fn(),
  legacyAuthorityEntered: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('@/app/api/__tests__/support/with-api-stub')).frameworkModule);
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, work: (tx: RLSTx) => Promise<unknown>) => state.run!(work),
  withSystemContext: (work: () => Promise<unknown>) => work(),
}));
vi.mock('@/lib/services/steward-assignment', () => ({
  assignSteward: async () => { state.assignmentEntered(); return { stewardId: state.incomingUserId }; },
}));
vi.mock('@/lib/services/case-access-service', () => ({
  // Preserve the canonical audit lock that a real relationship mutation acquires before returning.
  assignPrimaryRepresentative: async (tx: RLSTx) => {
    state.authorityEntered();
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`audit_logs:${state.organizationId}`}, 0))`);
    return { previousUserId: null };
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (tx: RLSTx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`audit_logs:${state.organizationId}`}, 0))`);
  },
}));
vi.mock('@/lib/cases/case-authorization', () => ({ requireCaseFilingCapacity: vi.fn(), requireKernelCaseAction: vi.fn() }));
vi.mock('@/lib/authority/store/route-adapter', () => ({
  decideCase: async () => { state.legacyAuthorityEntered(); return { effect: 'allow' }; },
}));
vi.mock('@/lib/deadline-engine/reminder-scheduler', () => ({ scheduleGrievanceDeadlineReminders: vi.fn() }));
vi.mock('@/lib/deadline-engine/organization-time-zone', () => ({ loadOrganizationTimeZone: async () => ({ timeZone: 'UTC' }) }));
vi.mock('@/lib/deadline-engine', () => ({
  requestAssignmentConvergence: async () => ({ taskId: 'rollback-only-lock-probe' }),
  processAssignmentConvergence: async () => undefined,
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: async () => undefined }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

type Fixture = { organizationId: string; grievanceId: string; deadlineId: string; actorId: string; incomingUserId: string };
type Operation = 'assignment' | 'legacy';
const operations = new AsyncLocalStorage<Operation>();

describe.skipIf(!enabled)('deadline and formal assignment parent-first locks on an owned PITR copy', () => {
  let fixture: Fixture;
  let inspector: pg.Client;
  let blocker: pg.Client;
  let contender: pg.Client;
  let connection: pg.ClientConfig;
  const pids = new Map<Operation, number>();

  beforeAll(async () => {
    connection = copyConnectionOptions(process.env.UE_AUTHORITY_COMBINED_URL ?? '');
    fixture = JSON.parse(process.env.UE_DEADLINE_LOCK_PROBE_FIXTURE ?? '{}') as Fixture;
    for (const field of ['organizationId', 'grievanceId', 'deadlineId', 'actorId', 'incomingUserId'] as const) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fixture[field] ?? '')) throw new Error(`Owned fixture ${field} is required`);
    }
    const addresses = await lookup(COPY_HOST, { all: true });
    if (addresses.length === 0 || addresses.some(address => address.family !== 4 || address.address !== COPY_ADDRESS)) {
      throw new Error('The owned recovery hostname must resolve only to its approved private address');
    }
    inspector = await openVerifiedCopyClient();
    expect((await inspector.query(`SELECT d.id FROM grievances g JOIN grievance_deadlines d ON d.grievance_id=g.id
      WHERE g.id=$1 AND d.id=$2 AND g.organization_id=$3 AND g.title LIKE 'Synthetic%'
        AND d.description LIKE 'Synthetic%' AND d.deadline_type='ue_case_member_deadline_v1'`,
    [fixture.grievanceId, fixture.deadlineId, fixture.organizationId])).rows).toHaveLength(1);
    blocker = await openVerifiedCopyClient();
    contender = await openVerifiedCopyClient();
    state.organizationId = fixture.organizationId; state.incomingUserId = fixture.incomingUserId;
    state.run = async work => {
      const client = await openVerifiedCopyClient();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='5s'");
        const operation = operations.getStore();
        if (!operation) throw new Error('A named rollback-only probe operation is required');
        pids.set(operation, (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
        return await work(drizzle(client) as unknown as RLSTx);
      } finally { await client.query('ROLLBACK').catch(() => undefined); await client.end(); }
    };
  });

  beforeEach(() => { vi.clearAllMocks(); pids.clear(); });
  afterAll(async () => {
    await blocker?.query('ROLLBACK').catch(() => undefined);
    await contender?.query('ROLLBACK').catch(() => undefined);
    await Promise.all([blocker?.end(), contender?.end(), inspector?.end()]);
  });

  async function openVerifiedCopyClient() {
    const client = new pg.Client(connection);
    try {
      await client.connect();
      const socket = (client as unknown as { connection: { stream: TLSSocket } }).connection.stream;
      if (socket.remoteAddress !== COPY_ADDRESS || !socket.encrypted || !socket.authorized || socket.servername !== COPY_HOST) {
        throw new Error('The connected socket must be the approved private recovery address over verified hostname TLS');
      }
      const row = (await client.query('SELECT current_database() AS name, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];
      if (row?.name !== COPY_DATABASE || row?.ssl !== true) throw new Error('The recovery connection must use the preserved database over TLS');
      return client;
    } catch (error) { await client.end().catch(() => undefined); throw error; }
  }

  async function lockParent() {
    await blocker.query('BEGIN');
    await blocker.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='5s'");
    await blocker.query('SELECT id FROM grievances WHERE id=$1 AND organization_id=$2 FOR UPDATE', [fixture.grievanceId, fixture.organizationId]);
  }

  async function waitForParentContention(operation: Operation) {
    await vi.waitFor(async () => {
      const pid = pids.get(operation);
      expect(pid).toBeTypeOf('number');
      const row = (await inspector.query('SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
      expect(row?.wait_event_type).toBe('Lock');
      expect(row?.blockers).toContain((await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    }, { timeout: 2000, interval: 20 });
  }

  it('assignment waits on the deadline writer parent before taking authority/audit locks', async () => {
    const { caller, resetCaller } = await import('@/app/api/__tests__/support/with-api-stub');
    resetCaller(); caller.role = 'officer'; caller.organizationId = fixture.organizationId; caller.userId = fixture.actorId; caller.params = { id: fixture.grievanceId };
    const { PATCH } = await import('@/app/api/grievances/[id]/assign/route');
    await lockParent();
    const pending = operations.run('assignment', () => PATCH(new Request('https://copy.test/assign', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stewardId: fixture.incomingUserId }),
    })));
    try {
      await waitForParentContention('assignment');
      expect(state.assignmentEntered).not.toHaveBeenCalled(); expect(state.authorityEntered).not.toHaveBeenCalled();
      // This is the second half of the old deadlock: with the parent held, its writer must
      // still acquire the same organization audit lock immediately, not wait for assignment.
      await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`audit_logs:${fixture.organizationId}`]);
    } finally { await blocker.query('ROLLBACK'); await pending; }
    expect((await pending).status).toBe(200);
    expect(state.authorityEntered).toHaveBeenCalledTimes(1);
  });

  it('legacy confirmation waits on the parent while leaving the child unlocked and deferring authority', async () => {
    const { authorizeDeadlineConfirmation } = await import('@/lib/services/deadline-confirmation-service');
    await lockParent();
    const pending = operations.run('legacy', () => state.run!(tx => authorizeDeadlineConfirmation(tx, {
      organizationId: fixture.organizationId, deadlineId: fixture.deadlineId, actorId: fixture.actorId,
    }, true)));
    try {
      await waitForParentContention('legacy');
      expect(state.legacyAuthorityEntered).not.toHaveBeenCalled();
      await contender.query('BEGIN');
      try {
        const child = await contender.query('SELECT id FROM grievance_deadlines WHERE id=$1 FOR UPDATE NOWAIT', [fixture.deadlineId]);
        expect(child.rows).toHaveLength(1);
      } finally { await contender.query('ROLLBACK'); }
    } finally { await blocker.query('ROLLBACK'); await pending; }
    expect(await pending).toMatchObject({ grievanceId: fixture.grievanceId, deadlineType: 'ue_case_member_deadline_v1' });
    expect(state.legacyAuthorityEntered).toHaveBeenCalled();
  });

  it('returns not found across organizations before case authority or assignment mutation', async () => {
    const { authorizeDeadlineConfirmation } = await import('@/lib/services/deadline-confirmation-service');
    const foreignOrganizationId = randomUUID();
    expect(await operations.run('legacy', () => state.run!(tx => authorizeDeadlineConfirmation(tx, {
      organizationId: foreignOrganizationId, deadlineId: fixture.deadlineId, actorId: fixture.actorId,
    }, true)))).toBeNull();
    expect(state.legacyAuthorityEntered).not.toHaveBeenCalled();
    const { caller, resetCaller } = await import('@/app/api/__tests__/support/with-api-stub');
    resetCaller(); caller.role = 'officer'; caller.organizationId = foreignOrganizationId; caller.userId = fixture.actorId; caller.params = { id: fixture.grievanceId };
    const { PATCH } = await import('@/app/api/grievances/[id]/assign/route');
    const response = await operations.run('assignment', () => PATCH(new Request('https://copy.test/assign', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stewardId: fixture.incomingUserId }),
    })));
    expect(response.status).toBe(404);
    expect(state.assignmentEntered).not.toHaveBeenCalled(); expect(state.authorityEntered).not.toHaveBeenCalled();
  });
});
