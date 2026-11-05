/**
 * Test-only stand-in for the `withApi` wrapper, for route unit tests that exercise a handler in isolation (the database and the services are mocked).
 *
 * It does what a handler's tests depend on the wrapper for:
 *   - the handler receives the resolved caller (`userId`, `organizationId`, `params`) from `caller`, which a test sets;
 *   - a route that requires authentication answers 401 when the test sets `caller.userId` to null, as the wrapper does for an unauthenticated request;
 *   - the role floor and the organization requirement the route declares are enforced against that caller, answering as the wrapper does;
 *   - an error the handler throws is answered as the wrapper answers it (ApiError -> its status, anything else -> 500);
 *   - the options each route declared are recorded in `declared`, so a test can state what a route asks of the wrapper: its role floor, its
 *     entitlement and whether it runs in a tenant transaction.
 * A test that needs the real wrapper imports it instead; the native route tests do (see db/__tests__/native-route-harness.ts).
 */
import { ApiError } from '@/lib/api/errors';
import { zUUID } from '@/lib/api/schemas';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { z } from 'zod';

export interface DeclaredOptions {
  auth?: { required?: boolean; minRole?: string; roles?: string[]; cron?: boolean };
  entitlement?: string;
  rlsOrgContext?: boolean;
  requireOrg?: boolean;
  registry?: { audience?: string; orgScoping?: string };
  openapi?: { tags?: string[]; summary?: string };
  /** The Zod schemas the route declares: the stub validates with them as the wrapper does, and hands the handler the parsed value. */
  body?: z.ZodType;
  query?: z.ZodType;
}

export const caller: { userId: string | null; organizationId: string | null; role: string; params: Record<string, string> } = {
  userId: 'u1',
  organizationId: 'org_1',
  role: 'admin',
  params: {},
};

/** The options every route loaded in this test file declared, in load order. */
export const declared: DeclaredOptions[] = [];

/**
 * The entitlement guard the wrapper consults for a route's declared `entitlement`: `requireEntitlement(organizationId, module, userId)`, whose rejection the
 * wrapper answers 403 before anything else runs. A test that needs an organization without the module sets `require` (to its own mock of the guard);
 * unset, every module is held.
 */
export const entitlementGuard: { require?: (organizationId: string, module: string, userId: string) => Promise<unknown> } = {};

export function resetCaller(): void {
  caller.userId = 'u1';
  caller.organizationId = 'org_1';
  caller.role = 'admin';
  caller.params = {};
  entitlementGuard.require = undefined;
}

// The rank of each role the route tests use; the application's own table is ROLE_HIERARCHY in lib/api-auth-guard. `content_manager` and `platform_lead` are
// platform roles, above every tenant role (and above system_admin, here as there).
const RANK: Record<string, number> = { member: 20, steward: 60, officer: 80, admin: 140, system_admin: 150, content_manager: 208, platform_lead: 270 };
const rankOf = (role: string | undefined) => (role ? RANK[role] ?? 0 : 0);

const fieldsOf = (error: z.ZodError) => error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }));

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function withApiStub<TContext extends Record<string, unknown>>(
  options: DeclaredOptions,
  handler: (context: TContext & { request: Request; user: { id: string; role: string } | null; userId: string | null; organizationId: string | null; params: Record<string, string>; body: unknown; query: unknown; traceId: string; machine: unknown }) => unknown,
) {
  declared.push(options);
  return async (request: Request, nextContext?: { params?: Record<string, string> | Promise<Record<string, string>> }) => {
    const params = nextContext?.params ? await nextContext.params : caller.params;
    if (options.auth?.required !== false && !options.auth?.cron && !caller.userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    const floor = options.auth?.minRole;
    if (floor && rankOf(caller.role) < rankOf(floor)) {
      return standardErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, `Requires at least '${floor}' role`);
    }
    if (options.auth?.required !== false && options.requireOrg !== false && !caller.organizationId) {
      return standardErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, 'Organization context required — select an organization before accessing this resource');
    }
    if (options.entitlement && caller.organizationId && caller.userId && entitlementGuard.require) {
      try {
        await entitlementGuard.require(caller.organizationId, options.entitlement, caller.userId);
      } catch {
        return standardErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, `Module access denied: ${options.entitlement}`, { module: options.entitlement });
      }
    }

    // As the wrapper does: a declared body schema is read and validated before the handler runs; without one the JSON the caller sent is passed on, unread by the stub.
    let body: unknown;
    if (options.body) {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return standardErrorResponse(ErrorCode.INVALID_FORMAT, 'Request body must be valid JSON');
      }
      const result = options.body.safeParse(raw);
      if (!result.success) {
        const fields = fieldsOf(result.error);
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, fields[0]?.message ?? 'Validation failed', { fields });
      }
      body = result.data;
    } else if (BODY_METHODS.has(request.method.toUpperCase())) {
      body = await request.clone().json().catch(() => undefined);
    }
    let query: unknown;
    if (options.query) {
      const result = options.query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
      if (!result.success) {
        const fields = fieldsOf(result.error);
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, fields[0]?.message ?? 'Invalid query parameters', { fields });
      }
      query = result.data;
    }

    try {
      const result = await handler({
        request,
        user: caller.userId ? { id: caller.userId, role: caller.role } : null,
        userId: caller.userId,
        organizationId: caller.organizationId,
        params,
        body,
        query,
        traceId: 'trace-test',
        machine: undefined,
      } as never);
      return result;
    } catch (error) {
      if (error instanceof ApiError) return standardErrorResponse(error.code, error.message, error.details);
      const name = (error as { name?: string } | null)?.name;
      if (name === 'SyntaxError') return standardErrorResponse(ErrorCode.INVALID_FORMAT, 'Request body must be valid JSON');
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'An internal error occurred');
    }
  };
}

/** What `vi.mock('@/lib/api/framework', ...)` should return for a route that imports from the framework barrel. */
export const frameworkModule = { withApi: withApiStub, ApiError, ErrorCode, zUUID, z };
