import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { appendCanonicalAuditLog } from '../../lib/audit/canonical-audit-chain'
import { encryptSecret } from '../../../../packages/platform-auth/src/mfa/encryption'
import {
  buildOtpAuthUri,
  generateTotpSecret,
} from '../../../../packages/platform-auth/src/mfa/totp'
import {
  hashPassword,
  validatePassword,
} from '../../../../packages/platform-auth/src/password/password'

/**
 * One-time first-administrator bootstrap for a new Union Eyes V2 database.
 *
 * Operator-run only (see docs/union-eyes/production/RUNBOOK_FIRST_ADMIN_BOOTSTRAP.md). There is no
 * HTTP surface, no default identity or password, and no standing bypass: every input is supplied by
 * the owner, the whole operation is one transaction under an advisory lock, and it is audited in the
 * canonical hash chain.
 *
 * Outcomes:
 *   CREATED               the administrator was established (organization, user, membership, MFA, audit)
 *   ALREADY_ESTABLISHED   the same administrator was already established by a previous run; nothing changed
 *   throws                anything else, including any pre-existing administrator; nothing changed
 */
export interface FirstAdminInput {
  userId: string
  email: string
  password: string
  organizationId: string
  /** Provide both to create the organization when it does not exist; omit to require an existing one. */
  organizationName?: string
  organizationSlug?: string
  role: 'admin' | 'executive'
  platformAdmin: boolean
  operator: string
}

export type BootstrapDb = {
  transaction<T>(fn: (tx: BootstrapTx) => Promise<T>): Promise<T>
}
export type BootstrapTx = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>
}

