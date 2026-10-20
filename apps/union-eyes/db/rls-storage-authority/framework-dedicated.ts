/**
 * Restored Django framework, platform-metadata, and legacy public identity
 * relations. Owners and dedicated privileges come from
 * scripts/bootstrap-v2/framework-contract.ts. union_eyes_runtime does not
 * receive these tables. public.users is not user_management.users.
 */
import type { RuntimeOperation, StorageAuthorityEntry } from './types'
import {
  FRAMEWORK_ADMIN_PRIVILEGES,
  FRAMEWORK_IDENTITY_PRIVILEGES,
  FRAMEWORK_IDENTITY_UPDATE_COLUMNS,
  FRAMEWORK_LEDGER_OWNERS,
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_ROLES,
  PLATFORM_METADATA_MODEL_OWNERS,
} from '../../scripts/bootstrap-v2/framework-contract'

const adminPrivileges = [...FRAMEWORK_ADMIN_PRIVILEGES] as RuntimeOperation[]

/** Identity UPDATE is limited to these columns. It is a column grant, never a table grant. */
const identityUpdateColumns: Record<string, readonly string[]> = {
  auth_user: FRAMEWORK_IDENTITY_UPDATE_COLUMNS,
}

function dedicated(
  table: string,
  owner: string,
  classification: StorageAuthorityEntry['classification'],
  reason: string,
  roles: StorageAuthorityEntry['frameworkRolePrivileges'],
  invocation: StorageAuthorityEntry['invocationAuthority'],
  columnGrants?: StorageAuthorityEntry['frameworkColumnGrants'],
): StorageAuthorityEntry {
  return {
    table,
    classification,
    reason: `${reason} Canonical owner: ${owner}.`,
    supportingCapability: [owner, 'scripts/bootstrap-v2/framework-contract.ts'],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: invocation,
    dbExecutionPrincipal: 'NONE',
    reviewPriority: 'NONE',
    scopeDisposition: 'DECLARATION_STALE_OR_NONCANONICAL',
    frameworkRolePrivileges: roles,
    ...(columnGrants?.length ? { frameworkColumnGrants: columnGrants } : {}),
  }
}

function frameworkRoles(table: string): NonNullable<StorageAuthorityEntry['frameworkRolePrivileges']> {
  const roles: { role: string; privileges: readonly RuntimeOperation[] }[] = [
    { role: FRAMEWORK_ROLES.admin, privileges: adminPrivileges },
  ]
  const identity = FRAMEWORK_IDENTITY_PRIVILEGES[table]
  if (identity?.length) {
    const tablePrivileges = identity.filter((privilege) => !(privilege === 'UPDATE' && table in identityUpdateColumns))
    roles.push({ role: FRAMEWORK_ROLES.identity, privileges: tablePrivileges as RuntimeOperation[] })
  }
  if (table.startsWith('django_celery_')) {
    roles.push({ role: FRAMEWORK_ROLES.worker, privileges: adminPrivileges })
  }
  return roles
}

function frameworkColumnGrants(table: string): StorageAuthorityEntry['frameworkColumnGrants'] {
  const columns = identityUpdateColumns[table]
  return columns ? [{ role: FRAMEWORK_ROLES.identity, privilege: 'UPDATE', columns: [...columns] }] : undefined
}

const frameworkOwners = { ...FRAMEWORK_MODEL_OWNERS, ...FRAMEWORK_LEDGER_OWNERS }

export const frameworkDedicatedEntries: StorageAuthorityEntry[] = [
  ...Object.entries(frameworkOwners).map(([table, owner]) =>
    dedicated(
      table,
      owner,
      'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT',
      table.startsWith('django_celery_')
        ? 'Active Celery beat or result relation. Worker execution uses ue_framework_worker. Ordinary tenant runtime is not a principal.'
        : table === 'django_migrations'
          ? 'Active Django migration recorder. Administrator execution only. A recorded hash is not a substitute for this grant.'
          : 'Active Django framework relation. Identity and administrator roles are the principals. This is not latent and not union_eyes_runtime authority.',
      frameworkRoles(table),
      table.startsWith('django_celery_') ? 'WORKER' : 'PLATFORM_ADMIN',
      frameworkColumnGrants(table),
    ),
  ),
  dedicated(
    'failed_login_attempts',
    PLATFORM_METADATA_MODEL_OWNERS.failed_login_attempts,
    'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT',
    'Global authentication-failure metadata. No organization_id, org_id, or user_id column in the canonical model. Administrator context only.',
    [{ role: FRAMEWORK_ROLES.admin, privileges: adminPrivileges }],
    'PLATFORM_ADMIN',
  ),
  dedicated(
    'rate_limit_events',
    PLATFORM_METADATA_MODEL_OWNERS.rate_limit_events,
    'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT',
    'Global rate-limit metadata. No organization_id, org_id, or user_id column in the canonical model. Administrator context only.',
    [{ role: FRAMEWORK_ROLES.admin, privileges: adminPrivileges }],
    'PLATFORM_ADMIN',
  ),
  {
    table: 'users',
    classification: 'USER_RLS_REQUIRED',
    reason:
      'public.users is the legacy Django auth_core.Users relation (varchar user_id). It is not canonical identity. Canonical identity remains user_management.users. Self-ownership is the actor user_id. NULL ownership is denied. No system DML is inferred.',
    supportingCapability: [
      'backend/auth_core/models.py',
      'backend/auth_core/views.py',
      'scripts/bootstrap-v2/current-authority.ts',
    ],
    requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredSystemPrivileges: [],
    invocationAuthority: 'TENANT_USER',
    dbExecutionPrincipal: 'TENANT_RUNTIME',
    reviewPriority: 'NONE',
    scopeDisposition: 'DECLARATION_STALE_OR_NONCANONICAL',
  },
  {
    table: 'oauth_providers',
    classification: 'USER_RLS_REQUIRED',
    reason:
      'public.oauth_providers is the legacy Django auth_core.OauthProviders relation (varchar user_id). It is not user_management provider-binding authority. Self-ownership is the actor user_id.',
    supportingCapability: [
      'backend/auth_core/models.py',
      'backend/auth_core/views.py',
      'scripts/bootstrap-v2/current-authority.ts',
    ],
    requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    requiredSystemPrivileges: [],
    invocationAuthority: 'TENANT_USER',
    dbExecutionPrincipal: 'TENANT_RUNTIME',
    reviewPriority: 'NONE',
    scopeDisposition: 'DECLARATION_STALE_OR_NONCANONICAL',
  },
  {
    table: 'evidence_artifacts',
    classification: 'PARENT_OWNED_RLS_REQUIRED',
    reason:
      'evidence_artifacts has no organization column. Visibility is the parent evidence_packs row through pack_id. The parent tenant key is evidence_packs.org_id. Runtime may select and insert under that parent. System may select.',
    supportingCapability: [
      'backend/services/evidence_pack/models.py',
      'backend/services/evidence_pack/views.py',
      'scripts/bootstrap-v2/current-authority.ts',
    ],
    requiredRuntimePrivileges: ['SELECT', 'INSERT'],
    requiredSystemPrivileges: ['SELECT'],
    invocationAuthority: 'MIXED',
    dbExecutionPrincipal: 'MIXED',
    reviewPriority: 'NONE',
    scopeDisposition: 'DECLARATION_STALE_OR_NONCANONICAL',
  },
]
