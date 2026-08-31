import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Reminder worker unit tests — proves the state-machine transitions:
 *  - stale lease recovery → pending
 *  - claim → attempt → sent
 *  - claim → transient failure with attempts remaining → pending (retry)
 *  - claim → transient failure with no attempts remaining → dead_letter
 *  - claim → permanent failure → dead_letter
 *  - empty batch → no-op (no errors)
 *
 * The FOR UPDATE SKIP LOCKED concurrency semantics are validated by the
 * live D1 staging scenario, not this test.
 */

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  txExecute: vi.fn(),
  deliver: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.execute,
    transaction: vi.fn(async (fn: (tx: { execute: typeof mocks.txExecute }) => Promise<void>) => {
      return fn({ execute: mocks.txExecute });
    }),
  },
}));

vi.mock('../email-adapter', () => ({
  deliverDeadlineReminderEmail: mocks.deliver,
}));

vi.mock('../audit', () => ({
  writeDeadlineAuditEvent: mocks.audit,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { runDeadlineReminderWorker } from '../reminder-worker';

const NOW = new Date('2026-08-15T12:00:00.000Z');
const ORG = '00000000-0000-0000-0000-000000000010';

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r-1',
    source_deadline_id: 'd-1',
    organization_id: ORG,
    recipient_user_id: 'officer-A',
    recipient_role: 'assigned_officer',
    recipient_email: 'a@example.com',
    recipient_locale: 'en',
    message_subject: 'Union Eyes deadline reminder',
    reminder_kind: 'upcoming',
    offset_days: 3,
    scheduled_for: NOW.toISOString(),
    attempt_count: 1,
    max_attempts: 5,
    ...overrides,
  };
}

const GRIEVANCE_ID = 'g-1';

/** The dispatch-time revalidation query result for a still-eligible reminder. */
function makeEligibleRevalidation(overrides: Partial<Record<string, unknown>> = {}) {
  return [
    {
      reminder_status: 'claimed',
      deadline_status: 'pending',
      grievance_id: GRIEVANCE_ID,
      current_union_rep_id: 'officer-A',
      ...overrides,
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reminder-worker', () => {
  it('returns a structured result (never a boolean) even when nothing to do', async () => {
    mocks.execute
      .mockResolvedValueOnce([]) // lease recovery
      .mockResolvedValueOnce([]); // claim

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(typeof result).toBe('object');
    expect(result).toMatchObject({
      workerInstance: 'worker-test',
      examined: 0,
      claimed: 0,
      sent: 0,
      transientFailures: 0,
      permanentFailures: 0,
      deadLettered: 0,
      leasesRecovered: 0,
    });
    expect(typeof result.runId).toBe('string');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('recovers stale leases before claiming new work', async () => {
    mocks.execute
      .mockResolvedValueOnce([
        { id: 'stale-1', organization_id: ORG, source_deadline_id: 'd-9' },
        { id: 'stale-2', organization_id: ORG, source_deadline_id: 'd-9' },
      ]) // lease recovery returns 2 rows
      .mockResolvedValueOnce([]); // claim

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.leasesRecovered).toBe(2);
    const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(auditTypes.filter((t) => t === 'reminder.lease_recovered')).toHaveLength(2);
  });

  it('on successful delivery: writes execution + transitions to sent + emits reminder.sent', async () => {
    mocks.execute
      .mockResolvedValueOnce([]) // recovery
      .mockResolvedValueOnce([makeRow()]) // claim
      .mockResolvedValueOnce(makeEligibleRevalidation()); // dispatch-time revalidation for r-1
    mocks.deliver.mockResolvedValueOnce({
      kind: 'sent',
      provider: 'resend',
      providerMessageId: 'msg-42',
    });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.sent).toBe(1);
    expect(result.claimed).toBe(1);
    expect(result.deadLettered).toBe(0);
    // Transactional tx.execute: 1 insert-execution + 1 update-status
    expect(mocks.txExecute).toHaveBeenCalledTimes(2);
    // Audit: reminder.claimed + reminder.sent
    const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(auditTypes).toContain('reminder.claimed');
    expect(auditTypes).toContain('reminder.sent');
    expect(auditTypes).not.toContain('reminder.dead_lettered');
  });

  it('on transient failure with attempts remaining: returns row to pending + emits reminder.failed_transient', async () => {
    mocks.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRow({ attempt_count: 2, max_attempts: 5 })])
      .mockResolvedValueOnce(makeEligibleRevalidation());
    mocks.deliver.mockResolvedValueOnce({
      kind: 'transient_failure',
      provider: 'resend',
      statusCode: 429,
      code: 'rate_limited',
      message: 'Too many requests',
    });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.transientFailures).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.deadLettered).toBe(0);
    const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(auditTypes).toContain('reminder.failed_transient');
    expect(auditTypes).not.toContain('reminder.dead_lettered');
  });

  it('on transient failure at max attempts: transitions to dead_letter (never lost)', async () => {
    mocks.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRow({ attempt_count: 5, max_attempts: 5 })])
      .mockResolvedValueOnce(makeEligibleRevalidation());
    mocks.deliver.mockResolvedValueOnce({
      kind: 'transient_failure',
      provider: 'resend',
      statusCode: 503,
      code: 'unavailable',
      message: 'Provider down',
    });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.deadLettered).toBe(1);
    // Transient failures counter always increments — dead-letter is an additional label.
    expect(result.transientFailures).toBe(1);
    const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(auditTypes).toContain('reminder.dead_lettered');
  });

  it('on permanent failure: transitions to dead_letter immediately (no retry)', async () => {
    mocks.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRow({ attempt_count: 1, max_attempts: 5 })])
      .mockResolvedValueOnce(makeEligibleRevalidation());
    mocks.deliver.mockResolvedValueOnce({
      kind: 'permanent_failure',
      provider: 'resend',
      statusCode: 400,
      code: 'invalid_recipient',
      message: 'Bad address',
    });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.deadLettered).toBe(1);
    expect(result.permanentFailures).toBe(1);
    expect(result.sent).toBe(0);
    const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
    expect(auditTypes).toContain('reminder.dead_lettered');
    expect(auditTypes).not.toContain('reminder.failed_transient');
  });

  it('when email adapter is disabled: reminder is dead-lettered (fails visibly, never silent)', async () => {
    mocks.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeRow({ attempt_count: 1, max_attempts: 5 })])
      .mockResolvedValueOnce(makeEligibleRevalidation());
    mocks.deliver.mockResolvedValueOnce({
      kind: 'disabled',
      message: 'RESEND_API_KEY not set',
    });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.deadLettered).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('handles multiple claimed rows in a single run', async () => {
    mocks.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeRow({ id: 'r-1' }),
        makeRow({ id: 'r-2' }),
        makeRow({ id: 'r-3' }),
      ])
      .mockResolvedValueOnce(makeEligibleRevalidation())
      .mockResolvedValueOnce(makeEligibleRevalidation())
      .mockResolvedValueOnce(makeEligibleRevalidation());
    mocks.deliver
      .mockResolvedValueOnce({ kind: 'sent', provider: 'resend', providerMessageId: 'm1' })
      .mockResolvedValueOnce({ kind: 'transient_failure', provider: 'resend', statusCode: 500, code: 'err', message: 'oops' })
      .mockResolvedValueOnce({ kind: 'sent', provider: 'resend', providerMessageId: 'm3' });

    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => NOW,
    });

    expect(result.claimed).toBe(3);
    expect(result.sent).toBe(2);
    expect(result.transientFailures).toBe(1);
  });

  it('uses the injected clock (now) for start/end timestamps', async () => {
    mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const frozen = new Date('2026-01-01T00:00:00.000Z');
    const result = await runDeadlineReminderWorker({
      workerInstance: 'worker-test',
      now: () => frozen,
    });
    expect(result.startedAt).toBe(frozen.toISOString());
    expect(result.finishedAt).toBe(frozen.toISOString());
  });

  // ── Dispatch-time revalidation (fail-closed race suppression) ──────
  describe('dispatch-time revalidation', () => {
    it('suppresses delivery when the deadline was completed between claim and dispatch', async () => {
      mocks.execute
        .mockResolvedValueOnce([]) // recovery
        .mockResolvedValueOnce([makeRow()]) // claim
        .mockResolvedValueOnce(makeEligibleRevalidation({ deadline_status: 'completed' }));

      const result = await runDeadlineReminderWorker({ workerInstance: 'worker-test', now: () => NOW });

      expect(result.sent).toBe(0);
      expect(result.claimed).toBe(1);
      expect(result.cancelledSkipped).toBe(1);
      expect(mocks.deliver).not.toHaveBeenCalled();
      // Insert into deadline_reminder_executions with outcome='skipped_cancelled', then
      // cancel the reminder row — both via the transactional tx.execute.
      expect(mocks.txExecute).toHaveBeenCalledTimes(2);
      const insertSql = mocks.txExecute.mock.calls[0]?.[0]?.strings.join(' ');
      expect(insertSql).toContain('skipped_cancelled');
      const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
      expect(auditTypes).toContain('reminder.superseded_at_dispatch');
      expect(auditTypes).not.toContain('reminder.sent');
    });

    it('suppresses delivery when the assigned-officer recipient no longer matches the current assignment', async () => {
      mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRow({ recipient_role: 'assigned_officer', recipient_user_id: 'officer-A' })])
        .mockResolvedValueOnce(makeEligibleRevalidation({ current_union_rep_id: 'officer-B' }));

      const result = await runDeadlineReminderWorker({ workerInstance: 'worker-test', now: () => NOW });

      expect(result.sent).toBe(0);
      expect(result.cancelledSkipped).toBe(1);
      expect(mocks.deliver).not.toHaveBeenCalled();
      const auditTypes = mocks.audit.mock.calls.map(([arg]) => arg.eventType);
      expect(auditTypes).toContain('reminder.superseded_at_dispatch');
    });

    it('does NOT suppress a grievor reminder even if the grievance has been reassigned to a new officer', async () => {
      mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRow({ recipient_role: 'grievor', recipient_user_id: 'member-1' })])
        .mockResolvedValueOnce(makeEligibleRevalidation({ current_union_rep_id: 'officer-B' }));
      mocks.deliver.mockResolvedValueOnce({ kind: 'sent', provider: 'resend', providerMessageId: 'm-grievor' });

      const result = await runDeadlineReminderWorker({ workerInstance: 'worker-test', now: () => NOW });

      expect(result.sent).toBe(1);
      expect(result.cancelledSkipped).toBe(0);
    });

    it('suppresses delivery when the source deadline no longer resolves (missing join)', async () => {
      mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRow()])
        .mockResolvedValueOnce([{ reminder_status: 'claimed', deadline_status: null, grievance_id: null, current_union_rep_id: null }]);

      const result = await runDeadlineReminderWorker({ workerInstance: 'worker-test', now: () => NOW });

      expect(result.sent).toBe(0);
      expect(result.cancelledSkipped).toBe(1);
      expect(mocks.deliver).not.toHaveBeenCalled();
    });

    it('builds the reminder deep link from the resolved grievance id, not the deadline id', async () => {
      mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRow({ source_deadline_id: 'deadline-XYZ' })])
        .mockResolvedValueOnce(makeEligibleRevalidation({ grievance_id: 'grievance-ABC' }));
      mocks.deliver.mockResolvedValueOnce({ kind: 'sent', provider: 'resend', providerMessageId: 'm-url' });

      await runDeadlineReminderWorker({ workerInstance: 'worker-test', now: () => NOW });

      const deliverArgs = mocks.deliver.mock.calls[0][0];
      expect(deliverArgs.claimUrl).toContain('/dashboard/grievances/grievance-ABC');
      expect(deliverArgs.claimUrl).not.toContain('deadline-XYZ');
    });

    it('honours a custom claimUrlBuilder that receives the resolved grievanceId', async () => {
      mocks.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeRow()])
        .mockResolvedValueOnce(makeEligibleRevalidation({ grievance_id: 'grievance-custom' }));
      mocks.deliver.mockResolvedValueOnce({ kind: 'sent', provider: 'resend', providerMessageId: 'm-custom' });

      await runDeadlineReminderWorker({
        workerInstance: 'worker-test',
        now: () => NOW,
        claimUrlBuilder: (_row, grievanceId) => `https://custom.test/g/${grievanceId}`,
      });

      const deliverArgs = mocks.deliver.mock.calls[0][0];
      expect(deliverArgs.claimUrl).toBe('https://custom.test/g/grievance-custom');
    });
  });
});
