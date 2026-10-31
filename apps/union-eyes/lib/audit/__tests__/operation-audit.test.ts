import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  audit: vi.fn(),
  tx: {},
  orgs: [] as unknown[],
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    m.orgs.push(ctx);
    return fn(m.tx);
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

import { performAuditedOperation, performAtomicAuditedOperation, OperationAuditError, operationAuditResponse } from '../operation-audit';

const op = { organizationId: 'org_1', userId: 'admin', action: 'platform.thing', resourceType: 'thing', resourceId: 't1' };

describe('performAuditedOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.orgs = [];
    m.audit.mockResolvedValue(undefined);
  });

  it('records the intent before the operation and the outcome after it', async () => {
    const order: string[] = [];
    m.audit.mockImplementation(async (_tx: unknown, entry: { action: string }) => { order.push(entry.action); });
    const result = await performAuditedOperation(op, async () => { order.push('operation'); return 42; });
    expect(result).toBe(42);
    expect(order).toEqual(['platform.thing.requested', 'operation', 'platform.thing.completed']);
    expect(m.audit.mock.calls[0][1]).toMatchObject({ organizationId: 'org_1', userId: 'admin', resourceId: 't1' });
  });

  it('reports, through outcomeReport, an outcome record that could not be written, and still returns the result', async () => {
    const outcomeReport = { recorded: true };
    m.audit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('audit down'));
    await expect(performAuditedOperation({ ...op, outcomeReport }, async () => 7)).resolves.toBe(7);
    expect(outcomeReport.recorded).toBe(false);

    const ok = { recorded: false };
    m.audit.mockResolvedValue(undefined);
    await performAuditedOperation({ ...op, outcomeReport: ok }, async () => 7);
    expect(ok.recorded).toBe(true);
  });

  it('does not perform the operation when its intent cannot be recorded', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const operation = vi.fn();
    await expect(performAuditedOperation(op, operation)).rejects.toBeInstanceOf(OperationAuditError);
    expect(operation).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...op, organizationId: null }],
    [{ ...op, userId: undefined }],
  ])('refuses an unattributed operation without running it (%#)', async (unattributed) => {
    const operation = vi.fn();
    await expect(performAuditedOperation(unattributed, operation)).rejects.toBeInstanceOf(OperationAuditError);
    expect(operation).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('records a failed operation as a failure outcome and rethrows it', async () => {
    const boom = new Error('boom');
    await expect(performAuditedOperation(op, async () => { throw boom; })).rejects.toBe(boom);
    expect(m.audit).toHaveBeenLastCalledWith(
      m.tx,
      expect.objectContaining({ action: 'platform.thing.failed', details: expect.objectContaining({ error: 'boom' }) }),
      'failure',
    );
  });

  it('does not reverse an effect that happened when only the outcome record fails', async () => {
    m.audit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('audit down'));
    await expect(performAuditedOperation(op, async () => 'done')).resolves.toBe('done');
    expect(m.logger.error).toHaveBeenCalledWith('platform_operation_outcome_not_recorded', expect.anything());
  });

  it('maps the refusal to a 409 for routes', () => {
    expect(operationAuditResponse(new OperationAuditError('x'))).toMatchObject({ status: 409 });
    expect(operationAuditResponse(new Error('other'))).toBeNull();
  });
});

describe('performAtomicAuditedOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.orgs = [];
    m.audit.mockResolvedValue(undefined);
  });

  it('writes the work and its single audit record on the same transaction handle, in that order', async () => {
    const order: string[] = [];
    m.audit.mockImplementation(async (tx: unknown, entry: { action: string }) => { order.push(`audit:${entry.action}:${tx === m.tx}`); });
    const result = await performAtomicAuditedOperation(op, async (tx) => { order.push(`work:${tx === m.tx}`); return 9; });
    expect(result).toBe(9);
    expect(order).toEqual(['work:true', 'audit:platform.thing:true']);
  });

  it('records what the work produced in the same audit row, merged over the static details', async () => {
    await performAtomicAuditedOperation(
      { ...op, details: { fixed: 1 }, resultDetails: (value: { created: number }) => ({ created: value.created }) },
      async () => ({ created: 4 }),
    );
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ details: { fixed: 1, created: 4 } }));
  });

  it('turns a failed audit write into OperationAuditError so the transaction (and the work in it) is abandoned, and does not run afterCommit', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const after = vi.fn();
    await expect(performAtomicAuditedOperation(op, async () => 1, after)).rejects.toBeInstanceOf(OperationAuditError);
    expect(after).not.toHaveBeenCalled();
  });

  it('records nothing when the work itself fails, and rethrows the original error', async () => {
    const boom = new Error('boom');
    await expect(performAtomicAuditedOperation(op, async () => { throw boom; })).rejects.toBe(boom);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('refuses an unattributed operation without opening a transaction', async () => {
    await expect(performAtomicAuditedOperation({ ...op, userId: null }, async () => 1)).rejects.toBeInstanceOf(OperationAuditError);
    expect(m.orgs).toHaveLength(0);
  });

  it('runs afterCommit once, and a failing afterCommit cannot undo the committed work', async () => {
    const after = vi.fn(async () => { throw new Error('cache refresh failed'); });
    await expect(performAtomicAuditedOperation(op, async () => 5, after)).resolves.toBe(5);
    expect(after).toHaveBeenCalledTimes(1);
    expect(m.logger.error).toHaveBeenCalledWith('platform_operation_after_commit_failed', expect.anything());
  });
});
