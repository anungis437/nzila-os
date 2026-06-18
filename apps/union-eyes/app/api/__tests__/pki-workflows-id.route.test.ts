import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  getWorkflow: vi.fn(),
  getWorkflowStatus: vi.fn(),
  advanceWorkflow: vi.fn(),
  cancelWorkflow: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/services/pki/workflow-engine', () => ({
  getWorkflow: m.getWorkflow,
  getWorkflowStatus: m.getWorkflowStatus,
  advanceWorkflow: m.advanceWorkflow,
  cancelWorkflow: m.cancelWorkflow,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : 400 }),
}));

async function loadRoute() {
  return import('../admin/pki/workflows/[id]/route');
}

describe('admin/pki/workflows/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation((handler: any) => (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.getWorkflow.mockReturnValue({ id: 'wf_1' });
    m.getWorkflowStatus.mockReturnValue({ id: 'wf_1', state: 'running' });
    m.advanceWorkflow.mockReturnValue({ isComplete: false, currentStep: 2, totalSteps: 4 });
    m.cancelWorkflow.mockReturnValue(undefined);
  });

  it('GET returns status by default', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1'), { params: { id: 'wf_1' } });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status.state).toBe('running');
  });

  it('GET returns 404 when full detail workflow is missing', async () => {
    const { GET } = await loadRoute();
    m.getWorkflow.mockReturnValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1?detail=full'), { params: { id: 'wf_1' } });
    expect(response.status).toBe(404);
  });

  it('PUT advances workflow and returns progress message', async () => {
    const { PUT } = await loadRoute();

    const response = await PUT(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1', { method: 'PUT' }), { params: { id: 'wf_1' } });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toContain('Advanced to step');
  });

  it('DELETE validates payload', async () => {
    const { DELETE } = await loadRoute();

    const response = await DELETE(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: '' }),
    }), { params: { id: 'wf_1' } });

    expect(response.status).toBe(400);
  });

  it('DELETE cancels workflow with reason', async () => {
    const { DELETE } = await loadRoute();

    const response = await DELETE(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'manual stop' }),
    }), { params: { id: 'wf_1' } });

    expect(response.status).toBe(200);
    expect(m.cancelWorkflow).toHaveBeenCalledWith('wf_1', undefined, 'manual stop');
  });

  it('PUT returns 500 when workflow engine throws', async () => {
    const { PUT } = await loadRoute();
    m.advanceWorkflow.mockImplementationOnce(() => { throw new Error('boom'); });

    const response = await PUT(new NextRequest('http://localhost/api/admin/pki/workflows/wf_1', { method: 'PUT' }), { params: { id: 'wf_1' } });
    expect(response.status).toBe(500);
  });
});
