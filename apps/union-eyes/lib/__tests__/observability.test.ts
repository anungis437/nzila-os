/**
 * Tests for observability.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCreateRequestContext: vi.fn(),
  mockRunWithContext: vi.fn(),
  mockCreateLogger: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mocks.mockAuth,
}));

vi.mock('@nzila/os-core', () => ({
  createRequestContext: mocks.mockCreateRequestContext,
  runWithContext: mocks.mockRunWithContext,
  createLogger: mocks.mockCreateLogger,
  getRequestContext: vi.fn(),
}));

describe('observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' });
    mocks.mockCreateRequestContext.mockReturnValue({
      requestId: 'req-abc',
      traceId: 'trace-123',
    });
    mocks.mockCreateLogger.mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    });
    // Make runWithContext execute the callback immediately
    mocks.mockRunWithContext.mockImplementation((_ctx: unknown, fn: () => Promise<unknown>) => fn());
  });

  describe('withObservability', () => {
    it('wraps handler and adds tracing headers', async () => {
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ ok: true }),
      );

      const wrapped = withObservability(innerHandler);
      const req = new NextRequest('http://localhost/api/test');
      const response = await wrapped(req);

      expect(innerHandler).toHaveBeenCalledTimes(1);
      expect(response.headers.get('x-request-id')).toBe('req-abc');
      expect(response.headers.get('x-response-time')).toBeDefined();
    });

    it('calls auth to get userId and orgId', async () => {
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withObservability(innerHandler);
      await wrapped(new NextRequest('http://localhost/api/test'));

      expect(mocks.mockAuth).toHaveBeenCalled();
      expect(mocks.mockCreateRequestContext).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ userId: 'user-1', orgId: 'org-1' }),
      );
    });

    it('re-throws handler errors', async () => {
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockRejectedValue(new Error('boom'));
      const wrapped = withObservability(innerHandler);

      await expect(wrapped(new NextRequest('http://localhost/api/test'))).rejects.toThrow('boom');
    });

    it('accepts appName option', async () => {
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockResolvedValue(NextResponse.json({}));
      const wrapped = withObservability(innerHandler, { appName: 'custom-app' });
      await wrapped(new NextRequest('http://localhost/api/test'));

      expect(mocks.mockCreateRequestContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ appName: 'custom-app' }),
      );
    });

    it('passes undefined userId/orgId when auth returns null', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withObservability(innerHandler);
      await wrapped(new NextRequest('http://localhost/api/null-auth'));

      expect(mocks.mockCreateRequestContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: undefined, orgId: undefined }),
      );
    });

    it('logs non-Error throws as string in catch block', async () => {
      const { withObservability } = await import('../observability');

      const innerHandler = vi.fn().mockRejectedValue('string-error');
      const wrapped = withObservability(innerHandler);

      await expect(wrapped(new NextRequest('http://localhost/api/test'))).rejects.toBe('string-error');
    });
  });
});
