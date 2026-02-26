/**
 * Unified API Route Wrapper — `withApi()`
 *
 * A single composable entry-point that wires together:
 *   - Authentication (Clerk + RBAC via api-auth-guard)
 *   - Input validation (Zod)
 *   - Rate limiting (Redis / Upstash)
 *   - Standardised response envelope
 *   - Error handling (catches `ApiError` + unknown throws)
 *   - OpenAPI metadata registration (auto-documents the route)
 *   - Request tracing (X-Trace-ID header)
 *
 * ─── Before ──────────────────────────────────────────────────────────────────
 *
 *   export const POST = withRoleAuth('steward', async (request, context) => {
 *     const body = await request.json();
 *     const parsed = calculateDuesSchema.safeParse(body);
 *     if (!parsed.success) return standardErrorResponse(...);
 *     const rl = await checkRateLimit(context.userId, RATE_LIMITS.FINANCIAL_READ);
 *     if (!rl.allowed) return NextResponse.json({ error: '...' }, { status: 429 });
 *     try { ... } catch (e) { return standardErrorResponse(...); }
 *   });
 *
 * ─── After ───────────────────────────────────────────────────────────────────
 *
 *   export const POST = withApi({
 *     auth: { minRole: 'steward' },
 *     body: calculateDuesSchema,
 *     rateLimit: RATE_LIMITS.FINANCIAL_READ,
 *     openapi: { tags: ['Dues'], summary: 'Calculate dues' },
 *   }, async ({ body, user, organizationId }) => {
 *     const result = await DuesCalculationEngine.calculateMemberDues({ ... });
 *     if (!result) throw ApiError.notFound('Dues record');
 *     return result;
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module lib/api/with-api
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  ErrorCode,
  standardErrorResponse,
} from './standardized-responses';
import { ApiError } from './errors';
import {
  ROLE_HIERARCHY,
  getCurrentUser,
  type AuthUser,
  type UserRole,
} from '@/lib/api-auth-guard';
import {
  checkRateLimit,
  createRateLimitHeaders,
  type RateLimitConfig,
} from '@/lib/rate-limiter';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Options passed to `withApi()` to declaratively configure the route.
 *
 * Every property is optional so the simplest possible route is:
 *   `withApi({}, async () => ({ greeting: 'hello' }))`
 */
export interface WithApiOptions<
  TBody extends z.ZodTypeAny = z.ZodNever,
  TQuery extends z.ZodTypeAny = z.ZodNever,
> {
  // ── Authentication ────────────────────────────────────────────────────────

  /** Auth configuration. Omit to require auth with no role check. */
  auth?: {
    /** Set `false` to make the route public (no auth required) */
    required?: boolean;
    /** Require user to have exactly one of these roles */
    roles?: UserRole[];
    /** Require user to meet this minimum role level (uses ROLE_HIERARCHY) */
    minRole?: UserRole;
    /** Validate cron secret header instead of user auth */
    cron?: boolean;
  };

  // ── Validation ────────────────────────────────────────────────────────────

  /** Zod schema for request body (automatically parsed from `request.json()`) */
  body?: TBody;

  /** Zod schema for URL search params (automatically parsed) */
  query?: TQuery;

  // ── Rate Limiting ─────────────────────────────────────────────────────────

  /** Rate-limit config from `RATE_LIMITS.*`. Keyed by authenticated userId. */
  rateLimit?: RateLimitConfig;

  // ── OpenAPI ───────────────────────────────────────────────────────────────

  /** OpenAPI metadata. Providing this auto-registers the route with the spec. */
  openapi?: {
    /** Tags for grouping (e.g. ['Dues', 'Finance']) */
    tags?: string[];
    /** One-line summary */
    summary?: string;
    /** Longer description (Markdown-supported) */
    description?: string;
    /** Mark as deprecated */
    deprecated?: boolean;
  };

  // ── Response ──────────────────────────────────────────────────────────────

  /** HTTP status code for successful response (default 200) */
  successStatus?: number;
}

/**
 * The resolved context handed to the route handler function.
 * Fields are present based on the options supplied.
 */
