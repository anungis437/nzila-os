import { and, eq } from 'drizzle-orm'
import { db } from '@nzila/db/client'
import {
  orgs,
  platformApplicationPermissionGrants,
  platformOrganizationMemberships,
} from '@nzila/db/schema'
import type {
  ApplicationPermissionGrant,
  AuthorizationAuthorityStore,
  OrganizationMembership,
  PermissionGrantState,
  PlatformMembershipState,
} from './authorization-context'

import { resolveExternalAuthIdentity } from './provider-identity'

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
    return resolveExternalAuthIdentity(provider, providerSubject)
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
