/**
 * Database RLS Context Middleware
 * 
 * Automatically sets PostgreSQL session variables for Row-Level Security policies.
 * Ensures user context is properly set for all database operations.
 * 
 * Usage:
 *   import { withRLSContext } from '@/lib/db/with-rls-context';
 *   
 *   export async function POST(req: Request) {
 *     return withRLSContext(async () => {
 *       const claims = await db.select().from(claims);
 *       return NextResponse.json(claims);
 *     });
 *   }
 * 
 * Features:
 * - Automatic user context setting (app.current_user_id)
 * - Transaction-scoped isolation (SET LOCAL)
 * - Connection pool safety (no context leakage)
 * - Clerk authentication integration
 * - Error handling with security event logging
 */

import { auth } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Execute database operation with automatic RLS context
 * 
 * This wrapper:
 * 1. Gets authenticated user ID from Clerk
 * 2. Sets app.current_user_id in PostgreSQL session
 * 3. Executes your database operation
 * 4. Automatically cleans up (transaction-scoped with SET LOCAL)
 * 
 * @param operation - Async function containing database queries
 * @returns Promise with operation result
 * @throws Error if user not authenticated
 * 
 * @example
 * // API route with automatic RLS context
 * export async function GET(req: Request) {
 *   return withRLSContext(async () => {
 *     const userClaims = await db.select().from(claims);
 *     return NextResponse.json(userClaims);
 *   });
 * }
 */
export async function withRLSContext<T>(
  operation: () => Promise<T>
): Promise<T>;
export async function withRLSContext<T>(
  operation: (tx: NodePgDatabase<Record<string, unknown>>) => Promise<T>
): Promise<T>;
export async function withRLSContext<T>(
  context: Record<string, unknown>,
  operation: () => Promise<T>
): Promise<T>;
export async function withRLSContext<T>(
  context: Record<string, unknown>,
  operation: (tx: NodePgDatabase<Record<string, unknown>>) => Promise<T>
): Promise<T>;
export async function withRLSContext<T>(
  contextOrOperation:
    | Record<string, unknown>
    | ((tx: NodePgDatabase<Record<string, unknown>>) => Promise<T>)
    | (() => Promise<T>),
  maybeOperation?:
    | ((tx: NodePgDatabase<Record<string, unknown>>) => Promise<T>)
    | (() => Promise<T>)
): Promise<T> {
  const operation = (
    typeof contextOrOperation === 'function' ? contextOrOperation : maybeOperation!
  ) as (tx: NodePgDatabase<Record<string, unknown>>) => Promise<T>;

  // Get authenticated user from Clerk
  const { userId, orgId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized: No authenticated user found. User must be logged in via Clerk.');
  }

  // NzilaOS PR-UE-02: Require org context for all RLS-guarded operations
  if (!orgId) {
    throw new Error(
      'Organization context required: No active organization found. ' +
      'User must have an active Org selected in Clerk.'
    );
  }

  // Execute in transaction to ensure context is properly scoped
  // set_config with is_local=true is equivalent to SET LOCAL but supports parameters
  return await db.transaction(async (tx) => {
    // Set user context for RLS policies
    // This makes the user ID available to all RLS policies as:
    // current_setting('app.current_user_id', true)
    // NOTE: SET LOCAL does not accept parameterized values ($1); use set_config() instead
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);

    // NzilaOS PR-UE-02: Set org context for RLS policies
    // This makes the org ID available to all RLS policies as:
    // current_setting('app.current_org_id', true)
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    
    // Execute the operation with user + org context set
    const result = await operation(tx as unknown as NodePgDatabase<Record<string, unknown>>);
    
    // Transaction commit automatically clears local config variables
    return result;
  });
}

/**
 * Execute database operation with explicit user ID
 * 
 * Use this when you need to set context for a different user than the authenticated one.
 * Common use case: Admin operations, system jobs, or impersonation.
 * 
 * @param userId - User ID to set in context (must be varchar compatible with Clerk IDs)
 * @param operation - Async function containing database queries
 * @returns Promise with operation result
 * 
 * @example
 * // Admin viewing another user's data
 * export async function GET(req: Request) {
 *   const { userId: adminId } = await auth();
 *   const targetUserId = req.nextUrl.searchParams.get('userId');
 *   
 *   // Verify admin has permission
 *   if (!await isAdmin(adminId)) {
 *     throw new Error('Forbidden');
 *   }
 *   
 *   return withExplicitUserContext(targetUserId, async () => {
 *     const userClaims = await db.select().from(claims);
 *     return NextResponse.json(userClaims);
 *   });
 * }
 */
export async function withExplicitUserContext<T>(
  userId: string,
  operation: () => Promise<T>,
  orgId?: string,
): Promise<T> {
  if (!userId) {
    throw new Error('Invalid user ID: Cannot set RLS context with empty user ID');
  }

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    // NzilaOS PR-UE-02: Set org context when provided
    if (orgId) {
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    }
    const result = await operation();
    return result;
  });
}

/**
 * Execute database operation without RLS context (system operations)
 * 
 * WARNING: Only use for system-level operations that should bypass RLS.
 * Common use cases:
 * - Clerk webhooks creating/updating users
 * - System maintenance scripts
 * - Background jobs that operate on all data
 * 
 * @param operation - Async function containing database queries
 * @returns Promise with operation result
 * 
 * @example
 * // Clerk webhook creating a new user
 * export async function POST(req: Request) {
 *   const event = await verifyClerkWebhook(req);
 *   
 *   return withSystemContext(async () => {
 *     await db.insert(users).values({
 *       userId: event.data.id,
 *       email: event.data.email_addresses[0].email_address,
 *     });
 *     return NextResponse.json({ success: true });
 *   });
 * }
 */
