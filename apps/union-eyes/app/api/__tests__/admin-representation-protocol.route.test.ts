import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  resolveRepresentationProtocol: vi.fn(),
  saveRepresentationProtocol: vi.fn(),
  approveRepresentationProtocol: vi.fn(),
  submitLegacyRepresentationProtocolForApproval: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/lib/representation/protocol-service', () => ({
  resolveRepresentationProtocol: m.resolveRepresentationProtocol,
  saveRepresentationProtocol: m.saveRepresentationProtocol,
  approveRepresentationProtocol: m.approveRepresentationProtocol,
  submitLegacyRepresentationProtocolForApproval: m.submitLegacyRepresentationProtocolForApproval,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));

async function loadRoute() {
  return import('../admin/representation-protocol/route');
}

const url = 'http://localhost/api/admin/representation-protocol';
const ctx = { organizationId: 'org_1', userId: 'u1' };
const post = (body?: string) => new NextRequest(url, { method: 'POST', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }) });

describe('admin/representation-protocol route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resolveRepresentationProtocol.mockResolvedValue({
      status: 'missing', executable: false, reason: 'no_configuration', protocol: { primaryRepresentative: 'steward' },
    });
    m.saveRepresentationProtocol.mockResolvedValue(undefined);
    m.approveRepresentationProtocol.mockResolvedValue({ ok: true, approvedAt: '2026-10-23T00:00:00.000Z' });
    m.submitLegacyRepresentationProtocolForApproval.mockResolvedValue({ ok: true });
  });

  it('asks the wrapper for an administrator, an audit record, and the organization\'s own tenant transaction, on every method', async () => {
    const { GET, PUT, POST } = await loadRoute();
    for (const handler of [GET, PUT, POST]) {
      expect(declaredOptions(handler)).toMatchObject({
        auth: { minRole: 'admin' },
        rlsOrgContext: true,
        registry: { audience: 'admin', evidenceRequired: true },
      });
    }
  });

  it('returns the display protocol and marks a default as not executable', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(url), ctx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(m.resolveRepresentationProtocol).toHaveBeenCalledWith('org_1');
    expect(json.protocol).toEqual({ primaryRepresentative: 'steward' });
    expect(json.execution).toMatchObject({ status: 'missing', executable: false });
  });

  it('saves the protocol as pending approval, never as executable', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocol: { version: 1, primaryRepresentative: 'steward', stewardPermissions: { canFileGrievance: true, canRepresent: true, canBeAssigned: true, canContactEmployer: true, canEscalate: true }, representativeLabel: 'Rep', stewardLabel: 'Steward', minimumFilingRole: 'member', minimumRepresentationRole: 'steward', approval: { configuredBy: 'x', configuredAt: 'y', approvedBy: 'forged', approvedAt: '2026-01-01T00:00:00Z' } } }),
    }), ctx);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.execution).toEqual({ status: 'pending_approval', executable: false });
    expect(m.saveRepresentationProtocol).toHaveBeenCalledWith('org_1', expect.anything(), 'u1');
    // A client-supplied approval must be stripped before it reaches storage.
    expect(m.saveRepresentationProtocol.mock.calls[0][1]).not.toHaveProperty('approval');
  });

  it('answers a protocol that is not valid JSON or does not match as a client error, and saves nothing', async () => {
    const { PUT } = await loadRoute();
    for (const body of ['{bad', JSON.stringify({ protocol: { version: 2 } })]) {
      const response = await PUT(new NextRequest(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body }), ctx);
      expect(response.status).toBe(400);
    }
    expect(m.saveRepresentationProtocol).not.toHaveBeenCalled();
  });

  it('approves through the service using the authenticated approver, when no body is sent', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(), { organizationId: 'org_1', userId: 'approver' });
    expect(response.status).toBe(200);
    expect(m.approveRepresentationProtocol).toHaveBeenCalledWith('org_1', 'approver');
  });

  it('approves when the body names the approve action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(JSON.stringify({ action: 'approve' })), { organizationId: 'org_1', userId: 'approver' });
    expect(response.status).toBe(200);
    expect(m.approveRepresentationProtocol).toHaveBeenCalledWith('org_1', 'approver');
  });

  it('never reads a body that is not JSON, or an action it does not have, as an approval', async () => {
    const { POST } = await loadRoute();
    for (const body of ['{bad', JSON.stringify({ action: 'delete' }), JSON.stringify(['approve']), JSON.stringify('approve')]) {
      const response = await POST(post(body), ctx);
      expect(response.status, body).toBe(400);
    }
    expect(m.approveRepresentationProtocol).not.toHaveBeenCalled();
    expect(m.submitLegacyRepresentationProtocolForApproval).not.toHaveBeenCalled();
  });

  it('submits the legacy protocol for approval as the authenticated user, and reports a refusal as a conflict', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post(JSON.stringify({ action: 'submit_legacy' })), ctx)).status).toBe(200);
    expect(m.submitLegacyRepresentationProtocolForApproval).toHaveBeenCalledWith('org_1', 'u1');
    m.submitLegacyRepresentationProtocolForApproval.mockResolvedValueOnce({ ok: false, code: 'NOTHING_TO_SUBMIT', message: 'no' });
    expect((await POST(post(JSON.stringify({ action: 'submit_legacy' })), ctx)).status).toBe(409);
  });

  it('refuses self-approval', async () => {
    m.approveRepresentationProtocol.mockResolvedValue({ ok: false, code: 'SELF_APPROVAL_FORBIDDEN', message: 'no' });
    const { POST } = await loadRoute();
    const response = await POST(post(), { organizationId: 'org_1', userId: 'author' });
    expect(response.status).toBe(403);
  });
});