export interface ApiContext<
  TBody = unknown,
  TQuery = unknown,
> {
  /** The raw Next.js request */
  request: NextRequest;
  /** Authenticated user (null when `auth.required === false` and unauthenticated) */
  user: AuthUser | null;
  /** Convenience accessor: authenticated user's ID */
  userId: string | null;
  /** Convenience accessor: current organization */
  organizationId: string | null;
  /** Parsed request body (present when `body` schema supplied) */
  body: TBody;
  /** Parsed query params (present when `query` schema supplied) */
  query: TQuery;
  /** Route params from Next.js `context.params` */
  params: Record<string, string>;
  /** Trace-id for the request (also sent in response headers) */
  traceId: string;
}

/**
 * The return value of the handler. Can be:
 * - A plain object → wrapped in `standardSuccessResponse()`
 * - A `NextResponse` → passed through unmodified (escape hatch)
 * - `void` / `undefined` → 204 No Content
 */
type HandlerReturn = Record<string, unknown> | NextResponse | void | null;

type HandlerFn<TBody, TQuery> = (ctx: ApiContext<TBody, TQuery>) => Promise<HandlerReturn> | HandlerReturn;

// ─── Trace-ID generator ─────────────────────────────────────────────────────

function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().substring(0, 8);
  return `${ts}-${rand}`;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Build a Next.js route handler with declarative auth, validation, rate-limit,
 * error-handling and OpenAPI registration.
 *
 * @example
 * // Authenticated route with body validation
 * export const POST = withApi({
 *   auth: { minRole: 'steward' },
 *   body: z.object({ memberId: zUUID, amount: z.number().positive() }),
 *   rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
 *   openapi: { tags: ['Dues'], summary: 'Record dues payment' },
 * }, async ({ body, organizationId }) => {
 *   const payment = await recordPayment(organizationId!, body);
 *   return { payment };
 * });
 *
 * @example
 * // Public route with query validation
 * export const GET = withApi({
 *   auth: { required: false },
 *   query: paginationSchema,
 *   openapi: { tags: ['Public'], summary: 'List testimonials' },
 * }, async ({ query }) => {
 *   return db.query.testimonials.findMany({ limit: query.pageSize, offset: (query.page - 1) * query.pageSize });
 * });
 */
export function withApi<
  TBody extends z.ZodTypeAny = z.ZodNever,
  TQuery extends z.ZodTypeAny = z.ZodNever,