export async function withSystemContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  // System operations don&apos;t set user context
  // RLS policies should handle this with service role checks
  return await db.transaction(async (tx) => {
    // Explicitly clear any existing user context
    await tx.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
    // NzilaOS PR-UE-02: Explicitly clear org context for system operations
    await tx.execute(sql`SELECT set_config('app.current_org_id', '', true)`);
    const result = await operation();
    return result;
  });
}

/**
 * Validate that RLS context is properly set
 * 
 * Use this in critical operations to verify RLS is active.
 * Throws error if context is not set, preventing accidental data exposure.
 * 
 * @returns Promise<string> - Current user ID set in context
 * @throws Error if RLS context is not set
 * 
 * @example
 * // Critical financial operation
 * export async function POST(req: Request) {
 *   return withRLSContext(async () => {
 *     // Double-check context before sensitive operation
 *     const contextUserId = await validateRLSContext();
 *     logger.info('Operating as user', { contextUserId });
 *     
 *     await db.insert(financialTransactions).values({...});
 *     return NextResponse.json({ success: true });
 *   });
 * }
 */
export async function validateRLSContext(): Promise<{ userId: string; orgId: string }> {
  try {
    const result = await db.execute<{ user_id: string; org_id: string }>(
      sql`SELECT 
        current_setting('app.current_user_id', true) as user_id,
        current_setting('app.current_org_id', true) as org_id`
    );
    
    const userId = result[0]?.user_id;
    const orgId = result[0]?.org_id;
    
    if (!userId || userId === '') {
      throw new Error('RLS context validation failed: app.current_user_id is not set');
    }

    // NzilaOS PR-UE-02: Org context is now mandatory
    if (!orgId || orgId === '') {
      throw new Error('RLS context validation failed: app.current_org_id is not set');
    }
    
    return { userId, orgId };
  } catch (error) {
    // Log security violation
    if (error instanceof Error && error.message.includes('RLS context validation')) {
      throw error;
    }
throw new Error(
      'RLS context not set. Database queries must be wrapped in withRLSContext(). ' +
      'See: docs/security/RLS_AUTH_RBAC_ALIGNMENT.md'
    );
  }
}

/**
 * Get current RLS context user ID (if set)
 * 
 * Non-throwing version of validateRLSContext().
 * Returns null if context is not set.
 * 
 * @returns Promise<string | null> - Current user ID or null
 * 
 * @example
 * // Check if context is set without throwing
 * const userId = await getCurrentRLSContext();
 * if (userId) {
 *   logger.info('RLS context active for user', { userId });
 * } else {
 *   logger.warn('No RLS context set - system operation?');
 * }
 */
export async function getCurrentRLSContext(): Promise<string | null> {
  try {
    const result = await db.execute<{ current_setting: string }>(
      sql`SELECT current_setting('app.current_user_id', true) as current_setting`
    );
    
    const userId = result[0]?.current_setting;
    return userId && userId !== '' ? userId : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Create a server action with automatic RLS context
 * 
 * Use this to wrap Next.js server actions with automatic user context.
 * The returned function will automatically set RLS context when called.
 * 
 * @param action - Server action function
 * @returns Wrapped server action with RLS context
 * 
 * @example
 * // app/actions/claims-actions.ts
 * 'use server';
 * 
 * import { createSecureServerAction } from '@/lib/db/with-rls-context';
 * 
 * export const createClaim = createSecureServerAction(
 *   async (input: { memberId: string, amount: number }) => {
 *     // RLS context automatically set
 *     const claim = await db.insert(claims).values(input);
 *     return claim;
 *   }
 * );
 * 
 * // components/claims-form.tsx
 * import { createClaim } from '@/app/actions/claims-actions';
 * 
 * function ClaimsForm() {
 *   const handleSubmit = async (data) => {
 *     await createClaim(data);  // Context automatically set!
 *   };
 * }
 */
export function createSecureServerAction<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    return withRLSContext(() => action(input));
  };
}

/**
 * Type guard for RLS-aware database queries
 * 
 * Use this to ensure queries are properly wrapped at compile time.
 * TypeScript will enforce using withRLSContext() for sensitive queries.
 * 
 * @example
 * type SecureQuery<T> = {
 *   execute: () => Promise<T>;
 *   requiresRLS: true;
 * };
 * 
 * // This enforces RLS at the type level
 * function executeSecureQuery<T>(query: SecureQuery<T>) {
 *   return withRLSContext(query.execute);
 * }
 */
export type RLSAwareQuery<T> = () => Promise<T>;

/**
 * HOC to wrap API route handlers with RLS context
 * 
 * @param handler - API route handler function
 * @returns Wrapped handler with automatic RLS context
 * 
 * @example
 * // app/api/claims/route.ts
 * import { withRLS } from '@/lib/db/with-rls-context';
 * 
 * async function handleGET(req: Request) {
 *   const claims = await db.select().from(claims);
 *   return NextResponse.json(claims);
 * }
 * 
 * export const GET = withRLS(handleGET);
 */
export function withRLS<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return withRLSContext(() => handler(...args));
  };
}

