import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  getRepresentationProtocol: vi.fn(),
  saveRepresentationProtocol: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/lib/representation/protocol-service', () => ({
  getRepresentationProtocol: m.getRepresentationProtocol,
  saveRepresentationProtocol: m.saveRepresentationProtocol,
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
    m.getRepresentationProtocol.mockResolvedValue({ primaryRepresentative: 'steward' });
    m.saveRepresentationProtocol.mockResolvedValue(undefined);
  });

  it('returns the current protocol', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/representation-protocol'), { organizationId: 'org_1', userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.protocol).toEqual({ primaryRepresentative: 'steward' });
  });

  it('saves the protocol', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/admin/representation-protocol', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocol: { version: 1, primaryRepresentative: 'steward', stewardPermissions: { canFileGrievance: true, canRepresent: true, canBeAssigned: true, canContactEmployer: true, canEscalate: true }, representativeLabel: 'Rep', stewardLabel: 'Steward', minimumFilingRole: 'member', minimumRepresentationRole: 'steward' } }),
    }), { organizationId: 'org_1', userId: 'u1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(m.saveRepresentationProtocol).toHaveBeenCalled();
  });
});