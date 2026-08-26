import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { execute: mocks.execute },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { writeDeadlineAuditEvent } from '../audit';

describe('deadline-engine audit writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue([]);
  });

  const baseInput = {
    organizationId: '00000000-0000-0000-0000-000000000001',
    sourceTable: 'grievance_deadlines' as const,
    sourceDeadlineId: '00000000-0000-0000-0000-000000000002',
    eventType: 'reminder.scheduled' as const,
    actorType: 'system' as const,
    actorId: 'system',
    correlationId: 'corr-1',
  };

  it('writes an audit event with structured metadata', async () => {
    await writeDeadlineAuditEvent({
      ...baseInput,
      metadata: { offset_days: 3, recipient_role: 'grievor' },
    });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('accepts an empty metadata object', async () => {
    await writeDeadlineAuditEvent(baseInput);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects metadata that carries recipient_email (PII)', async () => {
    await expect(
      writeDeadlineAuditEvent({
        ...baseInput,
        metadata: { recipient_email: 'leak@example.com' } as unknown as Record<string, string>,
      }),
    ).rejects.toThrow(/PII\/secret guard/);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects metadata that carries api_key (secret)', async () => {
    await expect(
      writeDeadlineAuditEvent({
        ...baseInput,
        metadata: { api_key: 're_secret_xyz' } as unknown as Record<string, string>,
      }),
    ).rejects.toThrow(/PII\/secret guard/);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects metadata that carries message_body (content leak)', async () => {
    await expect(
      writeDeadlineAuditEvent({
        ...baseInput,
        metadata: { message_body: 'You have 3 days to respond' } as unknown as Record<string, string>,
      }),
    ).rejects.toThrow(/PII\/secret guard/);
  });

  it('rejects metadata that carries authorization header value (secret)', async () => {
    await expect(
      writeDeadlineAuditEvent({
        ...baseInput,
        metadata: { authorization: 'Bearer xyz' } as unknown as Record<string, string>,
      }),
    ).rejects.toThrow(/PII\/secret guard/);
  });

  it('propagates DB errors so the caller sees the failure', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('DB down'));
    await expect(writeDeadlineAuditEvent(baseInput)).rejects.toThrow(/DB down/);
  });
});
