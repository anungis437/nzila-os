import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { warn: mocks.warn, error: mocks.error },
}));

import {
  initializeConsoleWrapper,
  restoreConsole,
  getOriginalConsole,
} from '../console-wrapper';

describe('lib/console-wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreConsole();
    vi.unstubAllEnvs();
  });

  it('is a no-op outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const before = console.warn;
    initializeConsoleWrapper();
    expect(console.warn).toBe(before);
  });

  it('routes warn and error through the structured logger in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    initializeConsoleWrapper();

    console.log('silenced');
    console.info('silenced');
    console.debug('silenced');
    console.warn('be careful', { code: 1 });

    expect(mocks.warn).toHaveBeenCalledWith('be careful {"code":1}');

    const err = new Error('boom');
    console.error('context', err);
    expect(mocks.error).toHaveBeenCalledWith('context', err);

    // error with no Error argument
    console.error('plain failure');
    expect(mocks.error).toHaveBeenCalledWith('plain failure');

    // bare Error argument falls back to the error message
    mocks.error.mockClear();
    const lone = new Error('lonely');
    console.error(lone);
    expect(mocks.error).toHaveBeenCalledWith('lonely', lone);
  });

  it('restoreConsole reinstates the original methods', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const orig = getOriginalConsole();
    initializeConsoleWrapper();
    restoreConsole();
    expect(console.log).toBe(orig.log);
    expect(console.warn).toBe(orig.warn);
    expect(console.error).toBe(orig.error);
  });

  it('getOriginalConsole exposes the captured methods', () => {
    const orig = getOriginalConsole();
    expect(typeof orig.log).toBe('function');
    expect(typeof orig.info).toBe('function');
    expect(typeof orig.warn).toBe('function');
    expect(typeof orig.error).toBe('function');
    expect(typeof orig.debug).toBe('function');
  });
});
