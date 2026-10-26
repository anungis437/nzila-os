import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  resolveRepresentationProtocol: vi.fn(),
  saveRepresentationProtocol: vi.fn(),
  approveRepresentationProtocol: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/lib/representation/protocol-service', () => ({
  resolveRepresentationProtocol: m.resolveRepresentationProtocol,
  saveRepresentationProtocol: m.saveRepresentationProtocol,
  approveRepresentationProtocol: m.approveRepresentationProtocol,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({ ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' }, standardErrorResponse: (code: string, message: string, details?: unknown) => new Response(JSON.stringify({ code, message, details }), { status: 400 }) }));

async function loadRoute() {
  return import('../admin/representation-protocol/route');
}

describe('admin/representation-protocol route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation((handler: (request: NextRequest, context: any) => Promise<Response>) => (request: NextRequest, context: any = {}) => handler(request, context));
    m.resolveRepresentationProtocol.mockResolvedValue({
      status: 'missing', executable: false, reason: 'no_configuration', protocol: { primaryRepresentative: 'steward' },
    });
    m.saveRepresentationProtocol.mockResolvedValue(undefined);
    m.approveRepresentationProtocol.mockResolvedValue({ ok: true, approvedAt: '2026-10-23T00:00:00.000Z' });
  });

  it('returns the display protocol and marks a default as not executable', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/representation-protocol'), { organizationId: 'org_1', userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.protocol).toEqual({ primaryRepresentative: 'steward' });
    expect(json.execution).toMatchObject({ status: 'missing', executable: false });
  });

  it('saves the protocol as pending approval, never as executable', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/admin/representation-protocol', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocol: { version: 1, primaryRepresentative: 'steward', stewardPermissions: { canFileGrievance: true, canRepresent: true, canBeAssigned: true, canContactEmployer: true, canEscalate: true }, representativeLabel: 'Rep', stewardLabel: 'Steward', minimumFilingRole: 'member', minimumRepresentationRole: 'steward', approval: { configuredBy: 'x', configuredAt: 'y', approvedBy: 'forged', approvedAt: '2026-01-01T00:00:00Z' } } }),
    }), { organizationId: 'org_1', userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.execution).toEqual({ status: 'pending_approval', executable: false });
    // A client-supplied approval must be stripped before it reaches storage.
    expect(m.saveRepresentationProtocol.mock.calls[0][1]).not.toHaveProperty('approval');
  });

  it('approves through the service using the authenticated approver', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/representation-protocol', { method: 'POST' }), { organizationId: 'org_1', userId: 'approver' });
    expect(response.status).toBe(200);
    expect(m.approveRepresentationProtocol).toHaveBeenCalledWith('org_1', 'approver');
  });

  it('refuses self-approval', async () => {
    m.approveRepresentationProtocol.mockResolvedValue({ ok: false, code: 'SELF_APPROVAL_FORBIDDEN', message: 'no' });
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/representation-protocol', { method: 'POST' }), { organizationId: 'org_1', userId: 'author' });
    expect(response.status).toBe(403);
  });
});