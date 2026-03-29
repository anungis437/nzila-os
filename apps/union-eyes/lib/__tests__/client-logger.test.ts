import { describe, it, expect, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
}));

import { createClientLogger } from '../client-logger';

describe('client-logger', () => {
  it('creates a logger with all four methods', () => {
    const log = createClientLogger('test-ns');
    expect(log).toHaveProperty('info');
    expect(log).toHaveProperty('warn');
    expect(log).toHaveProperty('error');
    expect(log).toHaveProperty('debug');
  });

  it('info/warn/error/debug are callable without throwing', () => {
    const log = createClientLogger('test');
    expect(() => log.info('hello')).not.toThrow();
    expect(() => log.warn('oh', { x: 1 })).not.toThrow();
    expect(() => log.error('bad', { err: 'x' })).not.toThrow();
    expect(() => log.debug('trace')).not.toThrow();
  });
});
