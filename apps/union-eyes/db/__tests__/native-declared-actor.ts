/**
 * Declared fixture actors for native tests on the canonical combined database.
 *
 * The canonical topology admits a runtime statement only inside a verified business session: an active canonical user, an active
 * membership in the row's organization and a live session the production auth gateway issued (ue_v2_verified_business_session, a
 * RESTRICTIVE policy on every tenant table). A test that acts "as organization X" therefore needs a real member of X to act as.
 *
 * seedDeclaredCanonicalActor is the operator seed of ONE such actor, exactly as an accepted invitation leaves it: an active user and an
 * active membership with the declared role. It never grants a database role, a privilege, a session, a case relationship or a mandate;
 * the session is still opened by the production auth gateway (withNativeCanonicalActor) and re-read by the policies on every statement.
 * An actor nobody declared has no canonical row and is refused, as production refuses it.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export interface OperatorQuery { query: (text: string, params?: unknown[]) => Promise<unknown> }

/**
 * `systemAdmin` declares platform staff: canonical V2 admits an elevated platform role (platform_lead and above) only for a user whose
 * canonical record says is_system_admin (lib/auth/canonical-membership-role.ts); an ordinary membership carrying such a role is refused
 * (ROLE_REQUIRED). The flag is written once, when the user is first declared.
 */
export async function seedDeclaredCanonicalActor(operator: OperatorQuery, userId: string, organizationId: string, role: string,
  options: { systemAdmin?: boolean } = {}): Promise<void> {
  assert.ok(userId && organizationId && role, 'A declared actor needs a user, an organization and a role')
  await operator.query(`INSERT INTO user_management.users (user_id, email, is_active, lifecycle_state, is_system_admin)
    VALUES ($1, $2, true, 'active', $3) ON CONFLICT (user_id) DO NOTHING`,
  [userId, `native-actor-${createHash('sha256').update(userId).digest('hex').slice(0, 24)}@example.test`, options.systemAdmin === true])
  await operator.query(`INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active) VALUES ($1, $2, $3, true)
    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = true`, [organizationId, userId, role])
}

/** The conventional declared reader of one organization, for a test that reads or writes "as organization X" with no named caller. */
export const nativeTenantReaderId = (organizationId: string, role = 'member') => `native-${role}-${organizationId.slice(0, 8)}`

/**
 * What the production binder answers before it issues a session bridge (packages/platform-auth/src/org-binding.ts withResolvedOrgBinding):
 * no active canonical user, or no active membership in the organization, is MEMBERSHIP_REQUIRED. A fixture opening a request for someone
 * with neither refuses the same way, instead of failing later on the session row the auth gateway would never have been asked to write.
 */
export async function requireLiveCanonicalMembership(operator: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  userId: string, organizationId: string): Promise<void> {
  const live = await operator.query(`SELECT 1 FROM user_management.users u JOIN user_management.organization_users m ON m.user_id = u.user_id
    WHERE u.user_id = $1 AND u.is_active AND u.lifecycle_state = 'active' AND m.organization_id = $2::uuid AND m.is_active`, [userId, organizationId])
  if (!live.rows.length) {
    const { AuthOrgBindingError } = await import('../../../../packages/platform-auth/src/org-binding')
    throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  }
}
