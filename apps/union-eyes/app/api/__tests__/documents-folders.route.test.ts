import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  getFolderTree: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/services/document-service', () => ({
  listFolders: m.listFolders,
  createFolder: m.createFolder,
  getFolderTree: m.getFolderTree,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'NOT_IMPLEMENTED' ? 501 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 }),
}));

async function loadRoute() {
  vi.resetModules();
  return import('../documents/folders/route');
}

describe('documents/folders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { userId: 'u1', organizationId: '11111111-1111-1111-1111-111111111111' }) => handler(request, context),
    );
    m.listFolders.mockResolvedValue([{ id: 'f1' }]);
    m.createFolder.mockResolvedValue({ id: 'f-new', name: 'Folder' });
    m.getFolderTree.mockResolvedValue([{ id: 'root', children: [] }]);
  });

  it('GET returns 400 when organization id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents/folders'), { userId: 'u1', organizationId: 'org_1' });
    expect(response.status).toBe(400);
  });

  it('GET returns 403 for cross-org access', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents/folders?organizationId=org_2'), { userId: 'u1', organizationId: 'org_1' });
    expect(response.status).toBe(403);
  });

  it('GET returns tree payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/documents/folders?organizationId=org_1&tree=true'), { userId: 'u1', organizationId: 'org_1' });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.folders[0].id).toBe('root');
  });

  it('POST rejects invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents/folders', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json',
    }), { userId: 'u1', organizationId: 'org_1' });
    expect(response.status).toBe(400);
  });

  it('POST rejects organization mismatch', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents/folders', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: '22222222-2222-2222-2222-222222222222', name: 'Folder' }),
    }), { userId: 'u1', organizationId: '11111111-1111-1111-1111-111111111111' });
    expect(response.status).toBe(403);
  });

  it('POST creates folder successfully', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/documents/folders', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: '11111111-1111-1111-1111-111111111111', name: 'Folder' }),
    }), { userId: 'u1', organizationId: '11111111-1111-1111-1111-111111111111' });

    expect(response.status).toBe(201);
    expect(m.createFolder).toHaveBeenCalled();
  });
});
