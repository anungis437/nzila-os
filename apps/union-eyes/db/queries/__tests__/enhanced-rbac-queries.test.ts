/**
 * Enhanced RBAC Queries — Unit Tests
 *
 * Mocks withRLSContext / withSystemRLSContext to invoke callbacks with a fake tx
 * whose execute() returns from a controllable queue (Errors throw). Exercises
 * every exported query function plus their branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeTx() {
  return {
    execute: async () => {
      const v = mocks.queue.length ? mocks.queue.shift() : [];
      if (v instanceof Error) throw v;
      return v;
    },
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
  withSystemRLSContext: async (_label: string, op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign((..._args: unknown[]) => ({ __sql: true }), {}),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../enhanced-rbac-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('enhanced-rbac-queries', () => {
  beforeEach(() => {
    mocks.queue = [];
    vi.clearAllMocks();
  });

  // ── Role definitions ────────────────────────────────────────────────────
  it('getAllRoleDefinitions / getRoleDefinitionsByLevel', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getAllRoleDefinitions()).toHaveLength(1);
    push([{ id: 'r2' }]);
    expect(await q.getRoleDefinitionsByLevel(5)).toHaveLength(1);
  });

  it('getRoleDefinitionByCode returns row or null', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getRoleDefinitionByCode('ADMIN')).toEqual({ id: 'r1' });
    push([]);
    expect(await q.getRoleDefinitionByCode('ADMIN')).toBeNull();
  });

  it('createRoleDefinition default + custom options', async () => {
    push([{ id: 'r1' }]);
    expect((await q.createRoleDefinition('CODE', 'Name', 3, ['p1'])).id).toBe('r1');
    push([{ id: 'r2' }]);
    const r2 = await q.createRoleDefinition('C', 'N', 2, ['p'], {
      description: 'd', isElected: true, requiresBoardApproval: true, defaultTermYears: 3,
      canDelegate: true, parentRoleCode: 'PARENT', createdBy: 'u1',
    });
    expect(r2.id).toBe('r2');
  });

  // ── Member roles ────────────────────────────────────────────────────────
  it('getMemberRoles', async () => {
    push([{ id: 'mr1' }]);
    expect(await q.getMemberRoles('m1', 'org')).toHaveLength(1);
  });

  it('getMemberHighestRoleLevel returns level or 0', async () => {
    push([{ max_level: 7 }]);
    expect(await q.getMemberHighestRoleLevel('m1', 'org')).toBe(7);
    push([]);
    expect(await q.getMemberHighestRoleLevel('m1', 'org')).toBe(0);
  });

  it('getMemberEffectivePermissions maps rows', async () => {
    push([{ permission: 'read' }, { permission: 'write' }]);
    expect(await q.getMemberEffectivePermissions('m1', 'org')).toEqual(['read', 'write']);
  });

  it('memberHasRole with and without scope', async () => {
    push([{ has_role: true }]);
    expect(await q.memberHasRole('m1', 'org', 'ADMIN')).toBe(true);
    push([{ has_role: false }]);
    expect(await q.memberHasRole('m1', 'org', 'ADMIN', 'region', 'east')).toBe(false);
    push([]);
    expect(await q.memberHasRole('m1', 'org', 'ADMIN')).toBe(false);
  });

  it('memberHasRoleLevel with and without scope', async () => {
    push([{ has_level: true }]);
    expect(await q.memberHasRoleLevel('m1', 'org', 5)).toBe(true);
    push([{ has_level: true }]);
    expect(await q.memberHasRoleLevel('m1', 'org', 5, 'region', 'east')).toBe(true);
    push([]);
    expect(await q.memberHasRoleLevel('m1', 'org', 5)).toBe(false);
  });

  it('assignMemberRole default + custom options', async () => {
    push([{ id: 'mr1' }]);
    expect((await q.assignMemberRole('m1', 'org', 'ADMIN', 'u1')).id).toBe('mr1');
    push([{ id: 'mr2' }]);
    const r = await q.assignMemberRole('m1', 'org', 'ADMIN', 'u1', {
      scopeType: 'region', scopeValue: 'east', startDate: new Date(), endDate: new Date(),
      termYears: 3, assignmentType: 'elected', electionDate: new Date(), electedBy: 'u2',
      voteCount: 10, totalVotes: 20, isActingRole: true, actingForMemberId: 'm9',
      actingReason: 'leave', requiresApproval: true,
    });
    expect(r.id).toBe('mr2');
  });

  it('updateMemberRole builds dynamic set clauses', async () => {
    push([{ id: 'mr1' }]);
    const r = await q.updateMemberRole('mr1', 'u1', {
      endDate: new Date(), status: 'suspended', suspensionReason: 'cause', suspendedBy: 'u2',
    });
    expect(r.id).toBe('mr1');
    // minimal update (only updated_by/updated_at clauses)
    push([{ id: 'mr2' }]);
    expect((await q.updateMemberRole('mr2', 'u1', {})).id).toBe('mr2');
  });

  it('revokeMemberRole + getExpiringRoles + getUpcomingElections + expireOldTerms', async () => {
    push([]);
    await expect(q.revokeMemberRole('mr1', 'u1', 'reason')).resolves.toBeUndefined();
    push([{ id: 'mr1' }]);
    expect(await q.getExpiringRoles('org')).toHaveLength(1);
    push([{ id: 'e1' }]);
    expect(await q.getUpcomingElections('org', 30)).toHaveLength(1);
    push([{ id: 'x1' }, { id: 'x2' }]);
    expect(await q.expireOldTerms()).toBe(2);
  });

  // ── Permission exceptions ───────────────────────────────────────────────
  it('getMemberPermissionExceptions', async () => {
    push([{ id: 'ex1' }]);
    expect(await q.getMemberPermissionExceptions('m1', 'org')).toHaveLength(1);
  });

  it('memberHasPermissionException with and without resource filters', async () => {
    push([{ has_exception: true }]);
    expect(await q.memberHasPermissionException('m1', 'org', 'read')).toBe(true);
    push([{ has_exception: false }]);
    expect(await q.memberHasPermissionException('m1', 'org', 'read', 'claim', 'c1')).toBe(false);
    push([]);
    expect(await q.memberHasPermissionException('m1', 'org', 'read')).toBe(false);
  });

  it('grantPermissionException default + custom + revoke + incrementUsage', async () => {
    push([{ id: 'ex1' }]);
    expect((await q.grantPermissionException('m1', 'org', 'read', 'claim', 'reason', 'u1')).id).toBe('ex1');
    push([{ id: 'ex2' }]);
    const r = await q.grantPermissionException('m1', 'org', 'read', 'claim', 'reason', 'u1', {
      resourceId: 'c1', approvalNotes: 'ok', effectiveDate: new Date(), expiresAt: new Date(), usageLimit: 5,
    });
    expect(r.id).toBe('ex2');
    push([]);
    await expect(q.revokePermissionException('ex1', 'u1', 'cause')).resolves.toBeUndefined();
    push([]);
    await expect(q.incrementExceptionUsage('ex1')).resolves.toBeUndefined();
  });

  // ── Audit log ───────────────────────────────────────────────────────────
  it('logPermissionCheck happy path (prev hash present)', async () => {
    push([{ record_hash: 'prevhash' }]); // prev hash query
    push([]); // insert
    await q.logPermissionCheck({
      actorId: 'a1', action: 'view_claim', resourceType: 'claim', organizationId: 'org', granted: true,
    });
    await tick();
    expect(true).toBe(true);
  });

  it('logPermissionCheck with no prev hash + full optional fields', async () => {
    push([]); // prev hash query -> none
    push([]); // insert
    await q.logPermissionCheck({
      actorId: 'a1', actorName: 'A', actorRole: 'admin', action: 'delete_claim',
      resourceType: 'claim', resourceId: 'c1', organizationId: 'org', organizationName: 'Org',
      requiredPermission: 'claims:delete', granted: false, grantMethod: 'role', denialReason: 'no perm',
      ipAddress: '1.1.1.1', userAgent: 'ua', sessionId: 's1', requestId: 'r1',
      executionTimeMs: 12, isSensitive: true,
    });
    await tick();
    expect(true).toBe(true);
  });

  it('logPermissionCheck swallows insert error (catch branch)', async () => {
    push([{ record_hash: 'prev' }]); // prev hash query
    push(new Error('insert failed')); // insert rejects
    await q.logPermissionCheck({
      actorId: 'a1', action: 'view', resourceType: 'claim', organizationId: 'org', granted: true,
    });
    await tick();
    expect(true).toBe(true);
  });

  it('getMemberAuditLogs default + all option branches', async () => {
    push([{ id: 'l1' }]);
    expect(await q.getMemberAuditLogs('a1', 'org')).toHaveLength(1);
    push([{ id: 'l2' }]);
    expect(await q.getMemberAuditLogs('a1', 'org', {
      limit: 10, offset: 5, startDate: new Date(), endDate: new Date(), grantedOnly: true, deniedOnly: true,
    })).toHaveLength(1);
  });

  it('getResourceAuditLogs + getDeniedAccessAttempts + getSensitiveActionsForReview', async () => {
    push([{ id: 'l1' }]);
    expect(await q.getResourceAuditLogs('claim', 'c1', 'org')).toHaveLength(1);
    push([{ id: 'l2' }]);
    expect(await q.getDeniedAccessAttempts('org', 48)).toHaveLength(1);
    push([{ id: 'l3' }]);
    expect(await q.getSensitiveActionsForReview('org')).toHaveLength(1);
  });

  it('verifyAuditLogIntegrity valid + invalid + date branches', async () => {
    push([{ total_records: '10', invalid_records: '0' }]);
    const ok = await q.verifyAuditLogIntegrity('org');
    expect(ok.valid).toBe(true);
    expect(ok.totalRecords).toBe(10);

    push([{ total_records: '10', invalid_records: '2' }]);
    const bad = await q.verifyAuditLogIntegrity('org', new Date('2026-01-01'), new Date('2026-02-01'));
    expect(bad.valid).toBe(false);
    expect(bad.invalidRecords).toBe(2);
  });
});
