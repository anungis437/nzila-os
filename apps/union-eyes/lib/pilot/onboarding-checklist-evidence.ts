/**
 * Evidence behind the pilot onboarding checklist.
 *
 * A step is marked complete only when the organization's own data shows it happened: members other than the caller exist, a
 * collective agreement is stored, employers are imported, an integration is configured, an export was audited. The caller's
 * statement that it happened is not evidence. Reopening a step needs no evidence.
 *
 * Everything runs in the caller's tenant transaction, so only the organization's own rows are counted, and only counts are
 * returned (they go into the audit record; no row content does).
 */
import { and, eq, ne, sql } from 'drizzle-orm'
import { organizationMembers, organizations } from '@/db/schema'
import { employers } from '@/db/schema/union-structure-schema'
import { collectiveAgreements } from '@/db/schema/domains/agreements/collective-agreements'
import { apiIntegrations } from '@/db/schema/integration-schema'
import { hasAuditedAction } from '@/lib/audit/audit-reader'
import type { RLSTx } from '@/lib/db/with-rls-context'

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
      const n = await countOf(
        tx
          .select({ n: sql<number>`count(*)` })
          .from(organizationMembers)
          .where(and(eq(organizationMembers.organizationId, organizationId), ne(organizationMembers.userId, actorUserId))),
      )
      return n > 0 ? { ok: true, evidence: { otherMembers: n } } : { ok: false, missing: 'any member other than you in this organization' }
    }
    case 'roles-assigned': {
      const n = await countOf(
        tx
          .select({ n: sql<number>`count(*)` })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              ne(organizationMembers.userId, actorUserId),
              ne(organizationMembers.role, 'member'),
            ),
          ),
      )
      return n > 0
        ? { ok: true, evidence: { otherMembersWithRole: n } }
        : { ok: false, missing: 'a member other than you who holds a role above member' }
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
        tx.select({ n: sql<number>`count(*)` }).from(employers).where(eq(employers.organizationId, organizationId)),
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
