import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  withRequestContext: vi.fn(),
  requireVerifiedOrgAccess: vi.fn(),
  requireVerifiedPermission: vi.fn(),
  getMatterDetail: vi.fn(),
  buildCourtLensReviewPacket: vi.fn(),
  serializeReviewPacketJson: vi.fn(),
  serializeReviewPacketMarkdown: vi.fn(),
  buildReviewPacketFilename: vi.fn(),
  isReviewPacketFormat: vi.fn(),
  normalizeReviewPacketLocale: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  withRequestContext: mocks.withRequestContext,
  requireVerifiedOrgAccess: mocks.requireVerifiedOrgAccess,
  requireVerifiedPermission: mocks.requireVerifiedPermission,
}));

vi.mock('@/lib/audit-log', () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock('@/modules/incidents/matter-service', () => ({
  getMatterDetail: mocks.getMatterDetail,
}));

vi.mock('@/modules/incidents/courtlens-review-packet', () => ({
  SUPPORTED_REVIEW_PACKET_FORMATS: ['json', 'markdown'],
  SUPPORTED_REVIEW_PACKET_LOCALES: ['en-CA', 'fr-CA'],
  isReviewPacketFormat: mocks.isReviewPacketFormat,
  isReviewPacketLocale: vi.fn((value: unknown) => value === 'en-CA' || value === 'fr-CA'),
  normalizeReviewPacketLocale: mocks.normalizeReviewPacketLocale,
  buildCourtLensReviewPacket: mocks.buildCourtLensReviewPacket,
  serializeReviewPacketJson: mocks.serializeReviewPacketJson,
  serializeReviewPacketMarkdown: mocks.serializeReviewPacketMarkdown,
  buildReviewPacketFilename: mocks.buildReviewPacketFilename,
}));

const verifiedContext = {
  userId: 'user_1',
  orgId: 'metro-university',
  orgSource: 'header' as const,
  role: 'investigator' as const,
  membershipSource: 'abr_users_lookup' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withRequestContext.mockImplementation(
    (_req: Request, handler: () => Promise<NextResponse>) => handler(),
  );
  mocks.normalizeReviewPacketLocale.mockReturnValue('en-CA');
});

describe('GET /api/courtlens/matters/[matterId]/review-packet', () => {
  it('returns 400 deterministic error for unsupported format', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(false);
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=pdf');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_REVIEW_PACKET_FORMAT');
    expect(body.allowed).toEqual(['json', 'markdown']);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.review_packet.export_denied',
        details: expect.objectContaining({ reason: 'invalid_format' }),
      }),
    );
  });

  it('returns 400 deterministic error for unsupported locale', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json&locale=es-ES');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_REVIEW_PACKET_LOCALE');
    expect(body.allowed).toEqual(['en-CA', 'fr-CA']);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.review_packet.export_denied',
        details: expect.objectContaining({ reason: 'invalid_locale' }),
      }),
    );
  });

  it('returns 403 for role without export.read and writes sanitized denial audit', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' }, { status: 403 }),
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('INSUFFICIENT_PERMISSION');
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'courtlens.review_packet.export_denied',
        details: expect.objectContaining({
          reason: 'insufficient_permission',
        }),
      }),
    );
  });

  it('returns non-leaky 404 for cross-organization lookup', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue(null);
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/other-org/review-packet?format=json');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'other-org' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('MATTER_NOT_FOUND');
    expect(body.error).toBe('Matter not found');
  });

  it('returns 409 with no packet body when packet is not externalizable', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({ matter: { id: 'inc-1' }, detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } } });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        documentReadiness: {
          isPacketExternalizable: false,
        },
      },
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('REVIEW_PACKET_NOT_EXTERNALIZABLE');
    expect(JSON.stringify(body)).not.toContain('reviewerNotes');
    expect(mocks.serializeReviewPacketJson).not.toHaveBeenCalled();
    expect(mocks.serializeReviewPacketMarkdown).not.toHaveBeenCalled();
  });

  it('returns JSON attachment with deterministic headers', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1' },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId: 'inc-1',
        documentReadiness: { isPacketExternalizable: true },
        legalBoundaryNotice: 'notice',
      },
    });
    mocks.serializeReviewPacketJson.mockReturnValue('{"ok":true}\n');
    mocks.buildReviewPacketFilename.mockReturnValue('courtlens-review-packet-inc-1-20260718T120000Z.json');
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json&locale=en-CA');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="courtlens-review-packet-inc-1-20260718T120000Z.json"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body).toContain('{"ok":true}');
    expect(mocks.serializeReviewPacketMarkdown).not.toHaveBeenCalled();
  });

  it('returns Markdown attachment with deterministic headers', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1' },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId: 'inc-1',
        documentReadiness: { isPacketExternalizable: true },
        legalBoundaryNotice: 'notice',
      },
    });
    mocks.serializeReviewPacketMarkdown.mockReturnValue('# CourtLens Review Packet\n');
    mocks.buildReviewPacketFilename.mockReturnValue('courtlens-review-packet-inc-1-20260718T120000Z.md');
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=markdown&locale=fr-CA');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="courtlens-review-packet-inc-1-20260718T120000Z.md"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toContain('CourtLens Review Packet');
    expect(mocks.serializeReviewPacketJson).not.toHaveBeenCalled();
  });

  it('writes success audit metadata without packet content', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1' },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId: 'inc-1',
        documentReadiness: { isPacketExternalizable: true },
      },
    });
    mocks.serializeReviewPacketJson.mockReturnValue('{"packet":"content"}\n');
    mocks.buildReviewPacketFilename.mockReturnValue('courtlens-review-packet-inc-1-20260718T120000Z.json');
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json');
    await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });

    const successCall = mocks.logAuditEvent.mock.calls.find(
      (call) => call[0]?.action === 'courtlens.review_packet.exported',
    );

    expect(successCall?.[0]).toBeDefined();
    const details = successCall?.[0]?.details as Record<string, unknown>;
    expect(details.packetSchemaVersion).toBe('courtlens.review-packet.v1');
    expect(details).not.toHaveProperty('packetBody');
    expect(JSON.stringify(details)).not.toContain('reviewerNotes');
    expect(JSON.stringify(details)).not.toContain('intake');
  });

  it('fails closed with 503 when success-path audit write throws', async () => {
    mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: verifiedContext });
    mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
    mocks.isReviewPacketFormat.mockReturnValue(true);
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: 'inc-1' },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId: 'inc-1',
        documentReadiness: { isPacketExternalizable: true },
      },
    });
    mocks.serializeReviewPacketJson.mockReturnValue('{"packet":"content"}\n');
    mocks.buildReviewPacketFilename.mockReturnValue('courtlens-review-packet-inc-1-20260718T120000Z.json');
    mocks.logAuditEvent.mockImplementationOnce(() => {
      throw new Error('audit-store-down');
    });
    const { GET } = await import('../route');

    const req = new Request('http://localhost/api/courtlens/matters/inc-1/review-packet?format=json');
    const res = await GET(req as never, { params: Promise.resolve({ matterId: 'inc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('AUDIT_WRITE_FAILED');
    expect(body).not.toHaveProperty('packet');
    expect(JSON.stringify(body)).not.toContain('reviewerNotes');
  });
});
