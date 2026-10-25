import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  getWorkflow: vi.fn(),
  getWorkflowStatus: vi.fn(),
  cancelWorkflow: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/services/pki/workflow-engine', () => ({
  getWorkflow: m.getWorkflow,
  getWorkflowStatus: m.getWorkflowStatus,
  cancelWorkflow: m.cancelWorkflow,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', VALIDATION_ERROR: 'VALIDATION_ERROR', MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : 400 }),
}));

const ORG = 'org-a';

async function loadRoute() {
  return import('../admin/pki/workflows/[id]/route');
}

const req = (method = 'GET', body?: unknown, qs = '') =>
  new NextRequest(`http://localhost/api/admin/pki/workflows/wf1${qs}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('admin/pki/workflows/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation((handler: any) => (request: NextRequest, ctx: any = {}) => handler(request, { userId: 'u1', organizationId: ORG, ...ctx }));
    m.getWorkflow.mockReturnValue({ id: 'wf1', organizationId: ORG });
    m.getWorkflowStatus.mockReturnValue({ id: 'wf1', state: 'running' });
  });

  it('returns the status of the organization\'s own workflow, by default and in full', async () => {
    const { GET } = await loadRoute();
    const status = await GET(req(), { params: { id: 'wf1' } });
    expect(status.status).toBe(200);
    expect((await status.json()).status.state).toBe('running');

    const full = await GET(req('GET', undefined, '?detail=full'), { params: { id: 'wf1' } });
    expect((await full.json()).workflow.id).toBe('wf1');
  });

  it('treats another organization\'s workflow, and a missing one, as not found for every method', async () => {
    const { GET, PUT, DELETE } = await loadRoute();
    for (const found of [{ id: 'wf1', organizationId: 'org-b' }, null]) {
      m.getWorkflow.mockReturnValue(found);
      expect((await GET(req(), { params: { id: 'wf1' } })).status).toBe(404);
      expect((await GET(req('GET', undefined, '?detail=full'), { params: { id: 'wf1' } })).status).toBe(404);
      expect((await PUT(req('PUT'), { params: { id: 'wf1' } })).status).toBe(404);
      expect((await DELETE(req('DELETE', { reason: 'x' }), { params: { id: 'wf1' } })).status).toBe(404);
    }
    expect(m.getWorkflowStatus).not.toHaveBeenCalled();
    expect(m.cancelWorkflow).not.toHaveBeenCalled();
  });

  it('offers no manual advance: a workflow moves only when its signers sign', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(req('PUT'), { params: { id: 'wf1' } });
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('DELETE validates the body and rejects an empty reason', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(req('DELETE', { reason: '' }), { params: { id: 'wf1' } });
    expect(response.status).toBe(400);
    expect(m.cancelWorkflow).not.toHaveBeenCalled();
  });

  it('DELETE cancels the organization\'s own workflow', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(req('DELETE', { reason: 'manual cancel' }), { params: { id: 'wf1' } });
    expect(response.status).toBe(200);
    expect(m.cancelWorkflow).toHaveBeenCalledWith('wf1', 'u1', 'manual cancel');
  });
});
