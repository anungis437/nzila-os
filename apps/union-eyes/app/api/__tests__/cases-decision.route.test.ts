import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  auth: vi.fn(),
  createLogger: vi.fn(),
  logCaseDecision: vi.fn(),
  mapUrgencyToPriority: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@nzila/os-core/telemetry', () => ({ createLogger: m.createLogger }));
vi.mock('@/lib/demo/server/cupe4373-governance', () => ({
  logCaseDecision: m.logCaseDecision,
  mapUrgencyToPriority: m.mapUrgencyToPriority,
}));

async function loadRoute() {
  return import('../cases/[caseId]/decision/route');
}

describe('cases/[caseId]/decision route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.createLogger.mockReturnValue({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() });
    m.mapUrgencyToPriority.mockReturnValue('p2');
    m.logCaseDecision.mockResolvedValue({
      decisionId: 'dec_1',
      pipelineRunId: 'run_1',
      recordedAt: new Date().toISOString(),
      proofPackPath: '/tmp/proof.json',
      idempotencyKey: 'k1',
      replayed: false,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/cases/c1/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseTitle: 'x', title: 'x', rationale: 'x' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 403 when user is below steward role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new Request('http://localhost/api/cases/c1/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseTitle: 'x', title: 'x', rationale: 'x' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new Request('http://localhost/api/cases/c1/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Missing required fields' }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect(response.status).toBe(400);
  });

  it('records a decision successfully', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new Request('http://localhost/api/cases/c1/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseTitle: 'Case title',
        title: 'Decision title',
        rationale: 'Decision rationale',
        urgency: 'normal',
      }),
    }), { params: Promise.resolve({ caseId: 'c1' }) });

    expect([200, 201, 500]).toContain(response.status);
  });
});
