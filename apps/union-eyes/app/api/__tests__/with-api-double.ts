/**
 * A stand-in for `withApi` in route unit tests.
 *
 * It hands the handler the context the framework builds (`request`, `user`, `userId`, `organizationId`, `params`, `body`, `query`) and keeps the options the
 * route declared on the returned handler (`route.options`), so a test can state what a route asks of the wrapper: its role floor, its entitlement, whether it
 * runs in a tenant transaction. It also applies the two things the framework does with those options that a handler's own tests read: the validated query
 * and the entitlement check (the entitlement guard the test mocked is the one consulted, and a refusal is a 403).
 *
 * Authentication, the role floor and the tenant transaction themselves are the framework's and are not run here. Native route tests run the routes on real
 * PostgreSQL as the real roles (db/__tests__/native-route-harness.ts). A contract test that holds every migrated route to the authorization it had before is
 * still to be written (lib/api/__tests__/deprecated-wrapper-migration.contract.test.ts); until then each route's unit test states its floor with `declaredOptions`.
 *
 *   vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble)
 */
import { ApiError, ErrorCode } from '@/lib/api/errors'
import { z } from 'zod'

export interface DoubleContext {
  userId?: string | null
  organizationId?: string | null
  role?: string
  params?: Record<string, string>
}

interface DoubleOptions {
  auth?: { required?: boolean; minRole?: string; roles?: string[]; cron?: boolean }
  requireOrg?: boolean
  rlsOrgContext?: boolean
  entitlement?: string
  body?: z.ZodTypeAny
  query?: z.ZodTypeAny
  rateLimit?: unknown
  registry?: { audience?: string; productionStatus?: string; evidenceRequired?: boolean; orgScoping?: string }
  openapi?: { tags?: string[]; summary?: string }
  successStatus?: number
}

export const DEFAULT_CONTEXT: DoubleContext = { userId: 'u1', organizationId: 'org_1', role: 'steward' }

/** Every set of options a route declared, in order: a route that wraps a private handler (an export, say) is read through this. */
export const declaredList: DoubleOptions[] = []

// The identity of the handler being run: a handler that calls another wrapped handler (the framework would authenticate that call again, from the
// same request) hands it no identity, and it inherits this one.
let active: DoubleContext | null = null

const refusal = (code: string, status: number, message: string, details?: unknown) =>
  new Response(JSON.stringify({ code, message, ...(details ? { details } : {}) }), { status, headers: { 'content-type': 'application/json' } })

type Handler = (context: Record<string, unknown>) => unknown

export function withApiDouble(options: DoubleOptions, handler: Handler) {
  declaredList.push(options)
  const route = async (request: Request & { nextUrl?: URL }, routeContext: DoubleContext = DEFAULT_CONTEXT, ...rest: unknown[]) => {
    const userId = routeContext.userId !== undefined ? routeContext.userId : (active?.userId ?? null)
    const organizationId = (routeContext.organizationId !== undefined ? routeContext.organizationId : active?.organizationId) || null
    const role = routeContext.role ?? active?.role
    const user = userId ? { id: userId, role: role ?? 'steward', organizationId, email: 'user@example.test' } : null

    if (options.entitlement && organizationId && userId) {
      const { requireEntitlement } = await import('@/services/platform-economics/entitlement-guard')
      try {
        await requireEntitlement(organizationId, options.entitlement, userId)
      } catch {
        return refusal(ErrorCode.INSUFFICIENT_PERMISSIONS, 403, `Module access denied: ${options.entitlement}`, { module: options.entitlement })
      }
    }

    let body: unknown
    if (options.body) {
      let raw: unknown
      try {
        raw = await request.clone().json()
      } catch {
        return refusal(ErrorCode.INVALID_FORMAT, 400, 'Request body must be valid JSON')
      }
      const parsed = options.body.safeParse(raw)
      if (!parsed.success) return refusal(ErrorCode.VALIDATION_ERROR, 400, parsed.error.issues[0]?.message ?? 'Validation failed')
      body = parsed.data
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        body = await request.clone().json()
      } catch {
        body = undefined
      }
    }

    let query: unknown
    if (options.query) {
      const url = request.nextUrl ?? new URL(request.url)
      const raw: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        raw[key] = value
      })
      const parsed = options.query.safeParse(raw)
      if (!parsed.success) return refusal(ErrorCode.VALIDATION_ERROR, 400, parsed.error.issues[0]?.message ?? 'Invalid query parameters')
      query = parsed.data
    }

    const params = routeContext.params ?? {}
    const outer = active
    active = { userId, organizationId, role, params }
    try {
      return await handler({
        request,
        user,
        userId,
        organizationId,
        params,
        body,
        query,
        traceId: 'trace-test',
        machine: undefined,
        rest,
      })
    } catch (error) {
      if (error instanceof ApiError) return refusal(error.code, ({ AUTH_REQUIRED: 401, FORBIDDEN: 403, INSUFFICIENT_PERMISSIONS: 403, NOT_FOUND: 404, CONFLICT: 409, VALIDATION_ERROR: 400, RATE_LIMIT_EXCEEDED: 429 } as Record<string, number>)[error.code] ?? 500, error.message)
      throw error
    } finally {
      active = outer
    }
  }
  route.options = options
  return route
}

/** The module the routes import `@/lib/api/framework` as. */
export const frameworkDouble = { withApi: withApiDouble, ApiError, ErrorCode, z }

/** The options a loaded route declared for one of its handlers. */
export const declaredOptions = (route: unknown): DoubleOptions => (route as { options: DoubleOptions }).options
