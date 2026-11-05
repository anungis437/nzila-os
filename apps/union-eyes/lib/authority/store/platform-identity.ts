/**
 * Authority store — platform identity integration.
 *
 * Where each identity fact lives (source-of-truth register, 2026-10):
 *   provider subject -> principal : `public.platform_identity_bindings` in the application database
 *       (packages/db/src/schema/platform-authorization.ts; migration 0041, PLATFORM_IDENTITY_CURRENT in the
 *       Union Eyes v2 plan). It is a dedicated-execution-context relation: no business role (runtime or
 *       legacy system) holds any privilege on it. The ONLY reader is `nzila_auth_provider_reader`, through
 *       `user_management.auth_provider_binding()` executed by `nzila_auth_provider`.
 *   principal                     : `user_management.users.user_id` (varchar, not necessarily a uuid).
 *   membership + role             : `user_management.organization_users` (a compatibility projection owned by
 *       the auth layer; read by the runtime only through reader-owned SECURITY DEFINER functions that require
 *       a LIVE session in the selected organization).
 *   session                       : `user_management.user_sessions` (raw bearer hashed inside the database).
 *
 * Therefore this kernel does not resolve identity. It consumes the binding the supported resolver produced
 * (`AuthenticatedOrgBinding`), validates it, and runs authority transactions with the actor, organization and
 * session taken from that binding and nowhere else.
 */
import type { MembershipSource } from './facts'
import { AuthorityStoreError, isPrincipalId, isUuid, runAuthorityTransaction, type SqlExecutor } from './executor'
import { mapMembershipRows } from './identity'

/** Structural subset of `AuthenticatedOrgBinding` (packages/platform-auth/src/org-binding.ts). */
export interface VerifiedOrgBinding {
  readonly userId: string
  readonly organizationId: string
  readonly role?: string
  /** Server-held bearer. Never serialize, log or expose. */
  readonly sessionToken: string
  readonly expiresAt: Date
  readonly authority: 'pg-session' | 'verified-provider-bridge'
}

const refuse = (message: string): never => {
  throw new AuthorityStoreError('DENIED', message)
}

/** Fails closed on anything the supported resolver should never hand over. */
export function assertVerifiedBinding(binding: VerifiedOrgBinding, now: Date = new Date()): void {
  if (!binding || typeof binding !== 'object') refuse('no authenticated binding')
  if (!isPrincipalId(binding.userId)) refuse('binding: the principal is not a valid internal principal id')
  if (!isUuid(binding.organizationId)) refuse('binding: the organization is not a canonical organization uuid')
  if (typeof binding.sessionToken !== 'string' || binding.sessionToken.length === 0) refuse('binding: no session authority')
  if (!(binding.expiresAt instanceof Date) || Number.isNaN(binding.expiresAt.getTime()) || binding.expiresAt.getTime() <= now.getTime()) {
    refuse('binding: the session has expired')
  }
  if (binding.authority !== 'pg-session' && binding.authority !== 'verified-provider-bridge') {
    refuse('binding: unsupported authority source')
  }
}

/**
 * Runs an authority transaction whose principal, tenant and session come ONLY from the verified binding. There is
 * deliberately no overload taking a separate user or organization: a caller cannot act as someone else, or in
 * another tenant, than the binding names.
 */
export async function runBoundAuthorityTransaction<T>(
  connection: SqlExecutor,
  binding: VerifiedOrgBinding,
  fn: (tx: SqlExecutor) => Promise<T>,
  now: Date = new Date(),
): Promise<T> {
  assertVerifiedBinding(binding, now)
  return runAuthorityTransaction(
    connection,
    { organizationId: binding.organizationId, userId: binding.userId, sessionToken: binding.sessionToken },
    fn,
  )
}

/** Shape of `user_management.auth_provider_binding()` / `ExternalIdentityBinding` after resolution. */
export interface ResolvedProviderBinding {
  readonly id: string
  readonly provider: string
  readonly providerSubject: string
  readonly platformUserId: string
  readonly state: string
  readonly verifiedAt: Date | string
  readonly principal?: { readonly id: string; readonly state: string }
}

export type ExternalIdentityResolver = (provider: string, providerSubject: string) => Promise<ResolvedProviderBinding | null>

/**
 * Provider claims (already credential-verified by the gateway) -> internal principal id, through the supported
 * resolver. The result is re-validated here so a mis-implemented or substituted resolver still cannot widen
 * access: the echoed provider and subject must equal the claim, the binding must be active and verified, and the
 * principal must be active.
 */
