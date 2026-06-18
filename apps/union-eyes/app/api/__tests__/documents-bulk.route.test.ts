import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  bulkMoveDocuments: vi.fn(),
  bulkUpdateTags: vi.fn(),
  bulkDeleteDocuments: vi.fn(),
  bulkProcessOCR: vi.fn(),
  standardErrorResponse: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/services/document-service', () => ({
  bulkMoveDocuments: m.bulkMoveDocuments,
  bulkUpdateTags: m.bulkUpdateTags,
  bulkDeleteDocuments: m.bulkDeleteDocuments,
  bulkProcessOCR: m.bulkProcessOCR,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../documents/bulk/route');
}

describe('documents/bulk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: NextRequest, context: any = { userId: 'u1', organizationId: '11111111-1111-1111-1111-111111111111' }) => handler(request, context));
    m.standardErrorResponse.mockImplementation((code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'NOT_IMPLEMENTED' ? 501 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 }));
    m.bulkMoveDocuments.mockResolvedValue({ success: true });
    m.bulkUpdateTags.mockResolvedValue({ success: true });
    m.bulkDeleteDocuments.mockResolvedValue({ success: true });
    m.bulkProcessOCR.mockResolvedValue({ success: true });
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
  });

  it('returns 501 when legacy endpoint is disabled', async () => {
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'false';
    vi.resetModules();
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/bulk', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(501);
  });

  it('returns 400 for invalid JSON', async () => {
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
    vi.resetModules();
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad-json',
    }));
    expect(response.status).toBe(400);
  });

  it('ignores extra org fields not in schema and still processes delete', async () => {
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
    vi.resetModules();
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'delete', documentIds: ['11111111-1111-1111-1111-111111111111'], organizationId: '22222222-2222-2222-2222-222222222222' }),
    }), { userId: 'u1', organizationId: '11111111-1111-1111-1111-111111111111' });

    expect(response.status).toBe(200);
    expect(m.bulkDeleteDocuments).toHaveBeenCalled();
  });

  it('executes move operation', async () => {
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
    vi.resetModules();
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'move', documentIds: ['11111111-1111-1111-1111-111111111111'], targetFolderId: null }),
    }));

    expect(response.status).toBe(200);
    expect(m.bulkMoveDocuments).toHaveBeenCalled();
  });

  it('executes OCR operation', async () => {
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
    vi.resetModules();
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/documents/bulk', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'ocr', documentIds: ['11111111-1111-1111-1111-111111111111'] }),
    }));

    expect(response.status).toBe(200);
    expect(m.bulkProcessOCR).toHaveBeenCalled();
  });
});
