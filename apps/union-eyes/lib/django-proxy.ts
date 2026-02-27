/**
 * Django Proxy Utility
 *
 * Forwards Next.js API route requests to the Django REST backend, injecting
 * the current Clerk JWT so Django's ClerkAuthentication validates them.
 *
 * Usage in a route handler (replaces all Drizzle query logic):
 *
 *   export const GET = (req: NextRequest) =>
 *     djangoProxy(req, '/api/auth_core/users/');
 *
 *   export const GET = (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
 *     djangoProxy(req, `/api/auth_core/users/${(await params).id}/`);
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createLogger } from '@nzila/os-core'

const logger = createLogger('django-proxy')

const DJANGO_API_URL = process.env.DJANGO_API_URL ?? 'http://localhost:8000';

export interface ProxyOptions {
  /** Override the HTTP method (default: same as incoming request) */
  method?: string;
  /** Extra headers to merge into the upstream request */
  extraHeaders?: Record<string, string>;
  /** Transform the request body before forwarding (default: pass-through) */
  transformBody?: (body: unknown) => unknown;
  /** Transform the Django response JSON before returning to client */
  transformResponse?: (data: unknown) => unknown;
  /**
   * When true (default), the Clerk JWT is required; missing auth returns 401.
   * Set to false explicitly for public endpoints (health checks, public data)
   * where Django's IsAuthenticatedOrReadOnly will decide.
   *
   * @default true
   */
  requireAuth?: boolean;
}

/**
 * Core proxy: forwards a Next.js Request to a Django endpoint.
 *
 * @param req     The incoming Next.js request
 * @param path    Django API path, e.g. '/api/auth_core/users/'
 * @param options Optional overrides
 */
export async function djangoProxy(
  req: NextRequest,
  path: string,
  options: ProxyOptions = {},
): Promise<NextResponse> {
  // ── 1. Resolve auth ────────────────────────────────────────────────────────
  const { getToken, orgId } = await auth();
  const token = await getToken();

  // Secure-by-default: requireAuth is true unless explicitly set to false
  const authRequired = options.requireAuth !== false;
  if (authRequired && !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Build upstream URL — preserve query string ──────────────────────────
  const incomingUrl = new URL(req.url);
  const upstreamUrl = new URL(
    path + incomingUrl.search,
    DJANGO_API_URL,
  );

  // ── 3. Build headers ───────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Forward the current org so Django can scope queries automatically
  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }

  // Propagate request ID / trace headers when present
  const requestId = req.headers.get('x-request-id');
  if (requestId) headers['X-Request-Id'] = requestId;

  Object.assign(headers, options.extraHeaders ?? {});

  // ── 4. Build request body ──────────────────────────────────────────────────
  let body: string | undefined;
  const method = (options.method ?? req.method).toUpperCase();

  if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
    try {
      // Clone avoids "body already consumed" errors on retry
      const raw = await req.clone().json();
      const transformed = options.transformBody ? options.transformBody(raw) : raw;
      body = JSON.stringify(transformed);
    } catch {
      // Body may be empty (e.g. DELETE with no payload)
      body = undefined;
    }
  }

  // ── 5. Forward to Django ───────────────────────────────────────────────────
  let djangoResp: Response;
  try {
    djangoResp = await fetch(upstreamUrl.toString(), {
      method,
      headers,
      body,
      // Timeouts: 30 s for reads, 10 s to connect
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[djangoProxy] upstream fetch failed: ${message}`, { detail: {
      url: upstreamUrl.toString(),
      method,
    }});
    return NextResponse.json(
      { error: 'Backend unavailable', detail: message },
      { status: 502 },
    );
  }

  // ── 6. Return upstream response ────────────────────────────────────────────
  const contentType = djangoResp.headers.get('content-type') ?? '';

  // Non-JSON responses (e.g. file downloads, 204 No Content)
  if (!contentType.includes('application/json')) {
    const blob = await djangoResp.arrayBuffer();
    return new NextResponse(blob, {
      status: djangoResp.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
      },
    });
  }

  // JSON responses
  let data: unknown;
  try {
    data = await djangoResp.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON from backend' },
      { status: 502 },
    );
  }

  if (options.transformResponse) {
    data = options.transformResponse(data);
  }

  return NextResponse.json(data, { status: djangoResp.status });
}

// ─── Shorthand helpers ─────────────────────────────────────────────────────

/** GET request to Django */
export const proxyGet = (
  req: NextRequest,
  path: string,
  opts?: ProxyOptions,
) => djangoProxy(req, path, { ...opts, method: 'GET' });

/** POST request to Django */
export const proxyPost = (
  req: NextRequest,
  path: string,
  opts?: ProxyOptions,
) => djangoProxy(req, path, { ...opts, method: 'POST' });

/** PATCH request to Django */
export const proxyPatch = (
  req: NextRequest,
  path: string,
  opts?: ProxyOptions,
) => djangoProxy(req, path, { ...opts, method: 'PATCH' });

/** PUT request to Django */
export const proxyPut = (
  req: NextRequest,
  path: string,
  opts?: ProxyOptions,
) => djangoProxy(req, path, { ...opts, method: 'PUT' });

/** DELETE request to Django */
export const proxyDelete = (
  req: NextRequest,
  path: string,
  opts?: ProxyOptions,
) => djangoProxy(req, path, { ...opts, method: 'DELETE' });

/**
 * Builds a proxy handler for a DRF router resource.
 *
 * Creates GET (list) and POST (create) handlers that proxy to:
 *   `<prefix>/`
 *
 * And GET (detail), PATCH (update), DELETE (destroy) handlers that proxy to:
 *   `<prefix>/<id>/`
 *
 * Example:
 *   const { GET, POST } = buildRouterProxy('/api/auth_core/users');
 *   export { GET, POST };
 *
 *   const { GET, PATCH, DELETE } = buildDetailProxy('/api/auth_core/users', id);
 */
export function buildListProxy(prefix: string, opts?: ProxyOptions) {
  const p = prefix.endsWith('/') ? prefix : prefix + '/';
  return {
    GET: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'GET' }),
    POST: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'POST' }),
  };
}

export function buildDetailProxy(
  prefix: string,
  id: string,
  opts?: ProxyOptions,
) {
  const p = `${prefix.replace(/\/$/, '')}/${id}/`;
  return {
    GET: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'GET' }),
    PATCH: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'PATCH' }),
    PUT: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'PUT' }),
    DELETE: (req: NextRequest) => djangoProxy(req, p, { ...opts, method: 'DELETE' }),
  };
}

/**
 * Shorthand: proxy ALL HTTP methods for a list or detail route.
 *
 * List route (no id):
 *   export const { GET, POST } = proxyResource('/api/unions/member-employment');
 *
 * Detail route (with id):
 *   export const { GET, PATCH, DELETE } = proxyResource('/api/unions/member-employment', id);
 */
export function proxyResource(basePath: string, id?: string, opts?: ProxyOptions) {
  if (id !== undefined) {
    return buildDetailProxy(basePath, id, opts);
  }
  return buildListProxy(basePath, opts);
}