export async function resolveProviderPrincipal(
  resolveExternalIdentity: ExternalIdentityResolver,
  claims: { provider: string; subject: string },
): Promise<{ internalUserId: string; bindingId: string }> {
  const { provider, subject } = claims
  if (typeof provider !== 'string' || provider.length === 0 || provider.length > 80 || provider !== provider.trim().toLowerCase()) {
    refuse('provider identity: malformed provider')
  }
  if (typeof subject !== 'string' || subject.length === 0 || subject.length > 512 || subject !== subject.trim()) {
    refuse('provider identity: malformed subject')
  }
  if (provider === 'entra') {
    const [tenant, object, ...rest] = subject.split(':')
    if (!tenant || !object || rest.length > 0) refuse('provider identity: Entra subjects must be <tenant>:<object id>')
  }
  const resolved = await resolveExternalIdentity(provider, subject)
  if (!resolved) return refuse('no active, verified binding for this provider identity')
  if (resolved.provider !== provider || resolved.providerSubject !== subject) refuse('provider identity: the resolver answered for a different identity')
  if (resolved.state !== 'active') refuse('provider identity: the binding is not active')
  const verified = resolved.verifiedAt instanceof Date ? resolved.verifiedAt : new Date(String(resolved.verifiedAt))
  if (Number.isNaN(verified.getTime())) refuse('provider identity: the binding is not verified')
  if (!isPrincipalId(resolved.platformUserId)) refuse('provider identity: the bound principal id is not valid')
  if (resolved.principal && (resolved.principal.state !== 'active' || resolved.principal.id !== resolved.platformUserId)) {
    refuse('provider identity: the bound principal is not active')
  }
  return { internalUserId: resolved.platformUserId, bindingId: String(resolved.id) }
}

/**
 * Cross-principal membership facts under the deployed (v2) topology, read on the SAME runtime connection and
 * transaction as the decision, through the reader-owned definer function installed by
 * `compileAuthorityMembershipReaderSql()`. The function itself requires a live session in the selected
 * organization, so it cannot answer for another tenant, an expired session or an inactive actor.
 */
export const membershipSourceViaDefiner: MembershipSource = async (exec, organizationId, userIds) => {
  if (!isUuid(organizationId)) return []
  const ids = userIds.filter(isPrincipalId)
  if (ids.length === 0) return []
  const rows = (
    await exec.query<Record<string, unknown>>(
      `SELECT user_id, organization_id::text AS organization_id, role, member_active, user_active, lifecycle_state
         FROM user_management.ue_authority_membership_rows($1::uuid, $2::text[])`,
      [organizationId, ids],
    )
  ).rows
  return mapMembershipRows(rows.map((r) => ({ ...r, member_active: r.member_active, user_active: r.user_active })))
}

/**
 * SQL for the reader-owned membership function. It belongs with the other auth-owned SECURITY DEFINER predicates
 * (packages/db/src/auth-storage-authority/org-session-authority.ts) and must be adopted by their owner; it is
 * exported as a compiler so it can be reviewed and executed in the same pass as `compileAuthBootstrapSql()`.
 *
 * It adds no table privilege to any role: the reader's existing column grants and org-scoped RLS policies
 * (users: user_id,is_active,lifecycle_state; organization_users: user_id,organization_id,role,is_active) are
 * exactly the columns used, and the function answers only when the caller's live session authorises the
 * requested organization.
 */
export function compileAuthorityMembershipReaderSql(options: { ordinaryRole?: string; readerRole?: string } = {}): string {
  const ordinary = options.ordinaryRole ?? 'union_eyes_runtime'
  const reader = options.readerRole ?? 'nzila_auth_org_authority_reader'
  const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
  return `
    GRANT CREATE ON SCHEMA user_management TO ${q(reader)};
    CREATE FUNCTION user_management.ue_authority_membership_rows(p_org uuid, p_users text[])
    RETURNS TABLE (user_id text, organization_id uuid, role text, member_active boolean, user_active boolean, lifecycle_state text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT m.user_id::text, m.organization_id, m.role::text, m.is_active, u.is_active, u.lifecycle_state::text
        FROM user_management.organization_users m
        JOIN user_management.users u ON u.user_id = m.user_id
       WHERE user_management.auth_business_org_authorized(p_org, NULL::text[])
         AND m.organization_id = p_org
         AND m.user_id = ANY (p_users)
    $auth$;
    ALTER FUNCTION user_management.ue_authority_membership_rows(uuid, text[]) OWNER TO ${q(reader)};
    REVOKE ALL ON FUNCTION user_management.ue_authority_membership_rows(uuid, text[]) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION user_management.ue_authority_membership_rows(uuid, text[]) TO ${q(ordinary)};
    REVOKE CREATE ON SCHEMA user_management FROM ${q(reader)};
  `
}