export class FirstAdminError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'ADMIN_ALREADY_EXISTS'
      | 'BOOTSTRAP_BY_ANOTHER_IDENTITY'
      | 'ORGANIZATION_NOT_FOUND',
    message: string,
  ) {
    super(message)
    this.name = 'FirstAdminError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The bootstrap marker is the audit action itself: it survives restores and cannot be bypassed by
// deleting an application table row without also breaking the audit chain.
export const BOOTSTRAP_ACTION = 'bootstrap.first_admin'
const ADMIN_ROLES = ['admin', 'executive', 'super_admin', 'platform_admin']

export function validateFirstAdminInput(input: FirstAdminInput): void {
  const fail = (message: string): never => {
    throw new FirstAdminError('INVALID_INPUT', message)
  }
  if (!input.userId || input.userId.length > 255 || /\s/.test(input.userId))
    fail('userId must be a non-empty identifier of at most 255 characters without whitespace')
  if (!EMAIL.test(input.email) || input.email.length > 255) fail('email is not valid')
  if (!UUID.test(input.organizationId)) fail('organizationId must be a UUID')
  if ((input.organizationName === undefined) !== (input.organizationSlug === undefined))
    fail('organizationName and organizationSlug must be provided together')
  if (input.organizationSlug !== undefined && !SLUG.test(input.organizationSlug))
    fail('organizationSlug must be lowercase letters, digits and hyphens')
  if (input.organizationName !== undefined && !input.organizationName.trim())
    fail('organizationName must not be empty')
  if (!['admin', 'executive'].includes(input.role)) fail('role must be admin or executive')
  if (!input.operator || input.operator.length > 200) fail('operator identity is required')
  const password = validatePassword(input.password ?? '')
  if (!password.valid) fail(`password rejected: ${password.errors.join('; ')}`)
}

const rows = <T>(result: unknown) => result as T[]

export async function bootstrapFirstAdmin(db: BootstrapDb, input: FirstAdminInput) {
  validateFirstAdminInput(input)
  const passwordHash = await hashPassword(input.password)
  const totpSecret = generateTotpSecret()
  const encryptedTotp = encryptSecret(totpSecret)

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('ue_first_admin_bootstrap', 0))`,
    )

    const marker = rows<{ organization_id: string; user_id: string; resource_id: string | null }>(
      await tx.execute(
        sql`SELECT organization_id::text AS organization_id, user_id, resource_id
            FROM public.audit_logs WHERE action = ${BOOTSTRAP_ACTION}
            ORDER BY created_at ASC LIMIT 1`,
      ),
    )[0]
    if (marker) {
      if (marker.resource_id === input.userId && marker.organization_id === input.organizationId)
        return { result: 'ALREADY_ESTABLISHED' as const }
      throw new FirstAdminError(
        'BOOTSTRAP_BY_ANOTHER_IDENTITY',
        'The first administrator was already established for a different identity or organization; refusing',
      )
    }

    // Any administrator that exists without the marker means this is not a fresh database.
    const existing = rows<{ n: number }>(
      await tx.execute(
        sql`SELECT (
              (SELECT count(*) FROM user_management.users WHERE is_system_admin IS TRUE) +
              (SELECT count(*) FROM user_management.organization_users
                WHERE role = ANY(${sql.raw(`ARRAY[${ADMIN_ROLES.map((r) => `'${r}'`).join(',')}]::text[]`)}))
            )::int AS n`,
      ),
    )[0]
    if ((existing?.n ?? 0) > 0)
      throw new FirstAdminError(
        'ADMIN_ALREADY_EXISTS',
        'An administrator already exists in this database; this bootstrap is for a fresh database only',
      )

    const organization = rows<{ id: string }>(
      await tx.execute(
        sql`SELECT id::text AS id FROM public.organizations WHERE id = ${input.organizationId}::uuid`,
      ),
    )[0]
    let createdOrganization = false
    if (!organization) {
      if (input.organizationName === undefined)
        throw new FirstAdminError(
          'ORGANIZATION_NOT_FOUND',
          'The organization does not exist; provide organizationName and organizationSlug to create it',
        )
      await tx.execute(
        sql`INSERT INTO public.organizations
              (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated,
               member_count, active_member_count, settings, features_enabled, status, remittance_day,
               created_at, updated_at)
            VALUES (${input.organizationId}::uuid, ${input.organizationName!.trim()}, ${input.organizationSlug},
              'local', ARRAY[]::text[], 0, ARRAY[]::varchar[], false, 0, 0, '{}', ARRAY[]::text[],
              'active', 15, now(), now())`,
      )
      createdOrganization = true
    }

    await tx.execute(
      sql`INSERT INTO user_management.users
            (user_id, email, password_hash, is_active, lifecycle_state, is_system_admin, email_verified)
          VALUES (${input.userId}, ${input.email}, ${passwordHash}, true, 'active', ${input.platformAdmin}, true)`,
    )
    await tx.execute(
      sql`INSERT INTO user_management.organization_users
            (user_id, organization_id, role, is_primary, is_active, joined_at)
          VALUES (${input.userId}, ${input.organizationId}::uuid, ${input.role}, true, true, now())`,
    )
    // MFA is enrolled at creation so the administrator can never sign in with a password alone.
    await tx.execute(
      sql`INSERT INTO user_management.mfa_totp (user_id, secret_encrypted, enabled_at)
          VALUES (${input.userId}, ${encryptedTotp}, now())`,
    )

    await appendCanonicalAuditLog(tx as never, {
      organizationId: input.organizationId,
      action: BOOTSTRAP_ACTION,
      resourceType: 'user',
      resourceId: input.userId,
      userId: `operator:${input.operator}`,
      details: {
        role: input.role,
        platformAdmin: input.platformAdmin,
        createdOrganization,
        mfaEnrolled: true,
        emailSha256: createHash('sha256').update(input.email.toLowerCase()).digest('hex'),
      },
    })

    return {
      result: 'CREATED' as const,
      organizationId: input.organizationId,
      userId: input.userId,
      createdOrganization,
      // Shown once; it is not stored in plaintext anywhere and cannot be recovered.
      totpProvisioningUri: buildOtpAuthUri(totpSecret, input.email, 'Union Eyes'),
    }
  })
}
