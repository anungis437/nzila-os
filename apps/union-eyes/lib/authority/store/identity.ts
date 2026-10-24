/**
 * Authority store — identity and membership binding.
 *
 * Two different identifiers are in play and are never interchangeable:
 *   - an EXTERNAL provider subject (e.g. Entra `tid:oid`), asserted by a token;
 *   - the INTERNAL principal id (`user_management.users.user_id`, varchar(255),
 *     not necessarily a uuid), the only id the kernel and its storage accept.
 * The only way from the first to the second is a pre-provisioned, verified,
 * active row in `public.platform_identity_bindings` whose user is itself active.
 * Nothing is bound by email, by string equality, or at sign-in. This mirrors the
 * canonical resolver in backend/auth_core/canonical_context.py and the
 * `user_management.auth_provider_user()` contract in
 * packages/db/src/auth-storage-authority/bootstrap-sql.ts.
 *
 * Every failure is a refusal. Ambiguity (duplicate rows, duplicate active
 * bindings for one provider) is a refusal, not a tie-break.
 *
 * Deployment prerequisite (NOT installed by this branch): the executor's role
 * must be able to read the canonical identity relations. In the deployed
 * topology the runtime role reaches them through bounded, reviewed reader
 * authority; until that is qualified, these queries fail and the callers deny.
 */
import { capacitiesForRole } from '../capacity'
import type { Membership, MembershipStatus } from '../ontology'
import { AuthorityStoreError, isPrincipalId, isUuid, type SqlExecutor } from './executor'
import type { MembershipSource } from './facts'

export interface ProviderIdentity {
  provider: string
  /** The provider's immutable subject. For Entra: `<tenant>:<object id>`. */
  subject: string
}

export interface PrincipalBinding {
  internalUserId: string
  bindingId: string
  provider: string
  providerSubject: string
  /** Informational only. Platform staff status never contributes to a decision. */
  platformStaff: boolean
}

type Row = Record<string, unknown>

const deny = (message: string): never => {
  throw new AuthorityStoreError('DENIED', message)
}

function assertProviderIdentity(identity: ProviderIdentity): void {
  const { provider, subject } = identity
  if (typeof provider !== 'string' || provider !== provider.toLowerCase().trim() || provider.length === 0 || provider.length > 80) {
    deny('provider identity: malformed provider')
  }
  if (typeof subject !== 'string' || subject.trim() !== subject || subject.length === 0 || subject.length > 512) {
    deny('provider identity: malformed subject')
  }
  if (provider === 'entra') {
    const [tenant, object, ...rest] = subject.split(':')
    if (!tenant || !object || rest.length > 0) deny('provider identity: Entra subjects must be <tenant>:<object id>')
  }
}

/**
 * Provider subject -> internal principal. Exactly one verified, active binding
 * to exactly one active, non-suspended user; otherwise a refusal.
 */
export async function resolveInternalPrincipal(exec: SqlExecutor, identity: ProviderIdentity): Promise<PrincipalBinding> {
  assertProviderIdentity(identity)
  const rows = (
    await exec.query<Row>(
      `SELECT b.id::text AS binding_id, b.platform_user_id, COALESCE(u.is_system_admin, false) AS is_system_admin,
              (SELECT count(*) FROM public.platform_identity_bindings o
                WHERE o.platform_user_id = b.platform_user_id AND o.provider = b.provider
                  AND o.state = 'active' AND o.verified_at IS NOT NULL
                  AND o.disabled_at IS NULL AND o.revoked_at IS NULL) AS active_same_provider
         FROM public.platform_identity_bindings b
         JOIN user_management.users u ON u.user_id = b.platform_user_id
        WHERE b.provider = $1 AND b.provider_subject = $2
          AND b.state = 'active' AND b.verified_at IS NOT NULL AND b.disabled_at IS NULL AND b.revoked_at IS NULL
          AND u.is_active IS TRUE AND u.lifecycle_state = 'active'`,
      [identity.provider, identity.subject],
    )
  ).rows
  if (rows.length !== 1) deny('no single verified active binding to an active user for this provider identity')
  const row = rows[0]
  if (Number(row.active_same_provider) !== 1) {
    deny('user has more than one active binding for this provider; disable the stale binding before authority can be resolved')
  }
  const internalUserId = String(row.platform_user_id)
  if (!isPrincipalId(internalUserId)) deny('bound internal user id is not a valid principal id')
  return {
    internalUserId,
    bindingId: String(row.binding_id),
    provider: identity.provider,
    providerSubject: identity.subject,
    platformStaff: row.is_system_admin === true,
  }
}

