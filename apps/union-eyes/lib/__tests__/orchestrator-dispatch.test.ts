import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  randomUUID: vi.fn(() => 'uuid-1'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.info, warn: mocks.warn, error: mocks.error },
}));

vi.mock('crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

import {
  dispatchOrchestratorWorkflow,
  dispatchEvidenceSeal,
  dispatchSlaEscalation,
} from '../orchestrator-dispatch';

describe('lib/orchestrator-dispatch', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  it('returns a success result and logs on ok dispatch', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ ok: true, runId: 'run-1', status: 'queued', deduplicated: true }),
    });

    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'evidence_seal',
      idempotencyKey: 'k1',
      correlationId: 'corr-1',
    });

    expect(result).toEqual({ ok: true, runId: 'run-1', status: 'queued', deduplicated: true });
    expect(mocks.info).toHaveBeenCalled();
  });

  it('returns a failure result when the orchestrator rejects', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ ok: false, error: { code: 'X', message: 'denied' } }),
    });

    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'sla_escalation',
      idempotencyKey: 'k2',
    });

    expect(result).toEqual({ ok: false, error: 'denied' });
    expect(mocks.warn).toHaveBeenCalled();
  });

  it('uses a fallback message when rejection lacks an error message', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: false }) });

    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'evidence_seal',
      idempotencyKey: 'k3',
    });

    expect(result.error).toBe('orchestrator rejected dispatch');
  });

  it('returns a failure result and logs when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'evidence_seal',
      idempotencyKey: 'k4',
    });

    expect(result).toEqual({ ok: false, error: 'network down' });
    expect(mocks.error).toHaveBeenCalled();
  });

  it('dispatchEvidenceSeal forwards a deterministic idempotency key', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: true, runId: 'r' }) });

    await dispatchEvidenceSeal({
      orgId: 'org-1',
      actorId: 'actor-1',
      caseId: 'case-9',
      caseNumber: 'CN-9',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.idempotencyKey).toBe('evidence_seal:case-9');
    expect(body.workflowId).toBe('evidence_seal');
  });

  it('dispatchSlaEscalation includes the sla type in the key and payload', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ ok: true, runId: 'r' }) });

    await dispatchSlaEscalation({
      orgId: 'org-1',
      actorId: 'actor-1',
      caseId: 'case-9',
      slaType: 'response_deadline',
      breachedAt: '2024-01-01',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.idempotencyKey).toBe('sla_escalation:case-9:response_deadline');
    expect(body.payload.slaType).toBe('response_deadline');
  });
});
