import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  EnvironmentManager,
  validateEnvironment,
  getEnvironmentAuditLog,
  getEnvironmentMetrics,
  requireEnv,
  env,
  printEnvironmentReport,
  getEnvironmentValidationResult,
} from '../env-validation';

/* ------------------------------------------------------------------ */
/* Helper: minimum valid env vars for the schema                       */
/* ------------------------------------------------------------------ */
const MINIMAL_ENV = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  AUTH_SECRET: 'test_auth_secret_32chars_xxxxxxxxxxxx',
  VOTING_SECRET: 'a'.repeat(32),
  EMAIL_PROVIDER: 'console',
};

describe('EnvironmentManager', () => {
  let mgr: EnvironmentManager;

  beforeEach(() => {
    mgr = new EnvironmentManager();
  });

  it('validate succeeds with minimal valid env', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      const result = mgr.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      // Restore env
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('validate fails when DATABASE_URL missing', () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const result = mgr.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('DATABASE_URL'))).toBe(true);
    } finally {
      process.env.DATABASE_URL = saved;
    }
  });

  it('validate fails when VOTING_SECRET too short', () => {
    const saved = { ...process.env };
    Object.assign(process.env, { ...MINIMAL_ENV, VOTING_SECRET: 'short' });
    try {
      const result = mgr.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('VOTING_SECRET'))).toBe(true);
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('get throws before validate', () => {
    expect(() => mgr.get('DATABASE_URL')).toThrow('Call validate() first');
  });

  it('getAll throws before validate', () => {
    expect(() => mgr.getAll()).toThrow('Call validate() first');
  });

  it('getValidationResult throws before validate', () => {
    expect(() => mgr.getValidationResult()).toThrow('Call validate() first');
  });

  it('get returns value after validate', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      const val = mgr.get('NODE_ENV');
      expect(val).toBe('test');
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('getAll returns environment copy', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      const all = mgr.getAll();
      expect(all.NODE_ENV).toBeDefined();
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('getAuditLog tracks validation events', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      const log = mgr.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].eventType).toBe('ENV_VALIDATION');
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('getAuditLog filters by eventType', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      mgr.get('NODE_ENV');
      const accessEvents = mgr.getAuditLog({ eventType: 'ENV_ACCESS' });
      expect(accessEvents.length).toBeGreaterThan(0);
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('getMetrics returns monitoring data', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      const metrics = mgr.getMetrics();
      expect(metrics.isValid).toBe(true);
      expect(metrics.totalVariables).toBeGreaterThan(0);
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('printReport does not throw', () => {
    const saved = { ...process.env };
    Object.assign(process.env, MINIMAL_ENV);
    try {
      mgr.validate();
      expect(() => mgr.printReport()).not.toThrow();
    } finally {
      Object.keys(MINIMAL_ENV).forEach(k => { process.env[k] = saved[k]; });
    }
  });

  it('printReport skips if not validated', () => {
    expect(() => mgr.printReport()).not.toThrow();
  });
});

describe('validateEnvironment (module-level singleton)', () => {
  it('returns ValidationResult', () => {
    const result = validateEnvironment();
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('environment');
  });
});

describe('getEnvironmentAuditLog', () => {
  it('returns array', () => {
    validateEnvironment();
    const log = getEnvironmentAuditLog();
    expect(Array.isArray(log)).toBe(true);
  });
});

describe('getEnvironmentMetrics', () => {
  it('returns metrics object', () => {
    validateEnvironment();
    const m = getEnvironmentMetrics();
    expect(m).toHaveProperty('isValid');
    expect(m).toHaveProperty('auditEventCount');
  });
});

describe('requireEnv', () => {
  it('returns env value when present', () => {
    process.env.TEST_REQUIRE_ENV = 'hello';
    expect(requireEnv('TEST_REQUIRE_ENV')).toBe('hello');
    delete process.env.TEST_REQUIRE_ENV;
  });

  it('throws when env var missing', () => {
    delete process.env.NONEXISTENT_VAR_XYZ;
    expect(() => requireEnv('NONEXISTENT_VAR_XYZ')).toThrow('Missing required environment variable');
  });
});

/* ------------------------------------------------------------------ */
/* Schema transform/refine coverage — fully populated valid env        */
/* ------------------------------------------------------------------ */
const FULL_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://app.test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  DB_POOL_MAX: '50',
  DB_IDLE_TIMEOUT: '30',
  DB_CONNECTION_TIMEOUT: '10',
  DB_QUERY_TIMEOUT: '30000',
  DB_SSL: 'true',
  AUTH_SECRET: 'super-secret-value',
  VOTING_SECRET: 'voting-secret-that-is-32-chars-long!!',
  EMAIL_PROVIDER: 'console',
  DNS_AUTOMATION_ENABLED: 'false',
  DNS_TTL: '600',
  PROVINCIAL_PRIVACY_ENABLED: 'true',
  QUEBEC_DATA_RESIDENCY_REQUIRED: 'true',
  INDIGENOUS_DATA_ENABLED: 'true',
  BAND_COUNCIL_CONSENT_REQUIRED: 'true',
  TRADITIONAL_KNOWLEDGE_PROTECTION: 'true',
  FNIGC_COMPLIANCE_ENABLED: 'true',
  STRIKE_FUND_TAX_REPORTING_ENABLED: 'true',
  T4A_REPORTING_ENABLED: 'true',
  T4A_THRESHOLD: '500',
  RL1_REPORTING_ENABLED: 'true',
  BREAK_GLASS_ENABLED: 'true',
  BREAK_GLASS_MAX_DURATION: '24',
  FORCE_MAJEURE_48H_COMMITMENT: 'true',
  SWISS_COLD_STORAGE_ENABLED: 'true',
  AI_CHATBOT_TEMPERATURE: '0.7',
  CHATBOT_RAG_ENABLED: 'true',
  CONTENT_SAFETY_ENABLED: 'true',
  LANGFUSE_ENABLED: 'true',
  REWARDS_ENABLED: 'false',
  SHOPIFY_ENABLED: 'false',
  GEOFENCE_PRIVACY_ENABLED: 'true',
  LOCATION_TRACKING_ENABLED: 'false',
  LOCATION_TRACKING_CONSENT_REQUIRED: 'true',
  CURRENCY_ENFORCEMENT_ENABLED: 'true',
  NEXT_PUBLIC_GDPR_ENABLED: 'true',
  ADDRESS_VALIDATION_ENABLED: 'true',
  ACCESSIBILITY_AXE_ENABLED: 'true',
  ACCESSIBILITY_LIGHTHOUSE_ENABLED: 'true',
  ACCESSIBILITY_MIN_SCORE: '80',
  OTEL_ENABLED: 'true',
};

function stubFull(overrides: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries(FULL_ENV)) {
    vi.stubEnv(k, overrides[k] !== undefined ? (overrides[k] as string) : v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (!(k in FULL_ENV) && v !== undefined) vi.stubEnv(k, v as string);
  }
}

describe('env-validation schema transforms & branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates a fully populated env and runs every transform closure', () => {
    stubFull();
    const result = validateEnvironment();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.environment.DB_POOL_MAX).toBe(50);
    expect(result.environment.DB_SSL).toBe(true);
    expect(result.environment.T4A_THRESHOLD).toBe(500);
    expect(result.environment.DNS_TTL).toBe(600);
    expect(result.environment.BREAK_GLASS_MAX_DURATION).toBe(24);
    expect(result.environment.ACCESSIBILITY_MIN_SCORE).toBe(80);
    expect(result.environment.AI_CHATBOT_TEMPERATURE).toBeCloseTo(0.7);
    expect(result.environment.SWISS_COLD_STORAGE_ENABLED).toBe(true);
  });

  it('env proxy access works and symbol keys return undefined', () => {
    stubFull();
    validateEnvironment();
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect((env as Record<symbol, unknown>)[Symbol('x')]).toBeUndefined();
  });

  it('getEnvironmentValidationResult + printEnvironmentReport on valid env', () => {
    stubFull();
    validateEnvironment();
    void env.AUTH_SECRET;
    expect(getEnvironmentValidationResult().isValid).toBe(true);
    const filtered = getEnvironmentAuditLog({ eventType: 'ENV_ACCESS', status: 'ACCESSED' });
    expect(filtered.every((e) => e.eventType === 'ENV_ACCESS')).toBe(true);
    expect(getEnvironmentMetrics().isValid).toBe(true);
    expect(() => printEnvironmentReport()).not.toThrow();
  });

  it('emits production warnings for missing observability/payment/email config', () => {
    stubFull({ NODE_ENV: 'production', EMAIL_PROVIDER: 'resend' });
    const result = validateEnvironment();
    expect(result.warnings.some((w) => w.includes('SENTRY_DSN'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('RESEND_API_KEY'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('EMAIL_FROM'))).toBe(true);
    expect(() => printEnvironmentReport()).not.toThrow();
  });

  it('requires DNS_* vars when DNS_AUTOMATION_ENABLED=true', () => {
    stubFull({ DNS_AUTOMATION_ENABLED: 'true' });
    const result = validateEnvironment();
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('DNS_PROVIDER'))).toBe(true);
    expect(result.errors.some((e) => e.includes('DNS_ZONE_NAME'))).toBe(true);
    expect(result.errors.some((e) => e.includes('DNS_PROD_ORIGIN'))).toBe(true);
  });

  it('rejects invalid numeric refine bounds (DB_POOL_MAX out of range)', () => {
    stubFull({ DB_POOL_MAX: '9999' });
    const result = validateEnvironment();
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('DB_POOL_MAX'))).toBe(true);
  });
});

