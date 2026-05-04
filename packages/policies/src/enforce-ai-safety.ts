/**
 * OWASP AI Testing Guide — AI Safety Enforcement
 *
 * `enforceAISafety` is a synchronous pre-flight guard that must be called at the
 * start of every AI route handler, AFTER authentication but BEFORE any model call.
 * It throws `AISafetyViolationError` with a structured code so the caller can
 * return a standardised 403/400 response without leaking internal details.
 */

import type { AISurfaceDataClass, AISurfaceOrigin } from './ai-safety-policy.js';

export { AISurfaceDataClass, AISurfaceOrigin };

// ─── Violation error ────────────────────────────────────────────────────────

export class AISafetyViolationError extends Error {
  readonly code: AISafetyViolationCode;
  readonly origin: AISurfaceOrigin;

  constructor(code: AISafetyViolationCode, origin: AISurfaceOrigin, detail?: string) {
    super(`AI safety violation [${code}] on surface '${origin}'${detail ? `: ${detail}` : ''}`);
    this.name = 'AISafetyViolationError';
    this.code = code;
    this.origin = origin;
  }
}

export type AISafetyViolationCode =
  | 'MISSING_USER_ID'
  | 'MISSING_ORG_ID'
  | 'CROSS_ORG_ACCESS'
  | 'MUTATION_ATTEMPTED'
  | 'DATA_CLASS_NOT_ALLOWED';

// ─── Context ────────────────────────────────────────────────────────────────

export interface AISafetyContext {
  /** Which AI surface is being invoked — used in violation messages and audit events */
  origin: AISurfaceOrigin;

  /** A short human-readable label for the specific action (e.g. 'search', 'summarize') */
  action: string;

  /**
   * The caller's organization ID, resolved via auth context.
   * Must be the app-level org UUID — never an Entra AD group GUID.
   */
  organizationId: string | null | undefined;

  /** The authenticated caller's user ID */
  userId: string | null | undefined;

  /** The caller's minimum role (e.g. 'member', 'steward', 'admin') */
  userRole: string;

  /** Data sensitivity class for the records being processed */
  dataClass: AISurfaceDataClass;

  /**
   * When the AI surface resolves data owned by a specific entity, provide that
   * entity's orgId here. `enforceAISafety` will check it does not differ from
   * the caller's `organizationId`.
   */
  requestedEntityOrgId?: string | null;

  /**
   * Set to `true` ONLY if the route explicitly needs to write/mutate records
   * as part of the AI surface (which violates AI_SAFETY_POLICY.allowMutation).
   * Leaving this undefined or `false` permits read-only access.
   * Passing `true` will always throw MUTATION_ATTEMPTED.
   */
  canMutate?: boolean;
}

// ─── Enforcement ────────────────────────────────────────────────────────────

/**
 * Synchronous pre-flight safety check for every AI surface.
 *
 * Throws `AISafetyViolationError` if any invariant is violated.
 * Returns `void` when all checks pass — the caller may proceed to the model.
 *
 * @example
 * ```ts
 * enforceAISafety({
 *   origin: 'search',
 *   action: 'ai-search',
 *   organizationId: context.organizationId,
 *   userId: context.userId,
 *   userRole: context.userRole ?? 'member',
 *   dataClass: 'internal',
 * });
 * ```
 */
export function enforceAISafety(ctx: AISafetyContext): void {
  const { origin, organizationId, userId, requestedEntityOrgId, canMutate } = ctx;

  // LLM07 / OWASP-API1: Unauthenticated AI access is never permitted
  if (!userId) {
    throw new AISafetyViolationError('MISSING_USER_ID', origin, 'userId is required for all AI surfaces');
  }

  // OWASP-API3: AI surfaces must always be scoped to an organization
  if (!organizationId) {
    throw new AISafetyViolationError('MISSING_ORG_ID', origin, 'organizationId is required for all AI surfaces');
  }

  // OWASP-API1 / LLM02: Cross-org data leakage prevention
  if (
    requestedEntityOrgId != null &&
    requestedEntityOrgId !== '' &&
    requestedEntityOrgId !== organizationId
  ) {
    throw new AISafetyViolationError(
      'CROSS_ORG_ACCESS',
      origin,
      `caller org '${organizationId}' may not access entity owned by org '${requestedEntityOrgId}'`,
    );
  }

  // LLM08 / Core constraint: AI surfaces are read-only — mutations via AI are prohibited
  if (canMutate === true) {
    throw new AISafetyViolationError(
      'MUTATION_ATTEMPTED',
      origin,
      'AI surfaces must never perform direct mutations (AI_SAFETY_POLICY.allowMutation = false)',
    );
  }
}
