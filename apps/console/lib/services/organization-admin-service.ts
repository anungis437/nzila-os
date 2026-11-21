import { platformDb } from '@nzila/db/platform'
import { orgs, orgMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import type { AuthContext } from '@/lib/api-guards'
export interface CreateOrganizationInput {
  legalName: string
  jurisdiction: string
  incorporationNumber?: string
  fiscalYearEnd?: string
}
export interface AddOrganizationMemberInput {
  userId: string
  role: 'org_admin' | 'org_secretary' | 'org_viewer'
  email?: string
  displayName?: string
}

export async function listUserOrganizations(userId: string) {
  // Return orgs where user is a member
  const rows = await platformDb
    .select({
      id: orgs.id,
      legalName: orgs.legalName,
      jurisdiction: orgs.jurisdiction,
      incorporationNumber: orgs.incorporationNumber,
      fiscalYearEnd: orgs.fiscalYearEnd,
      status: orgs.status,
      createdAt: orgs.createdAt,
    })
    .from(orgs)
    .innerJoin(
      orgMembers,
      and(
        eq(orgMembers.orgId, orgs.id),
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
      ),
    )
  return {
    status: 200,
    body: rows,
  }
}

export async function createOrganization(input: CreateOrganizationInput, userId: string) {
  const [org] = await platformDb
    .insert(orgs)
    .values({
      legalName: input.legalName,
      jurisdiction: input.jurisdiction,
      incorporationNumber: input.incorporationNumber ?? null,
      fiscalYearEnd: input.fiscalYearEnd ?? null,
    })
    .returning()
  // Auto-add creator as org_admin
  await platformDb.insert(orgMembers).values({
    orgId: org.id,
    userId,
    role: 'org_admin',
  })
  return {
    status: 201,
    body: org,
  }
}

export async function addOrganizationMember(
  orgId: string,
  input: AddOrganizationMemberInput,
  actor: AuthContext,
) {
  const { userId, role, email, displayName } = input
  const [member] = await platformDb
    .insert(orgMembers)
    .values({
      orgId,
      userId,
      role,
    })
    .returning()
  await recordAuditEvent({
    orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: AUDIT_ACTIONS.MEMBER_ADD,
    targetType: 'member',
    targetId: member.id,
    afterJson: { userId, role, email, displayName },
  })
  return {
    status: 201,
    body: { id: member.id, userId, role, email, displayName, orgId, status: member.status },
  }
}
