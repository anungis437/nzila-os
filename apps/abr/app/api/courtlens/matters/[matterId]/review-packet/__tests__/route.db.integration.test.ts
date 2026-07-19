import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { platformDb } from '@nzila/db/platform';
import { setAuditLogWriter } from '@/lib/audit-log';

const integrationEnabled = process.env.ABR_DB_INTEGRATION_TEST === 'true';
const integrationApproved = process.env.ABR_DB_INTEGRATION_DB_APPROVED === 'true';
const runDbIntegration = integrationEnabled && integrationApproved && !!process.env.DATABASE_URL;
const dbDescribe = runDbIntegration ? describe : describe.skip;

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
}));

vi.mock('@/lib/api-guards', () => ({
  withRequestContext: mocks.withRequestContext,
  requireVerifiedOrgAccess: mocks.requireVerifiedOrgAccess,
  requireVerifiedPermission: mocks.requireVerifiedPermission,
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

const actorContext = {
  userId: 'user-proof',
  orgId: '',
  orgSource: 'header' as const,
  role: 'investigator' as const,
  membershipSource: 'abr_users_lookup' as const,
};

const testRunId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const testMatterIds = {
  success: `inc_metro_${testRunId}`,
  invalidFormat: `inc_1784392707429_mdx4hh_${testRunId}`,
  invalidLocale: `inc_locale_${testRunId}`,
  permissionDenied: `inc_unknown_${testRunId}`,
  missing: `inc_missing_${testRunId}`,
  nonExternalizable: `inc_non_externalizable_${testRunId}`,
  crossTenant: `inc_cross_tenant_${testRunId}`,
  failure: `inc_invalid_${testRunId}`,
};

let liveOrgId = '';

beforeAll(async () => {
  if (!runDbIntegration) {
    return;
  }
  const rows = await platformDb.execute(sql`
    select id::text as id
    from orgs
    where legal_name = ${'Nzila Console Local Dev Org'}
    limit 1
  `);
  liveOrgId = (rows[0] as { id?: string } | undefined)?.id ?? '';
  if (!liveOrgId) {
    const fallbackRows = await platformDb.execute(sql`
      select id::text as id
      from orgs
      order by created_at asc
      limit 1
    `);
    liveOrgId = (fallbackRows[0] as { id?: string } | undefined)?.id ?? '';
  }
  if (!liveOrgId) {
    throw new Error('No live org available for CourtLens audit integration tests');
  }
  actorContext.orgId = liveOrgId;
});

beforeEach(() => {
  vi.clearAllMocks();
  setAuditLogWriter(null);
  mocks.withRequestContext.mockImplementation(
    (_req: Request, handler: () => Promise<NextResponse>) => handler(),
  );
  mocks.requireVerifiedOrgAccess.mockResolvedValue({ ok: true, context: actorContext });
  mocks.requireVerifiedPermission.mockReturnValue({ ok: true });
  mocks.normalizeReviewPacketLocale.mockReturnValue('en-CA');
  mocks.isReviewPacketFormat.mockReturnValue(true);
  mocks.serializeReviewPacketJson.mockReturnValue('{"ok":true}\n');
  mocks.serializeReviewPacketMarkdown.mockReturnValue('# CourtLens Review Packet\n');
  mocks.buildReviewPacketFilename.mockReturnValue('courtlens-review-packet-proof.json');
});

afterEach(() => {
  setAuditLogWriter(null);
});

async function fetchAuditRows(targetId: string) {
  const rows = await platformDb.execute(sql`
    select
      action,
      target_type,
      actor_clerk_user_id,
      org_id::text as org_id,
      target_id::text as target_id,
      after_json,
      hash,
      previous_hash
    from audit_events
    where org_id = ${liveOrgId}::uuid
      and after_json->>'matterId' = ${targetId}
    order by created_at asc
  `);

  return rows as Array<Record<string, unknown>>;
}

async function purgeAuditRows(targetIds: string[]) {
  for (const targetId of targetIds) {
    await platformDb.execute(sql`
      delete from audit_events
      where org_id = ${liveOrgId}::uuid
        and after_json->>'matterId' = ${targetId}
    `);
  }
}

dbDescribe('CourtLens review-packet route audit integration', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for CourtLens DB integration tests');
    }
  });

  beforeEach(async () => {
    await purgeAuditRows([
      testMatterIds.success,
      testMatterIds.invalidFormat,
      testMatterIds.invalidLocale,
      testMatterIds.permissionDenied,
      testMatterIds.missing,
      testMatterIds.nonExternalizable,
      testMatterIds.crossTenant,
      testMatterIds.failure,
    ]);
  });

  afterEach(async () => {
    await purgeAuditRows([
      testMatterIds.success,
      testMatterIds.invalidFormat,
      testMatterIds.invalidLocale,
      testMatterIds.permissionDenied,
      testMatterIds.missing,
      testMatterIds.nonExternalizable,
      testMatterIds.crossTenant,
      testMatterIds.failure,
    ]);
  });

  it('persists exactly one success audit row for the export route', async () => {
    const matterId = testMatterIds.success;
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: matterId },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId,
        documentReadiness: { isPacketExternalizable: true },
        legalBoundaryNotice: 'notice',
      },
    });

    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const body = await res.text();
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('courtlens-review-packet-proof.json');
    expect(body).toContain('{"ok":true}');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.exported',
      target_type: 'matter',
      actor_clerk_user_id: 'user-proof',
      org_id: liveOrgId,
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      format: 'json',
      locale: 'en-CA',
      packetSchemaVersion: 'courtlens.review-packet.v1',
      packetProjectionVersion: 'v1',
    });
    expect(JSON.stringify(details)).not.toContain('reviewerNotes');
    expect(rows[0]).toHaveProperty('hash');
    expect(rows[0]).toHaveProperty('previous_hash');
  });

  it('persists a denial audit row for invalid format before rejecting', async () => {
    const matterId = testMatterIds.invalidFormat;
    mocks.isReviewPacketFormat.mockReturnValue(false);
    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=pdf&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(400);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      reason: 'invalid_format',
      requestedFormat: 'pdf',
      locale: 'en-CA',
    });
  });

  it('persists a denial audit row for invalid locale before rejecting', async () => {
    const matterId = testMatterIds.invalidLocale;
    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json&locale=de-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(400);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      reason: 'invalid_locale',
      requestedLocale: 'de-CA',
    });
  });

  it('persists a denial audit row for an unauthorized same-tenant user', async () => {
    mocks.requireVerifiedPermission.mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSION' }, { status: 403 }),
    });
    const matterId = testMatterIds.permissionDenied;
    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(403);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      reason: 'insufficient_permission',
      requestedFormat: 'json',
      locale: 'en-CA',
    });
  });

  it('persists a denial audit row when the matter is not found', async () => {
    const matterId = testMatterIds.missing;
    mocks.getMatterDetail.mockResolvedValue(null);
    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(404);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      reason: 'matter_not_found',
      requestedFormat: 'json',
      locale: 'en-CA',
    });
  });

  it('persists a denial audit row when the packet is not externalizable', async () => {
    const matterId = testMatterIds.nonExternalizable;
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: matterId },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId,
        documentReadiness: { isPacketExternalizable: false },
      },
    });

    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(409);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      reason: 'packet_not_externalizable',
      requestedFormat: 'json',
      locale: 'en-CA',
      isPacketExternalizable: false,
      packetSchemaVersion: 'courtlens.review-packet.v1',
    });
  });

  it('returns 400 for malformed URL identifiers without writing an audit row', async () => {
    const matterId = '';
    const { GET } = await import('../route');
    const req = new Request('http://localhost/api/courtlens/matters//review-packet?format=json&locale=en-CA');
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('persists a denial audit row for a cross-tenant text ID that cannot be resolved', async () => {
    const matterId = testMatterIds.crossTenant;
    mocks.getMatterDetail.mockResolvedValue(null);
    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);

    expect(res.status).toBe(404);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'courtlens.review_packet.export_denied',
      target_id: null,
    });
    const details = rows[0]?.after_json as Record<string, unknown> | undefined;
    expect(details).toMatchObject({
      matterId,
      reason: 'matter_not_found',
      requestedFormat: 'json',
      locale: 'en-CA',
    });
  });

  it('fails closed with 503 when the audit adapter throws', async () => {
    const matterId = testMatterIds.failure;
    mocks.getMatterDetail.mockResolvedValue({
      matter: { id: matterId },
      detail: { events: [], notes: [], timeline: [], incident: { updatedAt: '2026-07-01T00:00:00Z' } },
    });
    mocks.buildCourtLensReviewPacket.mockReturnValue({
      schemaVersion: 'courtlens.review-packet.v1',
      projectionVersion: 'v1',
      packet: {
        matterId,
        documentReadiness: { isPacketExternalizable: true },
      },
    });
    setAuditLogWriter(async () => {
      throw new Error('audit-store-down');
    });

    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=json`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get('content-disposition')).toBeNull();
    expect(body.code).toBe('AUDIT_WRITE_FAILED');
    expect(rows).toHaveLength(0);
  });

  it('fails closed with 503 when denial auditing throws', async () => {
    const matterId = testMatterIds.invalidFormat;
    mocks.isReviewPacketFormat.mockReturnValue(false);
    setAuditLogWriter(async () => {
      throw new Error('audit-store-down');
    });

    const { GET } = await import('../route');
    const req = new Request(`http://localhost/api/courtlens/matters/${matterId}/review-packet?format=pdf&locale=en-CA`);
    const res = await GET(req as never, { params: Promise.resolve({ matterId }) });
    const rows = await fetchAuditRows(matterId);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get('content-disposition')).toBeNull();
    expect(body.code).toBe('AUDIT_WRITE_FAILED');
    expect(rows).toHaveLength(0);
  });
});
