/**
 * API Security Utilities
 * 
 * High-level utilities for applying security checks to API route handlers.
 * These wrappers integrate environment validation, SQL injection prevention,
 * input validation, and authentication checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/api-auth-guard';
import { validateEnvironment } from '@/lib/config/env-validation';
import { SQLInjectionScanner } from '@/lib/middleware/sql-injection-prevention';
import { AuthenticationService, SUPPORTED_ROLES } from '@/lib/middleware/auth-middleware';
import { db } from '@/db';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { organizationUsers } from '@/db/schema/domains/member';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Re-export for convenience
export { SQLInjectionScanner } from '@/lib/middleware/sql-injection-prevention';

/**
 * API Route Handler Type
 */
type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

/**
 * API Route Handler with User Context
 */
type ApiHandlerWithAuth = (
  request: NextRequest,
  user: { id: string; organizationId?: string; role?: string; roles?: string[] },
  context?: { params?: Record<string, string> }
) => Promise<NextResponse>;

function resolveOrganizationIdFromRequest(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  const cookieOrganizationId = request.cookies.get('selected_organization_id')?.value;
  const cookieTenantId = request.cookies.get('selected_tenant_id')?.value;
  return (
    searchParams.get('organizationId') ||
    searchParams.get('orgId') ||
    request.headers.get('x-organization-id') ||
    request.headers.get('x-org-id') ||
    cookieOrganizationId ||
    cookieTenantId ||
    request.headers.get('x-tenant-id') ||
    searchParams.get('tenantId') ||
    null
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRole(role: string): string {
  if (role === 'super_admin') {
    return SUPPORTED_ROLES.ADMIN;
  }

  if (role === 'steward') {
    return SUPPORTED_ROLES.MEMBER;
  }

  return role;
}

async function resolveDbRoles(userId: string, organizationId: string): Promise<string[]> {
  if (!isUuid(organizationId)) {
    return [];
  }

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (member?.role) {
    return [normalizeRole(member.role)];
  }

  const [OrganizationUser] = await db
    .select({ role: organizationUsers.role })
    .from(organizationUsers)
    .where(and(eq(organizationUsers.userId, userId), eq(organizationUsers.organizationId, organizationId)))
    .limit(1);

  if (OrganizationUser?.role) {
    return [normalizeRole(OrganizationUser.role)];
  }

  return [];
}

/**
 * High-level wrapper for routes with basic security checks:
 * - Environment validation
 * - SQL injection detection on request
 * - Basic authentication
 * - Error handling and logging
 */
export function withSecureAPI(handler: ApiHandlerWithAuth): ApiHandler {
  return async (request: NextRequest, context) => {
    try {
      // Ensure environment is validated
      const envValidation = validateEnvironment();
      if (!envValidation.isValid) {
        logger.error('Environment validation failed at startup', {
          errors: envValidation.errors,
        });
        return NextResponse.json(
          { error: 'Internal server configuration error' },
          { status: 500 }
        );
      }

      // Get authenticated user
      const authResult = await auth();
      const userId = authResult.userId;
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required' },
          { status: 401 }
        );
      }

      const authData = authResult as unknown as Record<string, unknown>;
      const sessionOrganizationId = (authData?.orgId || authData?.organizationId) as string | undefined;

      // Check for SQL injection patterns in request
      const bodyText = await request.clone().text();
      const sqlCheckResult = SQLInjectionScanner.scanRequest(
        bodyText ? JSON.parse(bodyText) : {},
        Object.fromEntries(new URL(request.url).searchParams)
      );

      if (!sqlCheckResult.isSafe) {
        logger.warn('SQL injection pattern detected', {
          userId,
          patterns: sqlCheckResult.detectedPatterns,
          severity: sqlCheckResult.severity,
          endpoint: request.nextUrl.pathname,
        });

        return NextResponse.json(
          { error: 'Request validation failed' },
          { status: 400 }
        );
      }

      const currentUser = await AuthenticationService.getCurrentUser();
      const requestOrganizationId = resolveOrganizationIdFromRequest(request);
      const organizationId =
        currentUser?.organizationId || sessionOrganizationId || requestOrganizationId || undefined;
      let roles = currentUser?.roles || [];

      if (!roles.length && organizationId) {
        roles = await resolveDbRoles(userId, organizationId);
      }

      const role = roles[0];

      // Call handler with authenticated user
      return await handler(
        request,
        { id: userId, organizationId, role, roles },
        context
      );
    } catch (error) {
      logger.error('API handler error', {
        error: error instanceof Error ? error.message : error,
        path: request.nextUrl.pathname,
        method: request.method,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrapper for routes that require specific role
 * - All checks from withSecureAPI
 * - Role-based access control
 * 
 * Note: Role retrieval should be implemented in your actual handler
 * This is a placeholder showing the pattern
 */
export function withRoleRequired(
  requiredRole: string,
  handler: ApiHandlerWithAuth
): ApiHandler {
  return withSecureAPI(async (request, user, context) => {
    const roles = user.roles || (user.role ? [user.role] : []);
    const hasRole = roles.includes(requiredRole);
    if (!hasRole) {
      logger.warn('Role-required access denied', {
        userId: user.id,
        requiredRole,
        roles,
        endpoint: request.nextUrl.pathname,
      });

      return NextResponse.json(
        { error: `Forbidden - ${requiredRole} role required` },
        { status: 403 }
      );
    }

    logger.debug('Role-required route access attempt', {
      userId: user.id,
      requiredRole,
      endpoint: request.nextUrl.pathname,
    });

    return handler(request, user, context);
  });
}

/**
 * Wrapper for routes that require request body validation
 * - All checks from withSecureAPI
 * - Request body validation against Zod schema
 */
export function withValidatedBody(
  schema: z.ZodSchema,
  handler: (
    request: NextRequest,
    user: { id: string; organizationId?: string; role?: string },
    body: unknown,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse>
): ApiHandler {
  return withSecureAPI(async (request, user, context) => {
    try {
      const body = await request.json();

      // Validate against schema
      const parseResult = schema.safeParse(body);
      if (!parseResult.success) {
        logger.warn('Request validation failed', {
          userId: user.id,
          errors: parseResult.error.flatten(),
          endpoint: request.nextUrl.pathname,
        });

        return NextResponse.json(
          {
            error: 'Invalid request body',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      return handler(request, user, parseResult.data, context);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
      throw error;
    }
  });
}

/**
 * Wrapper for routes that require query parameter validation
 * - All checks from withSecureAPI
 * - Query parameter validation against Zod schema
 */
export function withValidatedQuery(
  schema: z.ZodSchema,
  handler: (
    request: NextRequest,
    user: { id: string; organizationId?: string; role?: string },
    query: unknown,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse>
): ApiHandler {
  return withSecureAPI(async (request, user, context) => {
    try {
      const { searchParams } = new URL(request.url);
      const queryObj = Object.fromEntries(searchParams);

      // Validate against schema
      const parseResult = schema.safeParse(queryObj);
      if (!parseResult.success) {
        logger.warn('Query validation failed', {
          userId: user.id,
          errors: parseResult.error.flatten(),
          endpoint: request.nextUrl.pathname,
        });

        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      return handler(request, user, parseResult.data, context);
    } catch (error) {
      throw error;
    }
  });
}

/**
 * Wrapper for routes that require both body and query validation
 */
export function withValidatedRequest(
  bodySchema: z.ZodSchema | null,
  querySchema: z.ZodSchema | null,
  handler: (
    request: NextRequest,
    user: { id: string; organizationId?: string; role?: string },
    data: { body?: unknown; query?: unknown },
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse>
): ApiHandler {
  return withSecureAPI(async (request, user, context) => {
    try {
      const data: { body?: unknown; query?: unknown } = {};

      // Validate body if schema provided
      if (bodySchema) {
        const body = await request.json();
        const bodyResult = bodySchema.safeParse(body);
        if (!bodyResult.success) {
          logger.warn('Request body validation failed', {
            userId: user.id,
            errors: bodyResult.error.flatten(),
            endpoint: request.nextUrl.pathname,
          });

          return NextResponse.json(
            {
              error: 'Invalid request body',
              details: bodyResult.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }
        data.body = bodyResult.data;
      }

      // Validate query if schema provided
      if (querySchema) {
        const { searchParams } = new URL(request.url);
        const queryObj = Object.fromEntries(searchParams);
        const queryResult = querySchema.safeParse(queryObj);
        if (!queryResult.success) {
          logger.warn('Query validation failed', {
            userId: user.id,
            errors: queryResult.error.flatten(),
            endpoint: request.nextUrl.pathname,
          });

          return NextResponse.json(
            {
              error: 'Invalid query parameters',
              details: queryResult.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }
        data.query = queryResult.data;
      }

      return handler(request, user, data, context);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
      throw error;
    }
  });
}

/**
 * Wrapper for admin-only routes
 * Combines role checking with all other security checks
 */
export function withAdminOnly(handler: ApiHandlerWithAuth): ApiHandler {
  return withSecureAPI(async (request, user, context) => {
    const roles = user.roles || (user.role ? [user.role] : []);
    if (!roles.includes(SUPPORTED_ROLES.ADMIN)) {
      logger.warn('Admin access denied', {
        userId: user.id,
        roles,
        endpoint: request.nextUrl.pathname,
      });

      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    logger.debug('Admin route access attempt', {
      userId: user.id,
      endpoint: request.nextUrl.pathname,
    });

    return handler(request, user, context);
  });
}

/**
 * Export public stats or health checks without auth requirement
 */
export function withPublicAPI(handler: (request: NextRequest) => Promise<NextResponse>): ApiHandler {
  return async (request: NextRequest) => {
    try {
      // Ensure environment is validated
      const envValidation = validateEnvironment();
      if (!envValidation.isValid) {
        logger.error('Environment validation failed', {
          errors: envValidation.errors,
        });
        return NextResponse.json(
          { error: 'Internal server configuration error' },
          { status: 500 }
        );
      }

      // Check for SQL injection patterns
      const bodyText = await request.clone().text();
      const sqlCheckResult = SQLInjectionScanner.scanRequest(
        bodyText ? JSON.parse(bodyText) : {},
        Object.fromEntries(new URL(request.url).searchParams)
      );

      if (!sqlCheckResult.isSafe) {
        logger.warn('SQL injection pattern detected in public route', {
          patterns: sqlCheckResult.detectedPatterns,
          severity: sqlCheckResult.severity,
          endpoint: request.nextUrl.pathname,
        });

        return NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        );
      }

      return handler(request);
    } catch (error) {
      logger.error('Public API handler error', {
        error: error instanceof Error ? error.message : error,
        path: request.nextUrl.pathname,
        method: request.method,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Audit event for tracking API security events
 */
export interface ApiAuditEvent {
  timestamp: string;
  userId?: string;
  endpoint: string;
  method: string;
  eventType:
    | 'auth_failed'
    | 'validation_failed'
    | 'sql_injection_attempt'
    | 'unauthorized_access'
    | 'success';
  details?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Audit logger for API security events
 */
export function logApiAuditEvent(event: ApiAuditEvent): void {
  logger.info('API_SECURITY_AUDIT', {
    timestamp: event.timestamp,
    userId: event.userId,
    endpoint: event.endpoint,
    method: event.method,
    eventType: event.eventType,
    severity: event.severity,
    details: event.details,
  });
}

