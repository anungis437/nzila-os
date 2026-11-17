import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  containerExists: vi.fn(),
  catalogAdmission: vi.fn(),
  getNarSigningSecret: vi.fn(),
}));

vi.mock('@nzila/nar', () => ({ getNarSigningSecret: m.getNarSigningSecret }));

vi.mock('@nzila/db', () => ({ db: { execute: m.dbExecute } }));
vi.mock('@/lib/operations/catalog-admission', () => ({ evaluateCatalogAdmission: m.catalogAdmission }));
vi.mock('@nzila/blob', () => ({
  container: vi.fn(() => ({ exists: m.containerExists })),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: vi.fn((s: any) => s) };
});
vi.mock('@nzila/os-core/health', () => ({
  getBuildMetadata: vi.fn(() => ({ app: 'union-eyes', version: 'test' })),
  normalizeHealthChecks: vi.fn((c: any) => c),
  isReadyFromChecks: vi.fn((checks: any, required: string[]) => required.every((k) => checks[k] === true)),
}));

async function loadRoute() {
  return import('../ready/route');
}

describe('ready route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.READY_REQUIRE_DECISION_PROOF;
    delete process.env.UE_RELEASE_PROFILE;
    delete process.env.READY_REQUIRE_SCANNER;
    delete process.env.CLAMAV_URL;
    m.getNarSigningSecret.mockResolvedValue('owned-test-proof-signing-material-32-characters');
    delete process.env.READY_REQUIRE_QUEUE;
    delete process.env.READY_REQUIRE_STORAGE;
    delete process.env.DJANGO_API_URL;
    delete process.env.AZURE_BLOB_CONTAINER;
    delete process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS;
    delete process.env.READY_REQUIRE_EMAIL_DELIVERY;
    delete process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION;
    process.env.NODE_ENV = 'test';
    m.dbExecute.mockResolvedValue(undefined);
    m.containerExists.mockResolvedValue(true);
    m.catalogAdmission.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })) as any);
  });

  it('returns 200 when required checks are satisfied', async () => {
    const { GET } = await loadRoute();

    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ready).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires the actual decision signing key when staging enables the proof gate', async () => {
    process.env.READY_REQUIRE_DECISION_PROOF = 'true';
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(200);
    expect(m.getNarSigningSecret).toHaveBeenCalledOnce();
    for (const key of ['', 'short']) {
      m.getNarSigningSecret.mockResolvedValue(key);
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ checks: { decisionProof: false } });
    }
    m.getNarSigningSecret.mockRejectedValue(new Error('key unavailable'));
    expect((await GET()).status).toBe(503);
  });

  it('measures the base release document container, actual scanner health and signing key', async () => {
    process.env.UE_RELEASE_PROFILE = 'union-eyes-v2-base';
    process.env.CLAMAV_URL = 'http://owned-scanner.internal';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ok', clamd: true }) })));
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      releaseProfile: 'union-eyes-v2-base',
      checks: { runtimeProfile: true, storage: true, scanner: true, decisionProof: true, thirdParty: 'unknown' },
    });
    expect(m.containerExists).toHaveBeenCalledOnce();
    expect(m.getNarSigningSecret).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('http://owned-scanner.internal/health', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
  });

  it.each(['storage', 'scanner', 'decisionProof'])('cannot disable required base %s with an older optional flag', async (dependency) => {
    process.env.UE_RELEASE_PROFILE = 'union-eyes-v2-base';
    process.env.READY_REQUIRE_STORAGE = 'false';
    process.env.READY_REQUIRE_SCANNER = 'false';
    process.env.READY_REQUIRE_DECISION_PROOF = 'false';
    process.env.CLAMAV_URL = 'http://owned-scanner.internal';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ok', clamd: dependency !== 'scanner' }) })));
    if (dependency === 'storage') m.containerExists.mockResolvedValue(false);
    if (dependency === 'decisionProof') m.getNarSigningSecret.mockRejectedValue(new Error('unavailable'));
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).checks[dependency]).toBe(false);
  });

  it('refuses an unknown declared release profile instead of falling back to optional checks', async () => {
    process.env.UE_RELEASE_PROFILE = 'unknown-profile';
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ releaseProfile: 'invalid', checks: { runtimeProfile: false } });
  });

  it('returns 503 when connectivity passes but catalog authority is rejected', async () => {
    m.catalogAdmission.mockResolvedValue({ ok: false, violations: ['excess grant'] });
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ready: false, checks: { database: true, catalogAuthority: false } });
  });

  it('fails closed when catalog inspection cannot execute', async () => {
    m.catalogAdmission.mockRejectedValue(new Error('catalog unavailable'));
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ready: false, checks: { catalogAuthority: false } });
  });

  it('keeps optional capabilities out of production readiness by default', async () => {
    process.env.NODE_ENV = 'production';
    const { GET } = await loadRoute();

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ready).toBe(true);
    expect(json.checks).not.toHaveProperty('calendarIntegrations');
    expect(json.checks).not.toHaveProperty('emailDelivery');
    expect(json.checks).not.toHaveProperty('calendarTokenEncryption');
  });

  it('returns 503 when queue is required and queue health fails', async () => {
    const { GET } = await loadRoute();
    process.env.READY_REQUIRE_QUEUE = 'true';
    process.env.DJANGO_API_URL = 'https://django.local';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })) as any);

    const response = await GET();
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.ready).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      'https://django.local/api/auth_core/ready/',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('fails when queue is required but Django is not configured', async () => {
    process.env.READY_REQUIRE_QUEUE = 'true';
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires the configured Azure Blob container when storage readiness is enabled', async () => {
    const { GET } = await loadRoute();
    process.env.READY_REQUIRE_STORAGE = 'true';
    process.env.AZURE_BLOB_CONTAINER = 'union-eyes-documents-staging';

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ready).toBe(true);
    expect(json.checks.storage).toBe(true);
    expect(m.containerExists).toHaveBeenCalledOnce();
  });

  it('fails readiness when storage is required but the container is unavailable', async () => {
    const { GET } = await loadRoute();
    process.env.READY_REQUIRE_STORAGE = 'true';
    process.env.AZURE_BLOB_CONTAINER = 'union-eyes-documents-staging';
    m.containerExists.mockResolvedValue(false);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.ready).toBe(false);
    expect(json.checks.storage).toBe(false);
  });

  it('includes optional readiness checks when enabled', async () => {
    const { GET } = await loadRoute();
    process.env.READY_REQUIRE_QUEUE = 'true';
    process.env.DJANGO_API_URL = 'https://django.local';
    process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS = 'true';
    process.env.READY_REQUIRE_EMAIL_DELIVERY = 'true';
    process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION = 'true';
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'google-client';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'google-secret';
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = 'https://example.com/google';
    process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'microsoft-client';
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'microsoft-secret';
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI = 'https://example.com/microsoft';
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'sendgrid-key';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@example.com';
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = 'calendar-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })) as any);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ready).toBe(true);
    expect(json.checks).toMatchObject({
      queue: true,
      calendarIntegrations: true,
      emailDelivery: true,
      calendarTokenEncryption: true,
    });
  });
});
