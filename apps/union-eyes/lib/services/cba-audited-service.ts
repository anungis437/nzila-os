/**
 * Organization-scoped CBA mutations. Every write commits with its audit record in the same transaction, looks the
 * agreement up by id AND organization, and carries the state it expects so a concurrent change is a conflict instead of
 * being overwritten.
 */
import { and, eq, ne, sql } from 'drizzle-orm';
import { collectiveAgreements } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export type CBA = typeof collectiveAgreements.$inferSelect;
export type CBACreateInput = Omit<
  typeof collectiveAgreements.$inferInsert,
  'id' | 'organizationId' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'updatedAt' | 'isPublic' | 'viewCount' | 'version'
>;
export type CBAUpdateInput = Partial<CBACreateInput>;

export interface CBAScope {
  organizationId: string;
  userId: string;
}

export async function createCbaAudited(scope: CBAScope, data: CBACreateInput): Promise<CBA> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    const [created] = await tx
      .insert(collectiveAgreements)
      .values({
        ...data,
        organizationId: scope.organizationId,
        isPublic: false,
        createdBy: scope.userId,
        lastModifiedBy: scope.userId,
      })
      .returning();
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'cba.create',
      resourceType: 'collective_agreements',
      resourceId: created.id,
      details: { cbaNumber: created.cbaNumber, status: created.status },
    });
    return created;
  });
}

export type UpdateCbaResult =
  | { kind: 'updated'; cba: CBA }
  | { kind: 'not_found' }
  | { kind: 'conflict' };

/** A not_found or conflict outcome writes nothing and audits nothing. */
export async function updateCbaAudited(scope: CBAScope, id: string, data: CBAUpdateInput): Promise<UpdateCbaResult> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx): Promise<UpdateCbaResult> => {
    const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, scope.organizationId));
    let inOrganizationWhere = inOrganization;
    let previousStatus: string | undefined;

    if (data.status !== undefined) {
      const [current] = await tx
        .select({ status: collectiveAgreements.status })
        .from(collectiveAgreements)
        .where(inOrganization)
        .limit(1);
      if (!current) return { kind: 'not_found' };
      previousStatus = current.status;
      inOrganizationWhere = and(inOrganization, eq(collectiveAgreements.status, current.status));
    }

    const [updated] = await tx
      .update(collectiveAgreements)
      .set({ ...data, lastModifiedBy: scope.userId, updatedAt: new Date() })
      .where(inOrganizationWhere)
      .returning();

    if (!updated) return previousStatus === undefined ? { kind: 'not_found' } : { kind: 'conflict' };

    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'cba.update',
      resourceType: 'collective_agreements',
      resourceId: id,
      details: {
        fields: Object.keys(data),
        ...(previousStatus !== undefined ? { fromStatus: previousStatus, toStatus: updated.status } : {}),
      },
    });
    return { kind: 'updated', cba: updated };
  });
}

export type ArchiveCbaResult = 'archived' | 'not_found' | 'already_archived';

export async function archiveCbaAudited(scope: CBAScope, id: string): Promise<ArchiveCbaResult> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx): Promise<ArchiveCbaResult> => {
    const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, scope.organizationId));
    const [archived] = await tx
      .update(collectiveAgreements)
      .set({ status: 'archived', lastModifiedBy: scope.userId, updatedAt: new Date() })
      .where(and(inOrganization, ne(collectiveAgreements.status, 'archived')))
      .returning({ id: collectiveAgreements.id });
    if (!archived) {
      const [existing] = await tx
        .select({ id: collectiveAgreements.id })
        .from(collectiveAgreements)
        .where(inOrganization)
        .limit(1);
      return existing ? 'already_archived' : 'not_found';
    }
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'cba.archive',
      resourceType: 'collective_agreements',
      resourceId: id,
      details: {},
    });
    return 'archived';
  });
}

/** Organization-scoped read. The optional view counter is usage telemetry, not a governed state change. */
export async function getCbaForOrganization(
  organizationId: string,
  id: string,
  options: { countView?: boolean } = {},
): Promise<CBA | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, organizationId));
    const [row] = await tx.select().from(collectiveAgreements).where(inOrganization).limit(1);
    if (!row) return null;
    if (options.countView) {
      await tx
        .update(collectiveAgreements)
        .set({ viewCount: sql`${collectiveAgreements.viewCount} + 1` })
        .where(inOrganization);
    }
    return row;
  });
}
