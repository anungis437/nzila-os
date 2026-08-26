import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  dbExecute: vi.fn(),
}));

vi.mock('@nzila/db', () => ({ db: { execute: m.dbExecute } }));
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
    delete process.env.READY_REQUIRE_QUEUE;
    delete process.env.DJANGO_API_URL;
    delete process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS;
    delete process.env.READY_REQUIRE_EMAIL_DELIVERY;
    delete process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION;
    delete process.env.READY_REQUIRE_CALENDAR_SCHEDULER;
    process.env.NODE_ENV = 'test';
    m.dbExecute.mockResolvedValue(undefined);
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
    expect(json.checks).not.toHaveProperty('calendarScheduler');
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

  it('includes optional readiness checks when enabled', async () => {
    const { GET } = await loadRoute();
    process.env.READY_REQUIRE_QUEUE = 'true';
    process.env.DJANGO_API_URL = 'https://django.local';
    process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS = 'true';
    process.env.READY_REQUIRE_EMAIL_DELIVERY = 'true';
    process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION = 'true';
    process.env.READY_REQUIRE_CALENDAR_SCHEDULER = 'true';
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
    process.env.CALENDAR_SYNC_CRON_ENABLED = 'true';
    process.env.CRON_SECRET = 'cron-secret';
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
      calendarScheduler: true,
    });
  });
});
