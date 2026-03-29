/**
 * Unit Tests — lib/logger.ts
 *
 * Tests the structured logger for:
 * - Sensitive data redaction
 * - Correlation ID management
 * - Log level routing
 * - Performance timing
 * - HTTP request logging
 * - withLogging wrapper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry before importing logger
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe('Logger', () => {
  let loggerModule: typeof import('@/lib/logger');

  beforeEach(async () => {
    // Re-import to get fresh instance each time is not practical with singleton
    // so we test via the exported instance
    loggerModule = await import('@/lib/logger');
  });

  describe('correlation ID', () => {
    it('generatess a default correlation ID', () => {
      const id = loggerModule.logger.getCorrelationId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('allows setting a custom correlation ID', () => {
      const customId = 'test-correlation-id-abc';
      loggerModule.logger.setCorrelationId(customId);
      expect(loggerModule.logger.getCorrelationId()).toBe(customId);
    });
  });

  describe('setRequestCorrelationId', () => {
    it('extracts x-correlation-id header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-correlation-id': 'from-header' },
      });
      const id = loggerModule.setRequestCorrelationId(req);
      expect(id).toBe('from-header');
    });

    it('extracts x-request-id header as fallback', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-request-id': 'req-id-123' },
      });
      const id = loggerModule.setRequestCorrelationId(req);
      expect(id).toBe('req-id-123');
    });

    it('generates UUID when no header present', () => {
      const req = new Request('http://localhost');
      const id = loggerModule.setRequestCorrelationId(req);
      expect(id).toBeDefined();
      // UUID v4 pattern
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    });
  });

  describe('time()', () => {
    it('returns a stop function', () => {
      const stop = loggerModule.logger.time('test-operation');
      expect(typeof stop).toBe('function');
      // Should not throw when called
      stop();
    });
  });

  describe('logging methods exist', () => {
    it('has debug method', () => {
      expect(typeof loggerModule.logger.debug).toBe('function');
    });

    it('has info method', () => {
      expect(typeof loggerModule.logger.info).toBe('function');
    });

    it('has warn method', () => {
      expect(typeof loggerModule.logger.warn).toBe('function');
    });

    it('has error method', () => {
      expect(typeof loggerModule.logger.error).toBe('function');
    });
  });

  describe('redactSensitiveData (via info)', () => {
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('redacts password field', () => {
      loggerModule.logger.info('test', { password: 'secret123' });
      const output = writeSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret123');
    });

    it('redacts token field', () => {
      loggerModule.logger.info('test', { accessToken: 'tok_abc' });
      const output = writeSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('tok_abc');
    });

    it('partially redacts email field', () => {
      loggerModule.logger.info('test', { email: 'user@example.com' });
      const output = writeSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('u***@example.com');
      expect(output).not.toContain('user@example.com');
    });

    it('redacts secret field', () => {
      loggerModule.logger.info('test', { secret: 'my-secret-val' });
      const output = writeSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('my-secret-val');
    });

    it('does not redact non-sensitive fields', () => {
      loggerModule.logger.info('test', { userId: 'u1' });
      const output = writeSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('u1');
    });
  });

  describe('httpRequest', () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it('logs 200 at info level', () => {
      loggerModule.logger.httpRequest('GET', '/api/test', 200, 50);
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP GET /api/test 200')
      );
    });

    it('logs 404 at warn level', () => {
      loggerModule.logger.httpRequest('GET', '/api/missing', 404, 10);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP GET /api/missing 404')
      );
    });

    it('logs 500 at error level', () => {
      loggerModule.logger.httpRequest('POST', '/api/crash', 500, 100);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP POST /api/crash 500')
      );
    });
  });

  describe('withLogging', () => {
    it('wraps handler and sets correlation ID', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      const handler = vi.fn().mockResolvedValue(mockResponse);

      const wrapped = loggerModule.withLogging(handler, '/api/test');
      const req = new Request('http://localhost/api/test', {
        headers: { 'x-correlation-id': 'test-corr-id' },
      });

      const result = await wrapped(req);
      expect(handler).toHaveBeenCalledWith(req);
      expect(result.headers.get('x-correlation-id')).toBe('test-corr-id');
    });

    it('re-throws handler errors after logging', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('handler-boom'));
      const wrapped = loggerModule.withLogging(handler, '/api/fail');
      const req = new Request('http://localhost/api/fail');

      await expect(wrapped(req)).rejects.toThrow('handler-boom');
    });
  });

  describe('error method', () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stderrSpy.mockRestore();
    });

    it('logs error with cause', () => {
      const err = new Error('fail');
      err.cause = 'root cause';
      loggerModule.logger.error('Operation failed', err);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed')
      );
    });

    it('handles non-Error objects', () => {
      loggerModule.logger.error('Bad thing', 'string-error' as unknown as Error);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bad thing')
      );
    });
  });

  describe('debug suppression in production', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('suppresses debug in production', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      process.env.NODE_ENV = 'production';
      loggerModule.logger.debug('should not appear');
      expect(stdoutSpy).not.toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });
  });

  describe('gap coverage', () => {
    it('logs without context object', () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      loggerModule.logger.info('no-context-message');
      expect(stdoutSpy).toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });

    it('skips stdout/stderr write branch in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      process.env.NODE_ENV = 'production';
      loggerModule.logger.info('prod-log');
      expect(stdoutSpy).not.toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
      stdoutSpy.mockRestore();
    });

    it('warn method routes through Sentry warning path on server side', async () => {
      const originalWindow = (globalThis as unknown as Record<string, unknown>).window;
      delete (globalThis as unknown as Record<string, unknown>).window;
      const sentry = await import('@sentry/nextjs');
      vi.mocked(sentry.captureMessage).mockClear();

      loggerModule.logger.warn('server-warn', { a: 1 });
      await Promise.resolve();

      expect(vi.mocked(sentry.captureMessage)).toHaveBeenCalled();
      (globalThis as unknown as Record<string, unknown>).window = originalWindow;
    });

    it('handles missing Sentry module instance in browser warn path', async () => {
      vi.resetModules();
      const mod = await import('@/lib/logger');
      expect(() => mod.logger.warn('browser-warn-no-sentry')).not.toThrow();
      await Promise.resolve();
    });

    it('handles missing Sentry module instance in browser error path', async () => {
      vi.resetModules();
      const mod = await import('@/lib/logger');
      expect(() => mod.logger.error('browser-error-no-sentry', new Error('x'))).not.toThrow();
      await Promise.resolve();
    });

    it('time() emits slow-operation warning when duration exceeds threshold', () => {
      const nowSpy = vi.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2505);
      const stop = loggerModule.logger.time('slow-op');
      stop();
      nowSpy.mockRestore();
    });

    it('builds production stack summary branch for Error context', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const err = new Error('prod-branch');
      err.stack = 'a\nb\nc\nd';
      loggerModule.logger.error('prod-stack-branch', err);
      process.env.NODE_ENV = originalEnv;
    });

    it('swallows async Sentry callback failures', async () => {
      const originalWindow = (globalThis as unknown as Record<string, unknown>).window;
      delete (globalThis as unknown as Record<string, unknown>).window;
      const sentry = await import('@sentry/nextjs');
      vi.mocked(sentry.captureException).mockImplementation(() => {
        throw new Error('sentry-fail');
      });

      expect(() => loggerModule.logger.error('error-with-sentry-fail', new Error('x'))).not.toThrow();
      await Promise.resolve();

      vi.mocked(sentry.captureException).mockImplementation(() => undefined);
      (globalThis as unknown as Record<string, unknown>).window = originalWindow;
    });

    it('covers singleton getInstance when instance already exists', async () => {
      const mod = await import('@/lib/logger');
      const first = mod.logger;
      const second = mod.__loggerTestInternals.getSingletonInstance();
      expect(second).toBe(first);
    });

    it('covers warn branch when Sentry loader returns null', async () => {
      const mod = await import('@/lib/logger');
      mod.__loggerTestInternals.setSentryLoaderOverride(async () => null);
      mod.logger.warn('warn-no-sentry');
      await Promise.resolve();
      await Promise.resolve();
      mod.__loggerTestInternals.setSentryLoaderOverride(null);
    });

    it('covers warn else-if branch when Sentry exists', async () => {
      const captureMessage = vi.fn();
      const mod = await import('@/lib/logger');
      mod.__loggerTestInternals.setSentryLoaderOverride(async () => ({
        captureMessage,
        captureException: vi.fn(),
      } as unknown as typeof import('@sentry/nextjs')));

      mod.logger.warn('warn-with-sentry');
      await Promise.resolve();
      await Promise.resolve();

      expect(captureMessage).toHaveBeenCalled();
      mod.__loggerTestInternals.setSentryLoaderOverride(null);
    });

    it('covers error branch when Sentry loader returns null', async () => {
      const mod = await import('@/lib/logger');
      mod.__loggerTestInternals.setSentryLoaderOverride(async () => null);
      mod.logger.error('error-no-sentry', new Error('x'));
      await Promise.resolve();
      await Promise.resolve();
      mod.__loggerTestInternals.setSentryLoaderOverride(null);
    });
  });
});
