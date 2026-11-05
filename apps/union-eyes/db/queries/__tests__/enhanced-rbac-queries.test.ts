/**
 * Enhanced RBAC queries: what is sent, and to whom (unit; the behavior against real PostgreSQL is db/__tests__/enhanced-rbac.postgres.test.ts).
 *
 * The context boundary is replaced by a recorder that keeps each statement as drizzle renders it (text and parameters), so the assertions are about the SQL itself:
 * which role runs it (tenant read or system write), which organization it names, which columns it filters on. The old test of this module replaced `sql` with a stub, so a
 * statement that could never run (a parameter inside an INTERVAL literal) passed.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rec = vi.hoisted(() => ({
  calls: [] as Array<{ via: 'tenant' | 'system'; reason?: string; text: string; params: unknown[] }>,
  results: [] as unknown[][],
  fail: null as Error | null,
  render: null as null | ((query: unknown) => { sql: string; params: unknown[] }),
}));

vi.mock('@/lib/db/with-rls-context', () => {
  const tx = (via: 'tenant' | 'system', reason?: string) => ({
    execute: async (query: unknown) => {
      if (rec.fail) throw rec.fail;
      const { sql: text, params } = rec.render!(query);
      // drizzle over postgres.js sends a raw parameter as given and the driver cannot serialize an object (a Date), so a statement that carries one never runs
      const object = params.find((p) => typeof p === 'object' && p !== null);
      if (object) throw new TypeError(`The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of ${object.constructor.name}`);
      rec.calls.push({ via, reason, text, params });
      return rec.results.shift() ?? [];
    },
  });
  return {
    withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(tx('tenant')),
    withSystemRLSContext: async (reason: string, op: (tx: unknown) => Promise<unknown>) => op(tx('system', reason)),
  };
});
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { logger } from '@/lib/logger';
import * as q from '../enhanced-rbac-queries';

const dialect = new PgDialect();
rec.render = (query) => dialect.sqlToQuery(query as Parameters<PgDialect['sqlToQuery']>[0]);

const MEMBER = '3f6b8c52-8f0e-4f4e-9d52-1d2a2a1a7b10';
const ORG = '0a4c9a2e-6bd1-4c32-9a55-4f3f7f6a9c21';
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const last = () => rec.calls[rec.calls.length - 1];

beforeEach(() => {
  rec.calls = [];
  rec.results = [];
  rec.fail = null;
  vi.clearAllMocks();
});

describe('row mapping and guards', () => {
  it('recognizes an organization member id and refuses the guard platform contexts', () => {
    expect(q.isMemberRowId(MEMBER)).toBe(true);
    expect(q.isMemberRowId('auth-org:0a4c9a2e')).toBe(false);
    expect(q.isMemberRowId('platform-admin')).toBe(false);
    expect(q.isMemberRowId('')).toBe(false);
  });

  it('maps a raw row to the camelCase interface and numeric strings (numeric, bigint) to numbers', () => {
    expect(q.camelRow({ role_code: 'steward', scope_type: 'global', vote_percentage: '55.50', sequence_number: '42', member_name: 'A' })).toEqual({
      roleCode: 'steward',
      scopeType: 'global',
      votePercentage: 55.5,
      sequenceNumber: 42,
      memberName: 'A',
    });
  });

  it('turns the server text of a timestamp or a date back into a Date, and leaves nulls, Dates and other columns alone', () => {
    const already = new Date('2026-11-02T18:44:12.531Z');
    const row = q.camelRow<Record<string, unknown>>({
      created_at: '2026-11-02 18:44:12.531112+00',
      updated_at: '2026-11-02 13:44:12-05',
      start_date: '2026-11-02',
      end_date: null,
      timestamp: already,
      reviewed_at: 'not a date',
      role_code: '2026-11-02',
    });
    expect(row.createdAt).toEqual(new Date('2026-11-02T18:44:12.531Z'));
    expect(row.updatedAt).toEqual(new Date('2026-11-02T18:44:12.000Z'));
    expect(row.startDate).toEqual(new Date('2026-11-02T00:00:00.000Z'));
    expect(row.endDate).toBeNull();
    expect(row.timestamp).toBe(already);
    expect(row.reviewedAt).toBe('not a date');
    expect(row.roleCode).toBe('2026-11-02');
  });

  it('answers "no roles" for a non-member without touching the database', async () => {
    const synthetic = 'auth-org:0a4c9a2e';
    expect(await q.getMemberRoles(synthetic, ORG)).toEqual([]);
    expect(await q.getMemberHighestRoleLevel(synthetic, ORG)).toBe(0);
    expect(await q.getMemberEffectivePermissions(synthetic, ORG)).toEqual([]);
    expect(await q.memberHasRole(synthetic, ORG, 'admin')).toBe(false);
    expect(await q.memberHasRoleLevel(synthetic, ORG, 1)).toBe(false);
    expect(await q.getMemberPermissionExceptions(synthetic, ORG)).toEqual([]);
    expect(await q.memberHasPermissionException(synthetic, ORG, 'x')).toBe(false);
    expect(await q.findLivePermissionException(synthetic, ORG, 'x')).toBeNull();
    await expect(q.assignMemberRole(synthetic, ORG, 'steward', 'u')).rejects.toThrow(/organization member/);
    await expect(q.grantPermissionException(synthetic, ORG, 'x', 'claim', 'why', 'u')).rejects.toThrow(/organization member/);
    expect(rec.calls).toEqual([]);
  });
});

describe('who runs what', () => {
  it('reads as the tenant role and writes as the system role, and every write names its organization', async () => {
    rec.results.push([{ id: 'r1', member_id: MEMBER, role_name: 'Union Steward', role_level: 50, scope_type: 'global', term_status: 'indefinite' }]);
    const roles = await q.getMemberRoles(MEMBER, ORG);
    expect(last().via).toBe('tenant');
    expect(roles[0]).toMatchObject({ id: 'r1', memberId: MEMBER, roleName: 'Union Steward', roleLevel: 50, scopeType: 'global', termStatus: 'indefinite' });
    expect(last().params).toEqual(expect.arrayContaining([MEMBER, ORG]));

    const writes: Array<[string, () => Promise<unknown>]> = [
      ['updateMemberRole', () => q.updateMemberRole('role-1', ORG, 'u', { status: 'suspended', suspensionReason: 'x' })],
      ['approveMemberRole', () => q.approveMemberRole('role-1', ORG, 'u', 'ok')],
      ['revokeMemberRole', () => q.revokeMemberRole('role-1', ORG, 'u')],
      ['revokePermissionException', () => q.revokePermissionException('ex-1', ORG, 'u')],
      ['incrementExceptionUsage', () => q.incrementExceptionUsage('ex-1', ORG)],
      ['markAuditEntryReviewed', () => q.markAuditEntryReviewed('e-1', ORG, 'u')],
    ];
    for (const [name, run] of writes) {
      rec.calls = [];
      await run();
      expect(last().via, `${name} runs as the system role`).toBe('system');
      expect(squash(last().text), `${name} filters by organization`).toMatch(/organization_id = \$\d+/);
      expect(last().params, name).toContain(ORG);
    }
  });

  it('assigns, grants and expires as the system role', async () => {
    rec.results.push([{ id: 'r1' }]);
    await q.assignMemberRole(MEMBER, ORG, 'steward', 'creator', { requiresApproval: true });
    expect(last()).toMatchObject({ via: 'system', reason: 'rbac: assign-member-role' });
    expect(last().params).toEqual(expect.arrayContaining([MEMBER, ORG, 'steward', 'pending_approval', 'creator']));

    rec.results.push([{ id: 'x1' }]);
    await q.grantPermissionException(MEMBER, ORG, 'edit_all_claims', 'claim', 'urgent', 'approver', { usageLimit: 2 });
    expect(last()).toMatchObject({ via: 'system', reason: 'rbac: grant-permission-exception' });

    rec.results.push([{ id: 'a' }, { id: 'b' }]);
    expect(await q.expireOldTerms()).toBe(2);
    expect(last().via).toBe('system');
  });

  it('reports whether a write changed anything', async () => {
    rec.results.push([{ id: 'r' }]);
    expect(await q.revokeMemberRole('r', ORG, 'u')).toBe(true);
    rec.results.push([]);
    expect(await q.revokeMemberRole('r', ORG, 'u')).toBe(false);
    rec.results.push([]);
    expect(await q.incrementExceptionUsage('e', ORG)).toBe(false);
  });
});

describe('the statements are ones PostgreSQL can run', () => {
  it('binds the hours of denied attempts as a parameter, not inside an interval literal', async () => {
    await q.getDeniedAccessAttempts(ORG, 6);
    const text = squash(last().text);
    expect(text).toContain('make_interval(hours => $2::int)');
    expect(text).not.toMatch(/INTERVAL '/i);
    expect(last().params).toEqual([ORG, 6]);
  });

  it('casts the day window so the date arithmetic is unambiguous', async () => {
    await q.getExpiringRoles(ORG, 30);
    expect(squash(last().text)).toContain('CURRENT_DATE + $2::int');
    await q.getUpcomingElections(ORG, 60);
    expect(squash(last().text)).toContain('CURRENT_DATE + $2::int');
  });

  it('counts a role only while it is active, has begun and has not ended, through an active role definition', async () => {
    await q.getMemberHighestRoleLevel(MEMBER, ORG);
    const text = squash(last().text);
    expect(text).toContain("mr.status = 'active'");
    expect(text).toContain('mr.start_date <= CURRENT_DATE');
    expect(text).toContain('mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE');
    expect(text).toContain('rd.is_active');
  });

  it('counts an exception only while it is effective, unexpired, unrevoked and has uses left', async () => {
    await q.memberHasPermissionException(MEMBER, ORG, 'edit_all_claims', 'claim', 'c1');
    const text = squash(last().text);
    for (const part of ['is_active = TRUE', 'revoked_at IS NULL', 'effective_date <= NOW()', 'expires_at IS NULL OR expires_at > NOW()', 'usage_count < usage_limit']) {
      expect(text).toContain(part);
    }
    expect(text).toMatch(/resource_type = \$\d+/);
  });

  it('never lets a use pass the limit: the count and the check are one statement', async () => {
    await q.incrementExceptionUsage('e', ORG);
    const text = squash(last().text);
    expect(text).toContain('usage_count = usage_count + 1');
    expect(text).toContain('usage_count < usage_limit');
  });

  it('ends a revoked term no earlier than it began, so a role that has not started can be revoked', async () => {
    await q.revokeMemberRole('r', ORG, 'u');
    expect(squash(last().text)).toContain('end_date = GREATEST(CURRENT_DATE, start_date)');
  });

  it('starts a term and an exception on the database clock unless one is named, never on the application clock', async () => {
    rec.results.push([{ id: 'r1' }]);
    await q.assignMemberRole(MEMBER, ORG, 'steward', 'creator');
    expect(squash(last().text)).toMatch(/COALESCE\(\$\d+::date, CURRENT_DATE\)/);
    rec.results.push([{ id: 'x1' }]);
    await q.grantPermissionException(MEMBER, ORG, 'edit_all_claims', 'claim', 'urgent', 'approver');
    expect(squash(last().text)).toMatch(/COALESCE\(\$\d+::timestamptz, NOW\(\)\)/);
    expect(last().params.filter((p) => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p))).toEqual([]);
  });

  it('sends a date as text the statement casts: the UTC day for a date column, the instant for a timestamp', async () => {
    rec.results.push([{ id: 'r1' }]);
    await q.assignMemberRole(MEMBER, ORG, 'officer', 'creator', {
      startDate: new Date('2026-12-01T23:30:00.000-05:00'),
      endDate: new Date('2028-12-01T00:00:00.000Z'),
      nextElectionDate: new Date('2028-10-01T12:00:00.000Z'),
      electionDate: new Date('2026-11-20T12:00:00.000Z'),
      actingStartDate: new Date('2026-12-05T12:00:00.000Z'),
      actingEndDate: new Date('2026-12-09T12:00:00.000Z'),
    });
    expect(last().params).toEqual(expect.arrayContaining(['2026-12-02', '2028-12-01', '2028-10-01', '2026-11-20', '2026-12-05', '2026-12-09']));
    expect(squash(last().text)).toContain('COALESCE($6::date, CURRENT_DATE), $7::date');

    rec.results.push([{ id: 'x2' }]);
    await q.grantPermissionException(MEMBER, ORG, 'edit_all_claims', 'claim', 'urgent', 'approver', {
      effectiveDate: new Date('2026-12-01T00:00:00.000Z'),
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    });
    expect(last().params).toEqual(expect.arrayContaining(['2026-12-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z']));
    expect(squash(last().text)).toContain('COALESCE($9::timestamptz, NOW()), $10::timestamptz, $11');

    rec.results.push([{ id: 'r1' }]);
    await q.updateMemberRole('role-1', ORG, 'u', { endDate: new Date('2026-12-31T10:00:00.000Z') });
    expect(squash(last().text)).toContain('end_date = $1::date');
    expect(last().params[0]).toBe('2026-12-31');

    await q.getMemberAuditLogs('actor', ORG, { startDate: new Date('2026-12-01T00:00:00.000Z'), endDate: new Date('2026-12-31T00:00:00.000Z') });
    expect(squash(last().text)).toContain('timestamp >= $3::timestamptz AND timestamp <= $4::timestamptz');
    expect(last().params).toEqual(expect.arrayContaining(['2026-12-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z']));
  });

  it('orders the audit reads by the chain order, not by timestamp', async () => {
    await q.getMemberAuditLogs('actor', ORG, { deniedOnly: true, limit: 5 });
    expect(squash(last().text)).toContain('ORDER BY sequence_number DESC');
    expect(squash(last().text)).toContain('granted = FALSE');
    await q.getSensitiveActionsForReview(ORG);
    expect(squash(last().text)).toContain('requires_review = TRUE');
  });
});

describe('role definitions', () => {
  it('refuses a bad code, level or permission list before it reaches the database', async () => {
    await expect(q.createRoleDefinition('Bad Code', 'n', 10, [])).rejects.toThrow(/snake_case/);
    await expect(q.createRoleDefinition('good_code', 'n', -1, [])).rejects.toThrow(/non-negative/);
    await expect(q.createRoleDefinition('good_code', 'n', 1.5, [])).rejects.toThrow(/non-negative/);
    await expect(q.createRoleDefinition('good_code', 'n', 10, [''])).rejects.toThrow(/permissions/);
    expect(rec.calls).toEqual([]);
  });

  it('stores a custom role as a non-system role with its permissions sorted and de-duplicated', async () => {
    rec.results.push([{ id: 'd1', role_code: 'custom_role', is_system_role: false }]);
    const role = await q.createRoleDefinition('custom_role', 'Custom', 35, ['b', 'a', 'b']);
    expect(role).toMatchObject({ roleCode: 'custom_role', isSystemRole: false });
    expect(last().via).toBe('system');
    expect(last().params).toContain('["a","b"]');
    expect(squash(last().text)).toMatch(/, FALSE \) RETURNING \*/);
  });
});

