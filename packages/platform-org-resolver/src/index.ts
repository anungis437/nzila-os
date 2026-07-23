/**
 * @nzila/platform-org-resolver — Phase 0B.2 §11
 *
 * The single, fail-closed resolver that maps a request context to the
 * canonical *platform tenant id*.
 *
 * Under Option D (governed hybrid, see
 * `reports/audits/cupe-national-phase-0/phase-0b2/phase-0b2-architecture-approval.md`)
 * every organisation is represented by TWO rows that share the same UUID:
 *
 *   - `public.orgs.id`                         (platform side, DDL owner: Drizzle)
 *   - `union_eyes.organizations.id`            (UE side, DDL owner: Django)
 *   - `union_eyes.organizations.platform_tenant_id = union_eyes.organizations.id`
 *     is enforced by CHECK constraint in
 *     `packages/db/drizzle/0038_organization_cross_schema_contract.sql`.
 *
 * Consequences for callers:
 *
 *   1. There is exactly one UUID that identifies a tenant across schemas.
 *   2. Passing a UE `organizations.id` to a platform-side foundational path
 *      is safe *only* through this resolver, because the resolver verifies
 *      the row exists on both sides.
 *   3. If no tenant context can be resolved, the resolver throws
 *      `OrgContextRequiredError` — callers MUST fail closed and MUST NOT
 *      fall back to a default org in production.
 *
 * Foundational paths (the ONLY paths that call this resolver during
 * Phase 0B.2) are enumerated in `./foundational-paths.ts`.
 */

/**
 * A platform tenant id. Same UUID for `public.orgs.id` and
 * `union_eyes.organizations.id` under the Option D contract.
 */
export type PlatformTenantId = string & { readonly __brand: 'PlatformTenantId' };

/**
 * Minimal shape of a request context passed to the resolver. Concrete
 * callers (Next.js middleware, Django DRF views, background jobs) each
 * translate their own request into this shape.
 */
export interface OrgContext {
  /** The authenticated user id (opaque string; may be a Clerk id, Entra oid, or DB uuid). */
  readonly userId?: string | null;
  /** Explicit tenant id passed by trusted callers (e.g. background jobs). */
  readonly explicitOrgId?: string | null;
  /** Whether the caller is running in production. Used to gate the default-org fallback. */
  readonly isProduction: boolean;
  /** Env override permitting default-org fallback (never allowed in production). */
  readonly allowDefaultOrg?: boolean;
}

/**
 * Verifier contract. Injected so the resolver can be unit-tested without
 * a live database. The production wiring queries
 * `union_eyes.organizations` with the CHECK invariant enforced.
 */
export interface TenantVerifier {
  /**
   * Return the platform tenant id for the given orgId iff the row exists in
   * union_eyes.organizations AND platform_tenant_id = id. Return `null`
   * if the row does not exist or violates the invariant.
   */
  verifyOrg(orgId: string): Promise<string | null>;
}

/**
 * Fail-closed error thrown when a foundational path cannot resolve a
 * tenant. Callers MUST propagate this and MUST NOT swallow it.
 */
export class OrgContextRequiredError extends Error {
  readonly code = 'ORG_CONTEXT_REQUIRED';
  constructor(message: string) {
    super(message);
    this.name = 'OrgContextRequiredError';
  }
}

/**
 * Error thrown when a caller passes a tenant id that fails the Option D
 * contract invariant (`platform_tenant_id = id`) or that references a
 * non-existent row.
 */
export class OrgContractViolationError extends Error {
  readonly code = 'ORG_CONTRACT_VIOLATION';
  constructor(message: string) {
    super(message);
    this.name = 'OrgContractViolationError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(candidate: unknown): candidate is string {
  return typeof candidate === 'string' && UUID_RE.test(candidate);
}

/**
 * Resolve the platform tenant id for the given context. Fail-closed:
 * throws `OrgContextRequiredError` if no verifiable tenant is available.
 *
 * The resolver does NOT read cookies, headers, or session state — those
 * live in caller-specific adapters that translate their inputs into an
 * `OrgContext` object.
 */
export async function resolvePlatformTenantId(
  context: OrgContext,
  verifier: TenantVerifier,
): Promise<PlatformTenantId> {
  const candidate = context.explicitOrgId ?? null;

  if (!candidate) {
    throw new OrgContextRequiredError(
      'No tenant id supplied. Foundational paths must resolve a tenant before ' +
        'calling the resolver (see phase-0b2-foundational-slice.md §3).',
    );
  }

  if (!isUuid(candidate)) {
    throw new OrgContractViolationError(
      `Supplied tenant id is not a UUID: ${candidate}`,
    );
  }

  const verified = await verifier.verifyOrg(candidate);

  if (verified === null) {
    throw new OrgContractViolationError(
      `Tenant id ${candidate} not present in union_eyes.organizations or ` +
        'violates the Option D CHECK constraint (platform_tenant_id = id).',
    );
  }

  if (verified !== candidate) {
    throw new OrgContractViolationError(
      `Tenant id verifier returned ${verified} for candidate ${candidate}: ` +
        'this indicates a broken CHECK constraint in migration 0038.',
    );
  }

  return verified as PlatformTenantId;
}

/**
 * Cast a bare string into a `PlatformTenantId` after successful resolution.
 * Kept for callers that need the branded type but obtained the UUID via a
 * trusted-path (e.g. seeded background job with a well-known org id).
 */
export function assertPlatformTenantId(candidate: string): PlatformTenantId {
  if (!isUuid(candidate)) {
    throw new OrgContractViolationError(
      `Candidate is not a UUID: ${candidate}`,
    );
  }
  return candidate as PlatformTenantId;
}
