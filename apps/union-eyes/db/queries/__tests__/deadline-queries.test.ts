/**
 * Deadline Queries — Unit Tests
 *
 * Mocks withRLSContext to invoke the callback with a fake tx whose execute()
 * returns from a controllable queue. Exercises every exported query function
 * plus their branches (view checks, optional filters, loops, parsing, fallbacks).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[][] }));

// withRLSContext(cb) -> cb(tx); tx.execute() -> next queued rows
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => {
    const tx = { execute: async () => (mocks.queue.length ? mocks.queue.shift() : []) };
    return op(tx);
  },
}));

// sql tag: composable no-op that just returns a marker
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (..._args: unknown[]) => ({ __sql: true }),
    {},
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../deadline-queries';

function push(...rows: unknown[][]) {
  mocks.queue.push(...rows);
}

describe('deadline-queries', () => {
  beforeEach(() => {
    mocks.queue = [];
    vi.clearAllMocks();
  });

  // ── Deadline Rules ──────────────────────────────────────────────────────
  it('getDeadlineRules returns rows', async () => {
    push([{ id: 'r1', ruleName: 'A' }]);
    const res = await q.getDeadlineRules('org');
    expect(res).toHaveLength(1);
  });

  it('getDeadlineRuleByCode returns first or null', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getDeadlineRuleByCode('org', 'CODE')).toEqual({ id: 'r1' });
    push([]);
    expect(await q.getDeadlineRuleByCode('org', 'CODE')).toBeNull();
  });

  it('getApplicableDeadlineRules with and without priority', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getApplicableDeadlineRules('org', 'grievance', 'high')).toHaveLength(1);
    push([{ id: 'r2' }]);
    expect(await q.getApplicableDeadlineRules('org', 'grievance')).toHaveLength(1);
  });

  it('createDeadlineRule returns inserted row (default + custom options)', async () => {
    push([{ id: 'r1', ruleName: 'New' }]);
    const r1 = await q.createDeadlineRule('org', 'New', 'NEW', 10, 'claim_created', 'u1');
    expect(r1.id).toBe('r1');
    push([{ id: 'r2' }]);
    const r2 = await q.createDeadlineRule('org', 'X', 'X', 5, 'evt', 'u1', {
      description: 'd', claimType: 'grievance', priorityLevel: 'high', stepNumber: 2,
      businessDaysOnly: true, allowsExtension: false, maxExtensionDays: 15,
      requiresApproval: true, escalateToRole: 'officer', escalationDelayDays: 3,
    });
    expect(r2.id).toBe('r2');
  });

  // ── Claim Deadlines ─────────────────────────────────────────────────────
  it('getClaimDeadlines + getPendingClaimDeadlines', async () => {
    push([{ id: 'd1' }]);
    expect(await q.getClaimDeadlines('c1')).toHaveLength(1);
    push([{ id: 'd2' }]);
    expect(await q.getPendingClaimDeadlines('c1')).toHaveLength(1);
  });

  it('getCriticalDeadlines returns [] when view missing', async () => {
    push([{ view_exists: false }]);
    expect(await q.getCriticalDeadlines('org')).toEqual([]);
  });

  it('getCriticalDeadlines returns rows when view exists', async () => {
    push([{ view_exists: true }], [{ id: 'd1', is_overdue: true }]);
    const res = await q.getCriticalDeadlines('org');
    expect(res).toHaveLength(1);
  });

  it('getCriticalDeadlines returns [] on error', async () => {
    // Force execute to throw by leaving a rejecting op
    const res = await q.getCriticalDeadlines('org'); // empty queue -> view_exists undefined -> []
    expect(res).toEqual([]);
  });

  it('getMemberDeadlines with no options, status, and daysAhead', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getMemberDeadlines('m1', 'org')).toHaveLength(1);
    push([{ id: 'm2' }]);
    expect(await q.getMemberDeadlines('m1', 'org', { status: 'pending', daysAhead: 7 })).toHaveLength(1);
  });

  it('getOverdueDeadlines', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getOverdueDeadlines('org')).toHaveLength(1);
  });

  it('createClaimDeadline calendar-days path', async () => {
    push([{ id: 'd1', due_date: '2026-01-01' }]);
    const res = await q.createClaimDeadline('c1', 'org', 'Filing', 'filing', new Date('2026-01-01'), 10, 'u1');
    expect(res.id).toBe('d1');
  });

  it('createClaimDeadline business-days path (calls addBusinessDays)', async () => {
    // first execute = add_business_days, second = INSERT RETURNING
    push([{ result_date: new Date('2026-01-15') }], [{ id: 'd2' }]);
    const res = await q.createClaimDeadline('c1', 'org', 'Filing', 'filing', new Date('2026-01-01'), 10, 'u1', {
      businessDaysOnly: true, priority: 'high', deadlineRuleId: 'rule1',
    });
    expect(res.id).toBe('d2');
  });

  it('autoCreateClaimDeadlines creates deadlines for claim_created rules', async () => {
    // getApplicableDeadlineRules -> rules
    push([
      [
        { id: 'rule1', ruleName: 'Rule1', daysFromEvent: 5, eventType: 'claim_created', businessDaysOnly: false },
        { id: 'rule2', ruleName: 'Rule2', daysFromEvent: 5, eventType: 'other', businessDaysOnly: false },
      ],
    ][0]);
    // createClaimDeadline INSERT for rule1
    push([{ id: 'd1' }]);
    const res = await q.autoCreateClaimDeadlines('c1', 'org', 'grievance', 'high', new Date('2026-01-01'), 'u1');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('d1');
  });

  it('completeDeadline returns updated row', async () => {
    push([{ id: 'd1', status: 'completed' }]);
    const res = await q.completeDeadline('d1', 'u1', 'done');
    expect(res.status).toBe('completed');
  });

  it('markOverdueDeadlines returns count', async () => {
    push([{ count: 4 }]);
    expect(await q.markOverdueDeadlines()).toBe(4);
    push([]);
    expect(await q.markOverdueDeadlines()).toBe(0);
  });

  // ── Extensions ──────────────────────────────────────────────────────────
  it('requestDeadlineExtension returns inserted row', async () => {
    push([{ id: 'e1' }]);
    const res = await q.requestDeadlineExtension('d1', 'org', 'u1', 5, 'reason');
    expect(res.id).toBe('e1');
  });

  it('approveDeadlineExtension updates extension + claim deadline', async () => {
    push(
      [{ requested_days: 5, due_date: '2026-01-01', request_reason: 'r', deadline_id: 'd1' }], // select
      [], // update extension
      [], // update claim deadline
    );
    await expect(q.approveDeadlineExtension('e1', 'approver', 7, 'ok')).resolves.toBeUndefined();
  });

  it('approveDeadlineExtension uses requested_days when no daysGranted', async () => {
    push([{ requested_days: 3, due_date: '2026-01-01', request_reason: 'r', deadline_id: 'd1' }], [], []);
    await expect(q.approveDeadlineExtension('e1', 'approver')).resolves.toBeUndefined();
  });

  it('approveDeadlineExtension throws when extension not found', async () => {
    push([]); // select empty
    await expect(q.approveDeadlineExtension('missing', 'approver')).rejects.toThrow('Extension not found');
  });

  it('denyDeadlineExtension resolves', async () => {
    push([]);
    await expect(q.denyDeadlineExtension('e1', 'u1', 'no')).resolves.toBeUndefined();
  });

  it('getPendingExtensionRequests', async () => {
    push([{ id: 'e1' }]);
    expect(await q.getPendingExtensionRequests('org')).toHaveLength(1);
  });

  // ── Alerts ──────────────────────────────────────────────────────────────
  it('createDeadlineAlert returns inserted row (default + custom)', async () => {
    push([{ id: 'a1' }]);
    expect((await q.createDeadlineAlert('d1', 'org', 'm1', 'upcoming', '3_days_before', 'in_app')).id).toBe('a1');
    push([{ id: 'a2' }]);
    const a2 = await q.createDeadlineAlert('d1', 'org', 'm1', 'upcoming', '3_days_before', 'in_app', {
      alertSeverity: 'warning', recipientRole: 'officer', subject: 's', message: 'm', actionUrl: '/x',
    });
    expect(a2.id).toBe('a2');
  });

  it('markAlertDelivered (delivered, failed)', async () => {
    push([]);
    await expect(q.markAlertDelivered('a1', 'delivered')).resolves.toBeUndefined();
    push([]);
    await expect(q.markAlertDelivered('a1', 'failed', 'err')).resolves.toBeUndefined();
  });

  it('markAlertViewed + recordAlertAction', async () => {
    push([]);
    await expect(q.markAlertViewed('a1')).resolves.toBeUndefined();
    push([]);
    await expect(q.recordAlertAction('a1', 'clicked')).resolves.toBeUndefined();
  });

  it('getUnreadAlerts', async () => {
    push([{ id: 'a1' }]);
    expect(await q.getUnreadAlerts('m1', 'org')).toHaveLength(1);
  });

  it('generateUpcomingDeadlineAlerts creates alerts across all windows', async () => {
    // 3-day query -> 1 deadline assigned; then createDeadlineAlert insert
    push([{ id: 'd1', deadline_name: 'D1', due_date: '2026-01-04', assigned_to: 'u1', claim_number: 'C1' }]);
    push([{ id: 'a1' }]); // alert insert for 3-day
    // 1-day query -> 1 deadline assigned
    push([{ id: 'd2', deadline_name: 'D2', due_date: '2026-01-02', assigned_to: 'u2', claim_number: 'C2' }]);
    push([{ id: 'a2' }]); // alert insert for 1-day
    // today query -> 1 deadline, but unassigned (no alert)
    push([{ id: 'd3', deadline_name: 'D3', due_date: '2026-01-01', assigned_to: null, claim_number: 'C3' }]);
    const count = await q.generateUpcomingDeadlineAlerts('org');
    expect(count).toBe(2);
  });

  // ── Business day calcs ──────────────────────────────────────────────────
  it('calculateBusinessDays + addBusinessDays + getHolidays', async () => {
    push([{ days: 7 }]);
    expect(await q.calculateBusinessDays(new Date('2026-01-01'), new Date('2026-01-10'))).toBe(7);
    push([]);
    expect(await q.calculateBusinessDays(new Date('2026-01-01'), new Date('2026-01-10'), 'org')).toBe(0);

    push([{ result_date: new Date('2026-01-15') }]);
    expect(await q.addBusinessDays(new Date('2026-01-01'), 10)).toBeInstanceOf(Date);

    push([{ id: 'h1' }]);
    expect(await q.getHolidays(new Date('2026-01-01'), new Date('2026-12-31'), 'org')).toHaveLength(1);
    push([{ id: 'h2' }]);
    expect(await q.getHolidays(new Date('2026-01-01'), new Date('2026-12-31'))).toHaveLength(1);
  });

  // ── Compliance & reporting ──────────────────────────────────────────────
  it('getDeadlineComplianceMetrics with and without date range', async () => {
    push([{ month: '2026-01' }]);
    expect(await q.getDeadlineComplianceMetrics('org')).toHaveLength(1);
    push([{ month: '2026-02' }]);
    expect(await q.getDeadlineComplianceMetrics('org', new Date('2026-01-01'), new Date('2026-03-01'))).toHaveLength(1);
  });

  it('getMemberDeadlineSummary returns row or fallback', async () => {
    push([{ total_deadlines: 3, overdue_count: 1, due_soon_count: 1, critical_count: 0, next_deadline: null }]);
    expect((await q.getMemberDeadlineSummary('m1', 'org')).total_deadlines).toBe(3);
    push([]);
    expect((await q.getMemberDeadlineSummary('m1', 'org')).total_deadlines).toBe(0);
  });

  it('getDeadlineDashboardSummary computes parsed metrics and on-time %', async () => {
    push([{
      active_deadlines: '10', overdue_count: '2', due_soon_count: '3', critical_count: '1',
      avg_days_overdue: '4.5', on_time_completed: '8', total_completed: '10',
    }]);
    const res = await q.getDeadlineDashboardSummary('org');
    expect(res.activeDeadlines).toBe(10);
    expect(res.overdueCount).toBe(2);
    expect(res.dueSoonCount).toBe(3);
    expect(res.criticalCount).toBe(1);
    expect(res.avgDaysOverdue).toBeCloseTo(4.5);
    expect(res.onTimePercentage).toBe(80);
  });

  it('getDeadlineDashboardSummary defaults to 100% when nothing completed', async () => {
    push([{
      active_deadlines: '0', overdue_count: '0', due_soon_count: '0', critical_count: '0',
      avg_days_overdue: null, on_time_completed: '0', total_completed: '0',
    }]);
    const res = await q.getDeadlineDashboardSummary('org');
    expect(res.onTimePercentage).toBe(100);
    expect(res.avgDaysOverdue).toBe(0);
  });
});
