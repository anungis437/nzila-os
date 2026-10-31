import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  tx: { insert: vi.fn() },
  db: { select: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit/cape-audit-events', () => ({
  emitCapeAuditEvent: m.emitCapeAuditEvent,
  CAPE_AUDIT_EVENTS: { EMPLOYER_COMMUNICATION_SENT: 'sent', EMPLOYER_COMMUNICATION_LOGGED: 'logged', EMPLOYER_CONTACT_ADDED: 'added' },
}));
vi.mock('@/db/db', () => ({ db: m.db }));

const EMPLOYER = '11111111-1111-4111-8111-111111111111';
const ctx = { organizationId: 'org_1', userId: 'u1' };
const post = (url: string, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('employer communications and contacts audit atomically', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: Request, c: any = ctx) => handler(request, c));
    m.hasMinRole.mockResolvedValue(true);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.emitCapeAuditEvent.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_c: unknown, fn: (tx: unknown) => unknown) => fn(m.tx));
    m.tx.insert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'row-1', employerId: EMPLOYER, type: 'email', status: 'sent', role: 'hr' }]) })) }));
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Object.assign(Promise.resolve([{ id: EMPLOYER }]), { limit: async () => [{ id: EMPLOYER }] })) })) }));
  });

  const communication = () => post('http://localhost/api/employers/communications', {
    employerId: EMPLOYER, type: 'email', status: 'sent', subject: 'Notice', body: 'Hello', recipientName: 'HR',
  });
  const contact = () => post('http://localhost/api/employers/communications/contacts', {
    employerId: EMPLOYER, name: 'Pat', role: 'hr', isPrimary: false,
  });

  it('logs a communication and audits inside the same transaction', async () => {
    const { POST } = await import('../employers/communications/route');
    const response = await POST(communication());
    expect(response.status).toBe(200);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'employer_communication.create', organizationId: 'org_1', userId: 'u1', resourceId: 'row-1',
    }));
    // The in-transaction record is the only audit; no second event follows the commit, and the response says nothing was delivered.
    expect(m.emitCapeAuditEvent).not.toHaveBeenCalled();
    expect((await response.json()).data).toMatchObject({ delivery: 'recorded_only' });
  });

  it('records what the person states: no server-stamped send time and no invented sender', async () => {
    const insertValues = vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'row-1', employerId: EMPLOYER, type: 'email', status: 'sent' }]) }));
    m.tx.insert = vi.fn(() => ({ values: insertValues }));
    const { POST } = await import('../employers/communications/route');
    await POST(communication());
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ senderName: 'Recorded by union staff', sentAt: undefined }));
    await POST(post('http://localhost/api/employers/communications', {
      employerId: EMPLOYER, type: 'email', status: 'sent', subject: 'Notice', body: 'Hello', occurredAt: '2026-01-02T03:04:05.000Z',
    }));
    expect(insertValues).toHaveBeenLastCalledWith(expect.objectContaining({ sentAt: new Date('2026-01-02T03:04:05.000Z') }));
    const future = await POST(post('http://localhost/api/employers/communications', {
      employerId: EMPLOYER, type: 'email', status: 'sent', subject: 'Notice', body: 'Hello', occurredAt: '2999-01-01T00:00:00.000Z',
    }));
    expect(future.status).toBe(400);
  });

  it('refuses a communication that names a grievance, contact or template of another organization, and writes nothing', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: async () => [] })) })) }));
    const { POST } = await import('../employers/communications/route');
    const response = await POST(post('http://localhost/api/employers/communications', {
      employerId: EMPLOYER, grievanceId: '22222222-2222-4222-8222-222222222222', type: 'email', status: 'draft', subject: 'Notice', body: 'Hello',
    }));
    expect(response.status).toBe(404);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the communication when the audit record cannot be written, and emits no downstream event', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await import('../employers/communications/route');
    const response = await POST(communication());
    expect(response.status).toBe(500);
    expect(m.emitCapeAuditEvent).not.toHaveBeenCalled();
  });

  it('adds a contact and audits inside the same transaction', async () => {
    const { POST } = await import('../employers/communications/contacts/route');
    const response = await POST(contact());
    expect(response.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'employer_contact.create', organizationId: 'org_1', resourceId: 'row-1',
    }));
    expect(m.emitCapeAuditEvent).not.toHaveBeenCalled();
  });

  it('fails the contact when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await import('../employers/communications/contacts/route');
    expect((await POST(contact())).status).toBe(500);
  });

  it('refuses a caller below steward and writes nothing', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { POST } = await import('../employers/communications/route');
    expect((await POST(communication())).status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});
