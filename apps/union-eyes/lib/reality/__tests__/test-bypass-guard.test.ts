import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TEST_BYPASS_REASON_CODE,
  TEST_BYPASS_SWITCHES,
  evaluateTestBypassGuard,
} from '../test-bypass-guard';

const SWITCH_NAMES = TEST_BYPASS_SWITCHES.map((sw) => sw.name);

describe('lib/reality/test-bypass-guard', () => {
  it('covers the three switches observed on the old staging app, plus QA_TEST_ENV', () => {
    expect(SWITCH_NAMES).toEqual(
      expect.arrayContaining([
        'PLAYWRIGHT_TEST_AUTH',
        'UE_E2E_RISK_BYPASS',
        'UNION_EYES_ACCEPTANCE_AUTH_ENABLED',
        'QA_TEST_ENV',
      ]),
    );
  });

  describe.each(SWITCH_NAMES)('%s', (name) => {
    it.each([
      ['UE_ENVIRONMENT', 'staging'],
      ['UE_ENVIRONMENT', 'production'],
      ['UE_DEPLOYMENT_TYPE', 'staging'],
      ['UE_DEPLOYMENT_TYPE', 'prod'],
      ['NEXT_PUBLIC_APP_ENV', 'staging'],
      ['NEXT_PUBLIC_APP_ENV', 'production'],
      ['TARGET_ENVIRONMENT', 'staging'],
      ['TARGET_ENVIRONMENT', 'production'],
    ])('refuses when %s=%s', (marker, value) => {
      const v = evaluateTestBypassGuard({ [name]: 'true', [marker]: value, NODE_ENV: 'production' });
      expect(v.ok).toBe(false);
      expect(v.reasonCode).toBe(TEST_BYPASS_REASON_CODE);
      expect(v.deployed).toBe(true);
      expect(v.switchesPresent).toEqual([name]);
    });

    it.each([
      [{ UE_ENVIRONMENT: 'local', NODE_ENV: 'production' }],
      [{ UE_ENVIRONMENT: 'local' }],
      [{ NODE_ENV: 'test' }],
      [{ NODE_ENV: 'development' }],
      [{ TARGET_ENVIRONMENT: 'test', NODE_ENV: 'production' }],
    ])('allows local / test environment %j', (envMarkers) => {
      const v = evaluateTestBypassGuard({ [name]: 'true', ...envMarkers });
      expect(v.ok).toBe(true);
      expect(v.reasonCode).toBeUndefined();
    });

    it('refuses even when the value is "false" in staging (the setting must be absent)', () => {
      const v = evaluateTestBypassGuard({ [name]: 'false', UE_ENVIRONMENT: 'staging' });
      expect(v.ok).toBe(false);
    });
  });

  it('refuses when any marker says deployed, even if another says local', () => {
    const v = evaluateTestBypassGuard({
      UE_E2E_RISK_BYPASS: 'true',
      UE_ENVIRONMENT: 'local',
      UE_DEPLOYMENT_TYPE: 'staging',
    });
    expect(v.ok).toBe(false);
    expect(v.classifiedBy).toEqual(['UE_ENVIRONMENT=local', 'UE_DEPLOYMENT_TYPE=staging']);
  });

  it.each(['pilot', 'demo', 'qa', 'something-unknown'])(
    'treats %s as deployed (fail closed)',
    (value) => {
      const v = evaluateTestBypassGuard({ PLAYWRIGHT_TEST_AUTH: 'true', UE_ENVIRONMENT: value });
      expect(v.ok).toBe(false);
    },
  );

  it('treats a production build with no environment marker as deployed', () => {
    expect(evaluateTestBypassGuard({ QA_TEST_ENV: 'true', NODE_ENV: 'production' }).ok).toBe(false);
    expect(evaluateTestBypassGuard({ QA_TEST_ENV: 'true' }).ok).toBe(false);
  });

  it('tolerates the malformed legacy NEXT_PUBLIC_APP_ENV form', () => {
    const v = evaluateTestBypassGuard({
      UE_E2E_RISK_BYPASS: 'true',
      NEXT_PUBLIC_APP_ENV: 'production NEXT_PUBLIC_APP_ENV=staging',
    });
    expect(v.ok).toBe(false);
    expect(v.classifiedBy).toEqual(['NEXT_PUBLIC_APP_ENV=production']);
  });

  it('reports every switch present and never echoes values', () => {
    const v = evaluateTestBypassGuard({
      PLAYWRIGHT_TEST_AUTH: 'sentinel-value-1',
      UNION_EYES_ACCEPTANCE_AUTH_ENABLED: 'sentinel-value-2',
      UE_ENVIRONMENT: 'production',
    });
    expect(v.switchesPresent).toEqual(['PLAYWRIGHT_TEST_AUTH', 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED']);
    expect(JSON.stringify(v)).not.toContain('sentinel-value');
  });

  it('passes staging and production when no switch is set', () => {
    expect(evaluateTestBypassGuard({ UE_ENVIRONMENT: 'staging', UE_DEPLOYMENT_TYPE: 'staging' }).ok).toBe(true);
    expect(evaluateTestBypassGuard({ UE_ENVIRONMENT: 'production', UE_DEPLOYMENT_TYPE: 'prod' }).ok).toBe(true);
    expect(evaluateTestBypassGuard({ PLAYWRIGHT_TEST_AUTH: '  ', UE_ENVIRONMENT: 'production' }).ok).toBe(true);
  });
});

describe('enforcement points', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('next-intl/middleware');
  });

  async function loadProxy() {
    // next-intl's middleware cannot resolve `next/server` under vitest; the
    // guard runs before it, so a stub is enough.
    vi.doMock('next-intl/middleware', () => ({ default: () => () => new Response(null) }));
    return import('../../../proxy');
  }

  function stubDeployedWithBypass() {
    vi.stubEnv('UE_ENVIRONMENT', 'staging');
    vi.stubEnv('UE_DEPLOYMENT_TYPE', 'staging');
    vi.stubEnv('UE_E2E_RISK_BYPASS', 'true');
  }

  it('proxy refuses every request with 503 and the reason code, except /api/ready', async () => {
    stubDeployedWithBypass();
    const { testBypassRefusal } = await loadProxy();

    for (const path of ['/', '/en-CA/dashboard', '/api/auth/login', '/api/health']) {
      const res = testBypassRefusal(path);
      expect(res?.status).toBe(503);
      const body = await res!.json();
      expect(body.reasonCode).toBe(TEST_BYPASS_REASON_CODE);
      expect(body.switchesPresent).toEqual(['UE_E2E_RISK_BYPASS']);
    }
    expect(testBypassRefusal('/api/ready')).toBeNull();
  });

  it('proxy lets requests through in a local environment', async () => {
    vi.stubEnv('UE_ENVIRONMENT', 'local');
    vi.stubEnv('PLAYWRIGHT_TEST_AUTH', 'true');
    const { testBypassRefusal } = await loadProxy();
    expect(testBypassRefusal('/en-CA/dashboard')).toBeNull();
  });

  it('/api/ready reports not-ready with the reason code', async () => {
    stubDeployedWithBypass();
    vi.doMock('@nzila/db', () => ({ db: { execute: async () => [] } }));
    vi.doMock('@/lib/operations/catalog-admission', () => ({
      evaluateCatalogAdmission: async () => ({ ok: true }),
    }));
    const { GET } = await import('../../../app/api/ready/route');

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.checks.noTestBypass).toBe('fail');
    expect(body.reasonCodes).toEqual([TEST_BYPASS_REASON_CODE]);
    expect(body.testBypass.switchesPresent).toEqual(['UE_E2E_RISK_BYPASS']);
  });

  it('/api/ready keeps the bypass check passing when no switch is set', async () => {
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    vi.doMock('@nzila/db', () => ({ db: { execute: async () => [] } }));
    vi.doMock('@/lib/operations/catalog-admission', () => ({
      evaluateCatalogAdmission: async () => ({ ok: true }),
    }));
    const { GET } = await import('../../../app/api/ready/route');

    const body = await (await GET()).json();
    expect(body.checks.noTestBypass).toBe('ok');
    expect(body.reasonCodes).toBeUndefined();
  });
});
