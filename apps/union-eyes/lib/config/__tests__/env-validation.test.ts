import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  EnvironmentManager,
  validateEnvironment,
  getEnvironmentAuditLog,
  getEnvironmentMetrics,
  requireEnv,
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
