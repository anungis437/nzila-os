import { platformDb } from '@nzila/db/platform'
import { orgMembers } from '@nzila/db'
import { eq, and } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'
import {
  findAuthOrganization,
  createAuthOrganization,
  updateAuthOrganization,
} from '../org-registry'

const logger = createLogger('agrimo:auth-webhook')

function mapAuthRole(authRole: string): 'org_admin' | 'org_secretary' | 'org_viewer' {
  switch (authRole) {
    case 'org:admin': return 'org_admin'
    case 'org:secretary': return 'org_secretary'
    default: return 'org_viewer'
  }
}

export async function handleOrganizationCreated(data: Record<string, unknown>) {
  const authOrgId = data.id as string
  const name = (data.name as string) ?? 'Unnamed Organization'
  const existing = await findAuthOrganization(authOrgId)
  if (existing.length === 0) {
    await createAuthOrganization(authOrgId, name)
    logger.info('[auth-webhook] Organization created')
  }
}

export async function handleOrganizationUpdated(data: Record<string, unknown>) {
  const authOrgId = data.id as string
  const name = (data.name as string) ?? undefined
  if (name) {
    await updateAuthOrganization(authOrgId, name)
    logger.info('[auth-webhook] Organization updated')
  }
}

export async function handleMembershipCreated(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const authOrgId = orgData?.id as string | undefined
  const userId = userData?.user_id as string | undefined
  const role = (data.role as string) ?? 'org:member'
  if (!authOrgId || !userId) {
    logger.warn('[auth-webhook] Membership created missing org/user data')
    return
  }
  const org = await findAuthOrganization(authOrgId)
  if (org.length === 0) {
    logger.warn('[auth-webhook] Membership created for unknown org')
    return
  }
  const orgId = org[0].id
  const mappedRole = mapAuthRole(role)
  const existing = await platformDb.select({ id: orgMembers.id }).from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId))).limit(1)
  if (existing.length === 0) {
    await platformDb.insert(orgMembers).values({
      orgId, userId, role: mappedRole, status: 'active',
    })
  } else {
    await platformDb.update(orgMembers)
      .set({ role: mappedRole, status: 'active', updatedAt: new Date() })
      .where(eq(orgMembers.id, existing[0].id))
  }
  logger.info('[auth-webhook] Membership created/updated')
}

export async function handleMembershipDeleted(data: Record<string, unknown>) {
  const orgData = data.organization as Record<string, unknown> | undefined
  const userData = data.public_user_data as Record<string, unknown> | undefined
  const authOrgId = orgData?.id as string | undefined
  const userId = userData?.user_id as string | undefined
  if (!authOrgId || !userId) return
  const org = await findAuthOrganization(authOrgId)
  if (org.length === 0) return
  await platformDb.update(orgMembers).set({ status: 'removed', updatedAt: new Date() })
    .where(and(eq(orgMembers.orgId, org[0].id), eq(orgMembers.userId, userId)))
  logger.info('[auth-webhook] Membership removed')
}

export async function handleUserDeleted(data: Record<string, unknown>) {
  const userId = data.id as string
  if (!userId) return
  await platformDb.update(orgMembers).set({ status: 'removed', updatedAt: new Date() })
    .where(eq(orgMembers.userId, userId))
  logger.info('[auth-webhook] User deleted — memberships removed')
}