describe('the audit chain', () => {
  const entry = { actorId: 'actor-1', action: 'check_permission', resourceType: 'claim', resourceId: 'c1', organizationId: ORG, granted: false, requiredPermission: 'edit_all_claims', denialReason: 'no', requestId: 'req-1' };

  it('hashes deterministically, and every field and the previous hash change the result', () => {
    const base = { organizationId: ORG, timestamp: new Date('2026-11-02T12:00:00.000Z'), actorId: 'a', action: 'x', resourceType: 'claim', granted: true };
    const h = q.computeAuditRecordHash(null, base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(q.computeAuditRecordHash(null, { ...base })).toBe(h);
    expect(q.computeAuditRecordHash('prev', base)).not.toBe(h);
    for (const change of [{ granted: false }, { actorId: 'b' }, { action: 'y' }, { resourceId: 'r' }, { denialReason: 'd' }, { timestamp: new Date('2026-11-02T12:00:00.001Z') }, { organizationId: 'o' }]) {
      expect(q.computeAuditRecordHash(null, { ...base, ...change }), JSON.stringify(change)).not.toBe(h);
    }
  });

  it('takes the organization lock, reads the head of the chain, and writes an entry that names it', async () => {
    rec.results.push([], [{ record_hash: 'head-hash' }], []);
    const id = await q.recordPermissionCheck(entry);
    expect(rec.calls).toHaveLength(3);
    expect(squash(rec.calls[0].text)).toContain('pg_advisory_xact_lock(hashtextextended($1, 0))');
    expect(rec.calls[0].params).toEqual([`rbac_audit_log:${ORG}`]);
    expect(squash(rec.calls[1].text)).toContain('ORDER BY sequence_number DESC LIMIT 1');
    const insert = rec.calls[2];
    expect(insert.via).toBe('system');
    expect(insert.params).toContain('head-hash');
    expect(squash(insert.text)).toContain('$2::timestamptz');
    const iso = insert.params.find((p) => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p)) as string;
    const stored = insert.params.find((p) => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p)) as string;
    expect(stored).toBe(q.computeAuditRecordHash('head-hash', { ...entry, timestamp: new Date(iso) }));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('starts a chain with no previous hash', async () => {
    rec.results.push([], [], []);
    await q.recordPermissionCheck(entry);
    expect(rec.calls[2].params).toContain(null);
  });

  it('queues a sensitive decision for review and not an ordinary one', async () => {
    rec.results.push([], [], []);
    await q.recordPermissionCheck({ ...entry, isSensitive: true });
    expect(rec.calls[2].params.filter((p) => p === true).length).toBe(2);
    rec.calls = [];
    rec.results.push([], [], []);
    await q.recordPermissionCheck(entry);
    expect(rec.calls[2].params.filter((p) => p === true).length).toBe(0);
  });

  it('does not throw when writing the log fails, and says so', async () => {
    rec.fail = new Error('relation does not exist');
    await expect(q.logPermissionCheck(entry)).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logger.error).toHaveBeenCalledWith('Failed to write audit log', expect.objectContaining({ organizationId: ORG }));
  });

  describe('verification', () => {
    // The driver returns a timestamp as the server's text ("2026-11-02 12:00:01+00"); a driver that parses it returns a Date. Both verify.
    const pgText = (at: Date) => at.toISOString().replace('T', ' ').replace(/(\.000)?Z$/, '+00');
    const chain = (n: number, asText = true) => {
      const rows: Array<Record<string, unknown>> = [];
      let previous: string | null = null;
      for (let i = 1; i <= n; i += 1) {
        const timestamp = new Date(Date.UTC(2026, 10, 2, 12, 0, i));
        const granted = i % 2 === 0;
        const hash = q.computeAuditRecordHash(previous, { organizationId: ORG, timestamp, actorId: 'a', action: 'x', resourceType: 'claim', resourceId: `r${i}`, granted });
        rows.push({
          id: `e${i}`, sequence_number: i, timestamp: asText ? pgText(timestamp) : timestamp, actor_id: 'a', on_behalf_of_id: null, action: 'x', resource_type: 'claim', resource_id: `r${i}`, organization_id: ORG,
          required_permission: null, granted, grant_method: null, denial_reason: null, request_id: null, session_id: null, previous_hash: previous, record_hash: hash,
        });
        previous = hash;
      }
      return rows;
    };

    it('accepts an intact chain, whether the driver returns the timestamps as text or as Dates', async () => {
      rec.results.push(chain(4));
      expect(await q.verifyAuditLogIntegrity(ORG)).toEqual({ valid: true, totalRecords: 4, invalidRecords: 0 });
      expect(last().via).toBe('system');
      rec.results.push(chain(4, false));
      expect(await q.verifyAuditLogIntegrity(ORG)).toEqual({ valid: true, totalRecords: 4, invalidRecords: 0 });
    });

    it('finds an edited entry, not only a broken link', async () => {
      const rows = chain(4);
      rows[1] = { ...rows[1], granted: !rows[1].granted };
      rec.results.push(rows);
      expect(await q.verifyAuditLogIntegrity(ORG)).toEqual({ valid: false, totalRecords: 4, invalidRecords: 1, firstInvalidRecordId: 'e2' });
    });

    it('finds a deleted entry (the next one names a hash that is not the one before it)', async () => {
      const rows = chain(4);
      rows.splice(1, 1);
      rec.results.push(rows);
      expect(await q.verifyAuditLogIntegrity(ORG)).toEqual({ valid: false, totalRecords: 3, invalidRecords: 1, firstInvalidRecordId: 'e3' });
    });

    it('finds a chain whose first entry names a predecessor that is not there', async () => {
      const rows = chain(3);
      rows.shift();
      rec.results.push(rows);
      expect(await q.verifyAuditLogIntegrity(ORG)).toMatchObject({ valid: false, totalRecords: 2, invalidRecords: 1, firstInvalidRecordId: 'e2' });
    });

    it('takes the first link of a range as stored', async () => {
      rec.results.push(chain(4).slice(1));
      expect(await q.verifyAuditLogIntegrity(ORG, new Date('2026-11-02T12:00:00Z'))).toEqual({ valid: true, totalRecords: 3, invalidRecords: 0 });
    });

    it('carries the previous hash across a page boundary and asks for the next page after the last sequence it read', async () => {
      const rows = chain(q.AUDIT_VERIFY_PAGE + 5);
      rec.results.push(rows.slice(0, q.AUDIT_VERIFY_PAGE), rows.slice(q.AUDIT_VERIFY_PAGE));
      expect(await q.verifyAuditLogIntegrity(ORG)).toEqual({ valid: true, totalRecords: q.AUDIT_VERIFY_PAGE + 5, invalidRecords: 0 });
      expect(rec.calls).toHaveLength(2);
      expect(rec.calls[0].params).toEqual([ORG, 0, q.AUDIT_VERIFY_PAGE]);
      expect(rec.calls[1].params).toEqual([ORG, q.AUDIT_VERIFY_PAGE, q.AUDIT_VERIFY_PAGE]);
    });

    it('finds a broken link that falls on the first entry of the second page', async () => {
      const rows = chain(q.AUDIT_VERIFY_PAGE + 5);
      rows[q.AUDIT_VERIFY_PAGE] = { ...rows[q.AUDIT_VERIFY_PAGE], previous_hash: 'not-the-hash-before-it' };
      rec.results.push(rows.slice(0, q.AUDIT_VERIFY_PAGE), rows.slice(q.AUDIT_VERIFY_PAGE));
      expect(await q.verifyAuditLogIntegrity(ORG)).toMatchObject({ valid: false, firstInvalidRecordId: `e${q.AUDIT_VERIFY_PAGE + 1}` });
    });
  });
});
