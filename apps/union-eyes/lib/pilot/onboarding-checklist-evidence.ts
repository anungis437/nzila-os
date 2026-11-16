/**
 * Evidence behind the pilot onboarding checklist.
 *
 * A step is marked complete only when the organization's own data shows it happened: invitations were recorded or accepted, a
 * collective agreement is stored, employers are imported, an integration is configured, an export was audited. The caller's
 * statement that it happened is not evidence. Reopening a step needs no evidence.
 *
 * Application reads use the caller's tenant transaction; invitations use the separately scoped tenant-auth gateway.
 * Only counts are returned into the audit record; no row content or credentials are included.
 */
import { and, eq, sql } from 'drizzle-orm'
import { organizations } from '@/db/schema'
import { listOrganizationInvites } from '@nzila/platform-auth/invites'
import { employers } from '@/db/schema/union-structure-schema'
import { collectiveAgreements } from '@/db/schema/domains/agreements/collective-agreements'
import { apiIntegrations } from '@/db/schema/integration-schema'
import { hasAuditedAction } from '@/lib/audit/audit-reader'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { productionEmployerCondition } from '@/lib/pilot/demo-provenance'

export const CHECKLIST_ITEM_IDS = [
  'org-seeded',
  'users-invited',
  'roles-assigned',
  'contracts-uploaded',
  'employers-imported',
  'integrations-configured',
  'export-verified',
] as const

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number]

export type ChecklistEvidence =
  | { ok: true; evidence: Record<string, number | boolean> }
  | { ok: false; missing: string }

const countOf = async (rows: PromiseLike<Array<{ n: number | string }>>): Promise<number> => Number((await rows)[0]?.n ?? 0)

export async function verifyChecklistStep(
  tx: RLSTx,
  organizationId: string,
  actorUserId: string,
  itemId: ChecklistItemId,
): Promise<ChecklistEvidence> {
  switch (itemId) {
    case 'org-seeded': {
      const n = await countOf(
        tx.select({ n: sql<number>`count(*)` }).from(organizations).where(eq(organizations.id, organizationId)),
      )
      return n > 0 ? { ok: true, evidence: { organizationRows: n } } : { ok: false, missing: 'the organization record' }
    }
    case 'users-invited': {
      const invitations = await listOrganizationInvites(actorUserId, organizationId)
      const n = invitations.filter(invite => invite.acceptedAt || (!invite.revokedAt && invite.expiresAt.getTime() > Date.now())).length
      return n > 0 ? { ok: true, evidence: { recordedInvitations: n } } : { ok: false, missing: 'an accepted or usable invitation in this organization' }
    }
    case 'roles-assigned': {
      const invitations = await listOrganizationInvites(actorUserId, organizationId)
      const n = invitations.filter(invite => invite.acceptedAt && invite.role !== 'member').length
      return n > 0
        ? { ok: true, evidence: { acceptedStaffInvitations: n } }
        : { ok: false, missing: 'an accepted staff invitation in this organization' }
    }
    case 'contracts-uploaded': {
      const n = await countOf(
        tx
          .select({ n: sql<number>`count(*)` })
          .from(collectiveAgreements)
          .where(eq(collectiveAgreements.organizationId, organizationId)),
      )
      return n > 0 ? { ok: true, evidence: { collectiveAgreements: n } } : { ok: false, missing: 'a stored collective agreement' }
    }
    case 'employers-imported': {
      const n = await countOf(
        tx.select({ n: sql<number>`count(*)` }).from(employers).where(and(eq(employers.organizationId, organizationId), productionEmployerCondition())),
      )
      return n > 0 ? { ok: true, evidence: { employers: n } } : { ok: false, missing: 'an employer record' }
    }
    case 'integrations-configured': {
      const n = await countOf(
        tx.select({ n: sql<number>`count(*)` }).from(apiIntegrations).where(eq(apiIntegrations.organizationId, organizationId)),
      )
      return n > 0 ? { ok: true, evidence: { integrations: n } } : { ok: false, missing: 'a configured integration' }
    }
    case 'export-verified': {
      const exported = await hasAuditedAction(tx, organizationId, '%export%', ['%unavailable%', '%reject%', '%denied%', '%.request'])
      return exported ? { ok: true, evidence: { auditedExport: true } } : { ok: false, missing: 'an audited export by this organization' }
    }
  }
}
