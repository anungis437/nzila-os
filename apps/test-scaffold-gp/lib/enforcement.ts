/**
 * Enforcement pipeline configuration for test-scaffold-gp.
 *
 * This file configures the @nzila/enforcement pipeline layers
 * for this app. Import and use `enforcedHandler` in API routes.
 */
import {
  composePipeline,
  traceLayer,
  authLayer,
  rateLimitLayer,
  governanceLayer,
  auditLayer,
  type EnforcementContext,
} from '@nzila/enforcement'

/**
 * Create the enforcement pipeline for this app.
 * Customize the layer callbacks for your auth provider, rate limiter, etc.
 */
export function createAppPipeline() {
  return composePipeline([
    traceLayer(),
    authLayer({
      extractActor: async (headers) => {
        // TODO: Replace with your auth provider (e.g., Clerk, NextAuth)
        const token = headers.authorization?.replace('Bearer ', '')
        if (!token) return null
        return {
          actorId: 'placeholder-user',
          orgId: 'placeholder-org',
          roles: ['member'],
        }
      },
    }),
    rateLimitLayer({
      check: async (_orgId, _route) => {
        // TODO: Wire to your rate limiter (Redis, in-memory, etc.)
        return { allowed: true, remaining: 100, resetAt: Date.now() + 60000 }
      },
    }),
    governanceLayer({
      evaluate: async (_ctx) => {
        // TODO: Wire to @nzila/governance canAccess()
        return { outcome: 'allow' as const, reason: 'default-allow' }
      },
    }),
    auditLayer({
      record: async (_entry) => {
        // TODO: Wire to @nzila/audit appendEntry()
        return
      },
    }),
  ])
}

/**
 * Example: wrap an API route handler with enforcement.
 */
export function enforced(
  handler: (ctx: EnforcementContext) => Promise<{ success: boolean; status: number; body?: unknown }>
) {
  const pipeline = createAppPipeline()
  return async (ctx: EnforcementContext) => {
    // Pipeline runs all layers, then the handler as the terminal
    // For real use, prefer createEnforcedHandler() from @nzila/enforcement
    void handler
    return pipeline(ctx)
  }
}