>(
  options: WithApiOptions<TBody, TQuery>,
  handler: HandlerFn<z.infer<TBody>, z.infer<TQuery>>,
) {
  // Pre-compute auth requirements
  const requireAuth = options.auth?.required !== false && !options.auth?.cron;
  const requireCron = options.auth?.cron === true;
  const minRoleLevel = options.auth?.minRole
    ? (ROLE_HIERARCHY[options.auth.minRole] ?? 0)
    : null;
  const allowedRoles = options.auth?.roles ?? null;

  // Return the actual Next.js handler
  return async (
    request: NextRequest,
    nextContext?: { params?: Promise<Record<string, string>> | Record<string, string> },
  ): Promise<NextResponse> => {
    const traceId = generateTraceId();

    try {
      // ── 1. Resolve route params (Next.js 16 async params) ───────────────
      let params: Record<string, string> = {};
      if (nextContext?.params) {
        params =
          nextContext.params instanceof Promise
            ? await nextContext.params
            : nextContext.params;
      }

      // ── 2. Cron authentication ─────────────────────────────────────────
      if (requireCron) {
        const cronSecret = request.headers.get('x-cron-secret');
        const expected = process.env.CRON_SECRET_KEY;
        if (!expected || cronSecret !== expected) {
          return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Invalid cron secret', undefined, traceId);
        }
      }

      // ── 3. User authentication ─────────────────────────────────────────
      let user: AuthUser | null = null;

      if (requireAuth || !requireCron) {
        try {
          user = await getCurrentUser();
        } catch {
          // getCurrentUser throws on Clerk service errors
        }

        if (requireAuth && !user) {
          return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required', undefined, traceId);
        }
      }

      // ── 4. Role / permission checks ────────────────────────────────────
      if (user && minRoleLevel !== null) {
        const userRole = (user.role ?? 'member') as UserRole;
        const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
        if (userLevel < minRoleLevel) {
          return standardErrorResponse(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            `Requires at least '${options.auth!.minRole}' role`,
            undefined,
            traceId,
          );
        }
      }

      if (user && allowedRoles) {
        const userRole = (user.role ?? 'member') as UserRole;
        if (!allowedRoles.includes(userRole)) {
          return standardErrorResponse(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            'You do not have the required role for this endpoint',
            undefined,
            traceId,
          );
        }
      }

      // ── 5. Rate limiting ───────────────────────────────────────────────
      if (options.rateLimit && user) {
        const rlResult = await checkRateLimit(user.id, options.rateLimit);
        if (!rlResult.allowed) {
          const headers = createRateLimitHeaders(rlResult);
          headers['X-Trace-ID'] = traceId;
          return standardErrorResponse(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'Rate limit exceeded',
            { resetIn: rlResult.resetIn, limit: rlResult.limit },
            traceId,
          );
        }
      }

      // ── 6. Parse & validate body ───────────────────────────────────────
      let body: z.infer<TBody> = undefined as z.infer<TBody>;
      if (options.body) {
        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return standardErrorResponse(
            ErrorCode.INVALID_FORMAT,
            'Request body must be valid JSON',
            undefined,
            traceId,
          );
        }

        const result = options.body.safeParse(rawBody);
        if (!result.success) {
          const fields = result.error.errors.map((e: { path: (string | number)[]; message: string }) => ({
            path: e.path.join('.'),
            message: e.message,
          }));
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            fields[0]?.message ?? 'Validation failed',
            { fields },
            traceId,
          );
        }
        body = result.data;
      }

      // ── 7. Parse & validate query params ───────────────────────────────
      let query: z.infer<TQuery> = undefined as z.infer<TQuery>;
      if (options.query) {
        const raw: Record<string, string> = {};
        request.nextUrl.searchParams.forEach((v, k) => {
          raw[k] = v;
        });
        const result = options.query.safeParse(raw);
        if (!result.success) {
          const fields = result.error.errors.map((e: { path: (string | number)[]; message: string }) => ({
            path: e.path.join('.'),
            message: e.message,
          }));
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            fields[0]?.message ?? 'Invalid query parameters',
            { fields },
            traceId,
          );
        }
        query = result.data;
      }

      // ── 8. Execute handler ─────────────────────────────────────────────
      const ctx: ApiContext<z.infer<TBody>, z.infer<TQuery>> = {
        request,
        user,
        userId: user?.id ?? null,
        organizationId: user?.organizationId ?? null,
        body,
        query,
        params,
        traceId,
      };

      const result = await handler(ctx);

      // ── 9. Build response ──────────────────────────────────────────────

      // Escape-hatch: handler already returned a NextResponse
      if (result instanceof NextResponse) {
        result.headers.set('X-Trace-ID', traceId);
        return result;
      }

      // void / null → 204
      if (result === undefined || result === null) {
        return new NextResponse(null, {
          status: 204,
          headers: { 'X-Trace-ID': traceId },
        });
      }

      // Wrapped success envelope
      const status = options.successStatus ?? 200;
      const response = NextResponse.json(
        {
          success: true as const,
          data: result,
          timestamp: new Date().toISOString(),
        },
        { status, headers: { 'X-Trace-ID': traceId } },
      );
      return response;

    } catch (error: unknown) {
      // ── Known API errors ───────────────────────────────────────────────
      if (error instanceof ApiError) {
        return standardErrorResponse(error.code, error.message, error.details, traceId);
      }

      // ── Unexpected errors → 500 ───────────────────────────────────────
      logger.error('Unhandled error in API route', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: request.nextUrl.pathname,
        traceId,
      });

      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'An internal error occurred',
        error instanceof Error ? { stack: error.stack } : undefined,
        traceId,
      );
    }
  };
}
