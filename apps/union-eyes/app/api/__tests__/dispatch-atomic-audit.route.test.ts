import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  assignWorkersToDispatch: vi.fn(),
  createDispatchRequest: vi.fn(),
  tx: { marker: 'tx' },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/services/dispatch-engine', () => ({
  assignWorkersToDispatch: m.assignWorkersToDispatch,
  createDispatchRequest: m.createDispatchRequest,
}));

const REQ = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const EMPLOYER = '33333333-3333-4333-8333-333333333333';
const ctx = { organizationId: 'org_1', userId: 'u1' };
const post = (url: string, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('dispatch mutations audit atomically', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, c: any = ctx) => handler(request, c));
    m.hasMinRole.mockResolvedValue(true);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_c: unknown, fn: (tx: unknown) => unknown) => fn(m.tx));
    m.assignWorkersToDispatch.mockResolvedValue([{ id: 'a1' }]);
    m.createDispatchRequest.mockResolvedValue({ id: REQ, employerId: EMPLOYER, jobTitle: 'Welder', requestedWorkers: 1 });
  });

  it('assigns workers and audits through the same transaction handle', async () => {
    const { POST } = await import('../dispatch/assign/route');
    const response = await POST(post('http://localhost/api/dispatch/assign', { requestId: REQ, memberIds: [MEMBER] }));
    expect(response.status).toBe(200);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.assignWorkersToDispatch).toHaveBeenCalledWith('org_1', REQ, [MEMBER], m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'dispatch.assign', organizationId: 'org_1', userId: 'u1', resourceId: REQ,
    }));
  });

  it('fails the assignment when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await import('../dispatch/assign/route');
    const response = await POST(post('http://localhost/api/dispatch/assign', { requestId: REQ, memberIds: [MEMBER] }));
    expect(response.status).toBe(500);
  });

  it('refuses assignment below officer and writes nothing', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { POST } = await import('../dispatch/assign/route');
    const response = await POST(post('http://localhost/api/dispatch/assign', { requestId: REQ, memberIds: [MEMBER] }));
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('creates a request and audits through the same transaction handle', async () => {
    const { POST } = await import('../dispatch/requests/route');
    const response = await POST(post('http://localhost/api/dispatch/requests', { employerId: EMPLOYER, jobTitle: 'Welder' }));
    expect(response.status).toBe(200);
    expect(m.createDispatchRequest).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org_1' }), m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'dispatch.request_create', resourceId: REQ,
    }));
  });

  it('fails the request creation when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await import('../dispatch/requests/route');
    const response = await POST(post('http://localhost/api/dispatch/requests', { employerId: EMPLOYER, jobTitle: 'Welder' }));
    expect(response.status).toBe(500);
  });
});
