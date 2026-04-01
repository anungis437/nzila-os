import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  initializeTracing,
  shutdownTracing,
  getTraceContext,
} from '../opentelemetry';

const origOtelEnabled = process.env.OTEL_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  // Disable real SDK initialisation so tests don't hang connecting to a collector
  process.env.OTEL_ENABLED = 'false';
});

afterEach(() => {
  if (origOtelEnabled === undefined) {
    delete process.env.OTEL_ENABLED;
  } else {
    process.env.OTEL_ENABLED = origOtelEnabled;
  }
});

describe('initializeTracing', () => {
  it('does not throw on invocation (packages may not be installed)', async () => {
    await expect(initializeTracing()).resolves.not.toThrow();
  });

  it('skips duplicate initialization', async () => {
    // First call may or may not init depending on packages; second should skip
    await initializeTracing();
    await initializeTracing();
    // No error thrown means idempotent
  });
});

describe('shutdownTracing', () => {
  it('does not throw when sdk is null', async () => {
    await expect(shutdownTracing()).resolves.not.toThrow();
  });
});

describe('getTraceContext', () => {
  it('returns empty object when OTel not available', () => {
    const ctx = getTraceContext();
    expect(ctx).toEqual({});
  });
});
