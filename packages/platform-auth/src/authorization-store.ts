import { and, eq } from 'drizzle-orm'
import { db } from '@nzila/db/client'
import {
  authUsers,
  orgs,
  platformApplicationPermissionGrants,
  platformIdentityBindings,
  platformOrganizationMemberships,
} from '@nzila/db/schema'
import type {
  ApplicationPermissionGrant,
  AuthorizationAuthorityStore,
  ExternalIdentityBinding,
  IdentityBindingState,
  OrganizationMembership,
  PermissionGrantState,
  PlatformMembershipState,
} from './authorization-context'

function identityState(value: string): IdentityBindingState {
  if (value === 'active' || value === 'disabled' || value === 'revoked') return value
  throw new Error(`Unknown platform identity binding state: ${value}`)
}

function membershipState(value: string): PlatformMembershipState {
  if (value === 'active' || value === 'invited' || value === 'suspended' || value === 'revoked') {
    return value
  }
  throw new Error(`Unknown platform organization membership state: ${value}`)
}

function grantState(value: string): PermissionGrantState {
  if (value === 'active' || value === 'revoked') return value
  throw new Error(`Unknown platform permission grant state: ${value}`)
}

export const platformAuthorizationStore: AuthorizationAuthorityStore = {
  async findIdentityBinding(provider, providerSubject) {
    const [row] = await db
      .select({
        id: platformIdentityBindings.id,
        provider: platformIdentityBindings.provider,
        providerSubject: platformIdentityBindings.providerSubject,
        platformUserId: platformIdentityBindings.platformUserId,
        state: platformIdentityBindings.state,
        verifiedAt: platformIdentityBindings.verifiedAt,
        principalId: authUsers.userId,
        isActive: authUsers.isActive,
        lifecycleState: authUsers.lifecycleState,
      })
      .from(platformIdentityBindings)
      .innerJoin(authUsers, eq(platformIdentityBindings.platformUserId, authUsers.userId))
      .where(
        and(
          eq(platformIdentityBindings.provider, provider),
          eq(platformIdentityBindings.providerSubject, providerSubject),
        ),
      )
      .limit(1)

    if (!row) return null
    const binding = {
      id: row.id,
      provider: row.provider,
      providerSubject: row.providerSubject,
      platformUserId: row.platformUserId,
      state: identityState(row.state),
      verifiedAt: row.verifiedAt,
      principal: {
        id: row.principalId,
        state:
          row.isActive === true && row.lifecycleState === 'active'
            ? 'active'
            : row.lifecycleState === 'deprovisioned'
              ? 'deprovisioned'
              : 'suspended',
      },
    } satisfies ExternalIdentityBinding
    return binding
  },

  async listMemberships(platformUserId) {
    const rows = await db
      .select({
        id: platformOrganizationMemberships.id,
        platformUserId: platformOrganizationMemberships.platformUserId,
        organizationId: platformOrganizationMemberships.organizationId,
        role: platformOrganizationMemberships.role,
        state: platformOrganizationMemberships.state,
        effectiveFrom: platformOrganizationMemberships.effectiveFrom,
        effectiveTo: platformOrganizationMemberships.effectiveTo,
        organizationState: orgs.status,
      })
      .from(platformOrganizationMemberships)
      .innerJoin(orgs, eq(platformOrganizationMemberships.organizationId, orgs.id))
      .where(eq(platformOrganizationMemberships.platformUserId, platformUserId))

    return rows.map((row) => ({
      ...row,
      state: membershipState(row.state),
    })) satisfies readonly OrganizationMembership[]
  },

  async listPermissionGrants(membershipId, organizationId, applicationId) {
    const rows = await db
      .select({
        id: platformApplicationPermissionGrants.id,
        membershipId: platformApplicationPermissionGrants.membershipId,
        organizationId: platformApplicationPermissionGrants.organizationId,
        applicationId: platformApplicationPermissionGrants.applicationId,
        permission: platformApplicationPermissionGrants.permission,
        state: platformApplicationPermissionGrants.state,
        effectiveFrom: platformApplicationPermissionGrants.effectiveFrom,
        expiresAt: platformApplicationPermissionGrants.expiresAt,
      })
      .from(platformApplicationPermissionGrants)
      .where(
        and(
          eq(platformApplicationPermissionGrants.membershipId, membershipId),
          eq(platformApplicationPermissionGrants.organizationId, organizationId),
          eq(platformApplicationPermissionGrants.applicationId, applicationId),
        ),
      )

    return rows.map((row) => ({
      ...row,
      state: grantState(row.state),
    })) satisfies readonly ApplicationPermissionGrant[]
  },
}