function membershipStatus(row: Row): MembershipStatus {
  const lifecycle = String(row.lifecycle_state)
  if (lifecycle === 'suspended') return 'suspended'
  if (lifecycle === 'deprovisioned') return 'revoked'
  if (lifecycle !== 'active' || row.user_active !== true) return 'inactive'
  return row.member_active === true ? 'active' : 'inactive'
}

/**
 * Canonical membership source over user_management.organization_users joined to
 * user_management.users. Returns EVERY row found (including duplicates) so the
 * kernel can fail closed on them. A role maps to eligibility-only capacities.
 */
export const canonicalMembershipSource: MembershipSource = async (exec, organizationId, userIds) => {
  if (!isUuid(organizationId)) return []
  const ids = userIds.filter(isPrincipalId)
  if (ids.length === 0) return []
  const rows = (
    await exec.query<Row>(
      `SELECT m.user_id, m.organization_id::text AS organization_id, m.role, m.is_active AS member_active,
              u.is_active AS user_active, u.lifecycle_state
         FROM user_management.organization_users m
         JOIN user_management.users u ON u.user_id = m.user_id
        WHERE m.organization_id = $1::uuid AND m.user_id = ANY($2::text[])`,
      [organizationId, ids],
    )
  ).rows
  return rows.map(
    (r): Membership => ({
      userId: String(r.user_id),
      organizationId: String(r.organization_id),
      status: membershipStatus(r),
      capacities: capacitiesForRole(r.role as string | null),
      verifiedAt: null,
    }),
  )
}

/**
 * Membership source that reads through a SEPARATE, read-only identity executor.
 *
 * Why: in the deployed schema the runtime role sees only ITS OWN row of
 * user_management.users / organization_users (self-select RLS), and the catalog
 * remediation revokes runtime EXECUTE on SECURITY DEFINER helpers. So deciding anything
 * about ANOTHER principal (an approver, a holder, an assignee) cannot be answered on the
 * runtime connection, and with the plain canonical source it fails closed. The deployed
 * convention for cross-principal identity reads is the bounded `union_eyes_system` role
 * (SELECT-only on exactly these tables); pass an executor connected as that role.
 *
 * The reader must be a pool-style executor (each query on its own connection): it is
 * never part of the authority transaction and must not be shared with a transaction.
 * It only ever runs the fixed canonical SELECT, scoped to the explicit organization.
 */
export function membershipSourceVia(reader: SqlExecutor): MembershipSource {
  return (_transaction, organizationId, userIds) => canonicalMembershipSource(reader, organizationId, userIds)
}

export interface AuthorityPrincipal {
  binding: PrincipalBinding
  organizationId: string
  membership: Membership
}

/**
 * Provider identity + the organization the caller is acting in -> a verified
 * principal with exactly one active membership in exactly that organization.
 * There is no "primary organization" fallback: the organization is always
 * explicit, and a session bound to a different organization is a mismatch.
 */
export async function resolveAuthorityPrincipal(
  exec: SqlExecutor,
  input: ProviderIdentity & { organizationId: string; sessionOrganizationId?: string | null },
): Promise<AuthorityPrincipal> {
  if (!isUuid(input.organizationId)) deny('an explicit organization uuid is required')
  if (input.sessionOrganizationId && input.sessionOrganizationId.toLowerCase() !== input.organizationId.toLowerCase()) {
    deny('session organization does not match the requested organization')
  }
  const binding = await resolveInternalPrincipal(exec, input)
  const memberships = (await canonicalMembershipSource(exec, input.organizationId, [binding.internalUserId])).filter(
    (m) => m.userId === binding.internalUserId,
  )
  if (memberships.length !== 1) deny(memberships.length === 0 ? 'no membership in this organization' : 'duplicate membership rows')
  const membership = memberships[0]
  if (membership.status !== 'active') deny(`membership is ${membership.status}`)
  return { binding, organizationId: input.organizationId, membership }
}

/** Organizations in which the internal principal currently holds an active membership. */
export async function listActiveOrganizations(exec: SqlExecutor, internalUserId: string): Promise<string[]> {
  if (!isPrincipalId(internalUserId)) return []
  const rows = (
    await exec.query<Row>(
      `SELECT m.organization_id::text AS organization_id
         FROM user_management.organization_users m
         JOIN user_management.users u ON u.user_id = m.user_id
        WHERE m.user_id = $1 AND m.is_active IS TRUE AND u.is_active IS TRUE AND u.lifecycle_state = 'active'
        ORDER BY m.organization_id`,
      [internalUserId],
    )
  ).rows
  return rows.map((r) => String(r.organization_id))
}
