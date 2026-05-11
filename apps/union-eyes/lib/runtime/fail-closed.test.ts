/**
 * Tier 2 fail-closed runtime gate tests.
 *
 * Doctrine: docs/nzila-tier2-hardening/full-fail-closed-runtime-architecture.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RuntimeContractError,
  assessRuntimeContracts,
  enforceRuntimeFailClosed,
  type EnforceLogger,
} from './fail-closed';

const REQUIRED_VARS = [
  'AUTH_SECRET',
  'DJANGO_SECRET_KEY',
  'AUTH_WEBHOOK_SECRET',
  'FALLBACK_ENCRYPTION_KEY',
  'EVIDENCE_SEAL_KEY',
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_TENANT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'DATABASE_URL',
  'SECRET_TOPOLOGY',
  'SECRET_AUTHORITY',
  'ENVIRONMENT_ISOLATION',
  'RUNTIME_FAIL_CLOSED',
] as const;

const OWNED_KEYS = new Set<string>(REQUIRED_VARS);

let snapshot: Record<string, string | undefined> = {};

function clearOwnedEnv() {
  for (const key of OWNED_KEYS) {
    delete process.env[key];
  }
}

function setAllSatisfied() {
  process.env.AUTH_SECRET = 'a';
  process.env.DJANGO_SECRET_KEY = 'b';
  process.env.AUTH_WEBHOOK_SECRET = 'c';
  process.env.FALLBACK_ENCRYPTION_KEY = 'd';
  process.env.EVIDENCE_SEAL_KEY = 'e';
  process.env.AZURE_AD_CLIENT_ID = 'f';
  process.env.AZURE_AD_TENANT_ID = 'g';
  process.env.AZURE_AD_CLIENT_SECRET = 'h';
  process.env.DATABASE_URL = 'postgres://u:p@h:5432/d';
  process.env.SECRET_TOPOLOGY = 'isolated';
  process.env.SECRET_AUTHORITY = 'demo-kv';
  process.env.ENVIRONMENT_ISOLATION = 'full';
}

function makeLogger(): EnforceLogger & { messages: { info: string[]; warn: string[]; error: string[] } } {
  const messages = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  return {
    info: (m) => void messages.info.push(m),
    warn: (m) => void messages.warn.push(m),
    error: (m) => void messages.error.push(m),
    messages,
  };
}

beforeEach(() => {
  snapshot = {};
  for (const key of OWNED_KEYS) {
    snapshot[key] = process.env[key];
  }
  clearOwnedEnv();
});

afterEach(() => {
  clearOwnedEnv();
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe('assessRuntimeContracts', () => {
  it('reports every contract as unmet when env is empty', () => {
    const report = assessRuntimeContracts();
    expect(report.contracts).toHaveLength(12);
    expect(report.satisfiedAll).toBe(false);
    expect(report.unmetRequired.map((c) => c.envVar)).toEqual(
      expect.arrayContaining(['AUTH_SECRET', 'DJANGO_SECRET_KEY', 'FALLBACK_ENCRYPTION_KEY', 'DATABASE_URL']),
    );
  });

  it('reports satisfied when every contract is present', () => {
    setAllSatisfied();
    const report = assessRuntimeContracts();
    expect(report.satisfiedAll).toBe(true);
    expect(report.unmetRequired).toHaveLength(0);
    expect(report.unmetOptional).toHaveLength(0);
  });

  it('treats whitespace-only values as unsatisfied', () => {
    setAllSatisfied();
    process.env.AUTH_SECRET = '   ';
    const report = assessRuntimeContracts();
    expect(report.satisfiedAll).toBe(false);
    expect(report.unmetRequired.some((c) => c.envVar === 'AUTH_SECRET')).toBe(true);
  });

  it('exposes failClosedEnabled from RUNTIME_FAIL_CLOSED', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    expect(assessRuntimeContracts().failClosedEnabled).toBe(true);
    process.env.RUNTIME_FAIL_CLOSED = 'false';
    expect(assessRuntimeContracts().failClosedEnabled).toBe(false);
  });
});

describe('enforceRuntimeFailClosed', () => {
  it('throws RuntimeContractError when fail-closed enforced and required contracts missing', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    const logger = makeLogger();
    expect(() => enforceRuntimeFailClosed(logger)).toThrow(RuntimeContractError);
    expect(logger.messages.error.length).toBeGreaterThan(0);
  });

  it('does not throw under fail-closed when every contract is satisfied', () => {
    setAllSatisfied();
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    const logger = makeLogger();
    expect(() => enforceRuntimeFailClosed(logger)).not.toThrow();
    expect(logger.messages.info.length).toBeGreaterThan(0);
  });

  it('emits a warn banner when advisory and contracts are unmet', () => {
    process.env.AUTH_SECRET = 'a';
    process.env.DJANGO_SECRET_KEY = 'b';
    process.env.FALLBACK_ENCRYPTION_KEY = 'd';
    process.env.DATABASE_URL = 'postgres://u:p@h:5432/d';
    // RUNTIME_FAIL_CLOSED unset → advisory mode
    const logger = makeLogger();
    const report = enforceRuntimeFailClosed(logger);
    expect(report.failClosedEnabled).toBe(false);
    expect(report.unmetRequired).toHaveLength(0);
    expect(report.unmetOptional.length).toBeGreaterThan(0);
    expect(logger.messages.warn.length).toBeGreaterThan(0);
  });

  it('exposes the structured report on the thrown error', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    try {
      enforceRuntimeFailClosed(makeLogger());
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RuntimeContractError);
      const e = err as RuntimeContractError;
      expect(e.report.failClosedEnabled).toBe(true);
      expect(e.report.unmetRequired.length).toBeGreaterThan(0);
    }
  });
});
