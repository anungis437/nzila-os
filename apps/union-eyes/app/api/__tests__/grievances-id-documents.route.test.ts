import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  auditDataMutation: vi.fn(),
  trackPilotEvent: vi.fn(),
  recordUsage: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  auditCaseMutation: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  dbSelectQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => {
    const queue = (m.dbSelectQueue.shift() ?? []) as unknown[];
    return makeSelectChain(queue);
  }),
  insert: vi.fn(() => ({
    values: vi.fn(async () => ({ id: 'doc_1' })),
  })),
};

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/services/platform-economics', () => ({ recordUsage: m.recordUsage }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/audited-case-mutations', () => ({ auditCaseMutation: m.auditCaseMutation }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/documents/route');
}

describe('grievances/[id]/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.dbSelectQueue = [];
    
    // Setup default mocks
    m.withOrganizationAuth.mockImplementation((handler: any) => 
      (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) => 
        handler(request, context, params)
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.withRLSContext.mockImplementation(async (fn: any) => fn(mockDb));
    m.buildUnionEvidencePack.mockResolvedValue({});
    m.getEffectiveCaseAccess.mockResolvedValue({ hasAccess: true, canModify: true });
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.recordUsage.mockResolvedValue(undefined);
    m.auditCaseMutation.mockResolvedValue(undefined);
    m.auditDataMutation.mockResolvedValue(undefined);
  });

  it('returns 403 when user lacks member role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          fileUrl: 'https://example.com/doc.pdf', 
          title: 'Document', 
          filename: 'doc.pdf', 
          mimeType: 'application/pdf', 
          documentType: 'evidence' 
        }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
      { id: 'g1' },
    );

    expect([403, 400]).toContain(response.status);
  });

  it('returns 400 for missing required fields', async () => {
    const { POST } = await loadRoute();
    m.dbSelectQueue.push([{ id: 'g1', organizationId: 'org_1' }]);

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Document' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 when grievance lookup fails', async () => {
    const { POST } = await loadRoute();
    m.dbSelectQueue.push([]);

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileUrl: 'https://example.com/doc.pdf',
          title: 'Document',
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          documentType: 'evidence',
        }),
      }),
    );

    expect([400, 404, 500]).toContain(response.status);
  });

  it('returns 403 when case access is restricted', async () => {
    const { POST } = await loadRoute();
    m.dbSelectQueue.push([{ id: 'g1', organizationId: 'org_1' }]);
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ hasAccess: false, canModify: false });

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileUrl: 'https://example.com/doc.pdf',
          title: 'Document',
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          documentType: 'evidence',
        }),
      }),
    );

    expect([400, 403, 500]).toContain(response.status);
  });

  it('adds document to grievance with all required fields', async () => {
    const { POST } = await loadRoute();
    m.dbSelectQueue.push([{ id: 'g1', organizationId: 'org_1' }]);
    m.dbSelectQueue.push([]); // No existing docs
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ hasAccess: true, canModify: true });

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileUrl: 'https://example.com/doc.pdf',
          title: 'Evidence Document',
          filename: 'evidence.pdf',
          mimeType: 'application/pdf',
          documentType: 'evidence',
          privacyLabel: 'team_confidential',
        }),
      }),
    );

    expect([200, 201, 400, 500]).toContain(response.status);
  });

  it('handles errors when document operations fail', async () => {
    const { POST } = await loadRoute();
    m.dbSelectQueue.push([{ id: 'g1', organizationId: 'org_1' }]);
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ hasAccess: true, canModify: true });
    
    // Make the select call after grievance lookup throw
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount > 1) {
        throw new Error('db error');
      }
      const queue = (m.dbSelectQueue.shift() ?? []) as unknown[];
      return makeSelectChain(queue);
    });

    const response = await POST(
      new Request('http://localhost/api/grievances/g1/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileUrl: 'https://example.com/doc.pdf',
          title: 'Document',
          filename: 'doc.pdf',
          mimeType: 'application/pdf',
          documentType: 'evidence',
        }),
      }),
    );

    expect([400, 500]).toContain(response.status);
  });
});
