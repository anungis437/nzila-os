/**
 * Observability Middleware — PR-070
 *
 * Wraps API route handlers to establish request context
 * (correlation IDs, user/org, timing) so that structured logging
 * and audit entries automatically include tracing information.
 *
 * Uses @nzila/os-core's `runWithContext` + `createRequestContext`
 * to bind AsyncLocalStorage for the duration of the request,
 * ensuring every `createLogger()` call within the handler
 * emits logs with requestId, traceId, userId, orgId.
 *
 * Usage:
 *   export const GET = withObservability(
 *     withApiAuth(async (request) => { ... }),
 *     { appName: 'union-eyes' }
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRequestContext, runWithContext, createLogger } from '@nzila/os-core';
import { auth } from '@nzila/platform-auth/entra/server';

const logger = createLogger('observability');

export interface ObservabilityOptions {
  appName?: string;
}

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<NextResponse | Response>;

/**
 * Wrap a Next.js route handler to establish request context.
 *
 * Automatically extracts:
 * - x-request-id / traceparent from headers
 * - userId / orgId from Clerk auth
 *
 * Sets response headers:
 * - x-request-id (echo back for client correlation)
 * - x-response-time (duration in ms)
 */
export function withObservability(
  handler: RouteHandler,
  opts: ObservabilityOptions = {},
): RouteHandler {
  return async (request: NextRequest, routeCtx?) => {
    const { userId, orgId } = await auth();

    const reqCtx = createRequestContext(request, {
      appName: opts.appName ?? 'union-eyes',
      userId: userId ?? undefined,
      orgId: orgId ?? undefined,
    });

    return runWithContext(reqCtx, async () => {
      const start = Date.now();

      logger.info('Request started', {
        method: request.method,
        path: new URL(request.url).pathname,
      });

      try {
        const response = await handler(request, routeCtx);

        const duration = Date.now() - start;

        // Add tracing headers to response
        const headers = new Headers(response.headers);
        headers.set('x-request-id', reqCtx.requestId);
        headers.set('x-response-time', `${duration}ms`);

        logger.info('Request completed', {
          method: request.method,
          path: new URL(request.url).pathname,
          status: response.status,
          durationMs: duration,
        });

        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Request failed', {
          method: request.method,
          path: new URL(request.url).pathname,
          durationMs: duration,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  };
}

/**
 * Extract the current correlation ID from the request context.
 * Useful for embedding in audit entries.
 */
export { getRequestContext } from '@nzila/os-core';
