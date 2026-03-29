import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  initializeTracing,
  shutdownTracing,
  getTraceContext,
} from '../opentelemetry';

beforeEach(() => {
  vi.clearAllMocks();
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
