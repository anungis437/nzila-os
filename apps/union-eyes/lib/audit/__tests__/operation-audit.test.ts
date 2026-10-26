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

import { performAuditedOperation, OperationAuditError, operationAuditResponse } from '../operation-audit';

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
