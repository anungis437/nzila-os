import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  getWorkflow: vi.fn(),
  getWorkflowStatus: vi.fn(),
  advanceWorkflow: vi.fn(),
  cancelWorkflow: vi.fn(),
  standardErrorResponse: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/services/pki/workflow-engine', () => ({
  getWorkflow: m.getWorkflow,
  getWorkflowStatus: m.getWorkflowStatus,
  advanceWorkflow: m.advanceWorkflow,
  cancelWorkflow: m.cancelWorkflow,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  },
  standardErrorResponse: m.standardErrorResponse,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../admin/pki/workflows/[id]/route');
}

describe('admin/pki/workflows/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation((handler: any) => (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.getWorkflow.mockReturnValue({ id: 'wf1', currentStep: 1 });
    m.getWorkflowStatus.mockReturnValue({ id: 'wf1', state: 'running' });
    m.advanceWorkflow.mockReturnValue({ isComplete: false, currentStep: 2, totalSteps: 4 });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : 400 }));
  });

  it('GET returns workflow status by default', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/pki/workflows/wf1'), { params: { id: 'wf1' } });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status.state).toBe('running');
  });

  it('GET returns full workflow payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/pki/workflows/wf1?detail=full'), { params: { id: 'wf1' } });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.workflow.id).toBe('wf1');
  });

  it('GET returns 404 when full workflow does not exist', async () => {
    const { GET } = await loadRoute();
    m.getWorkflow.mockReturnValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/admin/pki/workflows/wf-missing?detail=full'), { params: { id: 'wf-missing' } });
    expect(response.status).toBe(404);
  });

  it('PUT advances workflow and returns message', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/admin/pki/workflows/wf1', { method: 'PUT' }), { params: { id: 'wf1' } });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.currentStep).toBe(2);
  });

  it('DELETE validates body and rejects empty reason', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/admin/pki/workflows/wf1', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: '' }),
    }), { params: { id: 'wf1' } });

    expect(response.status).toBe(400);
  });

  it('DELETE cancels workflow', async () => {
    const { DELETE } = await loadRoute();
    m.cancelWorkflow.mockReturnValue(undefined);

    const response = await DELETE(new NextRequest('http://localhost/api/admin/pki/workflows/wf1', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'manual cancel' }),
    }), { params: { id: 'wf1' } });

    expect(response.status).toBe(200);
    expect(m.cancelWorkflow).toHaveBeenCalledWith('wf1', undefined, 'manual cancel');
  });
});
