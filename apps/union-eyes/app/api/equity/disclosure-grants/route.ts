import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { equityDisclosureGrants, organizationMembers } from '@/db/schema';
import { requireEquityDisclosureGrantAuthority } from '@/lib/equity/disclosure-authority';

export const dynamic = 'force-dynamic';
const PURPOSE = 'equity_aggregate_monitoring';
const createSchema = z.object({ granteeUserId: z.string().trim().min(1).max(255), expiresAt: z.string().datetime(), aggregateOnly: z.literal(true), minimumCellSize: z.number().int().min(10).max(100).default(10) }).strict();
const revokeSchema = z.object({ grantId: zUUID }).strict();

export const POST = withApi({ auth: { required: true, minRole: 'admin' }, requireOrg: true, body: createSchema, openapi: { tags: ['Equity'], summary: 'Grant time-bounded aggregate-only equity disclosure authority' } }, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  if (body.granteeUserId === userId) throw ApiError.forbidden('Equity disclosure grants require a different grantor and grantee');
  const expiresAt = new Date(body.expiresAt);
  if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 366 * 86_400_000) throw ApiError.badRequest('expiresAt must be within one year');
  return withRLSContext({ organizationId }, async (tx) => {
    const authority = await requireEquityDisclosureGrantAuthority(tx, { organizationId, userId });
    const [member] = await tx.select({ userId: organizationMembers.userId }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, body.granteeUserId), eq(organizationMembers.status, 'active'), isNull(organizationMembers.deletedAt))).limit(1);
    if (!member) throw ApiError.badRequest('The grantee must be an active direct member of the organization');
    const [grant] = await tx.insert(equityDisclosureGrants).values({ organizationId, granteeUserId: body.granteeUserId, purpose: PURPOSE, aggregateOnly: true, minimumCellSize: body.minimumCellSize, grantedBy: userId, expiresAt }).returning();
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.disclosure_grant.created', resourceType: 'equity_disclosure_grants', resourceId: grant.id, details: { granteeUserId: body.granteeUserId, purpose: PURPOSE, minimumCellSize: body.minimumCellSize, expiresAt: expiresAt.toISOString(), authorityMandateId: authority.mandateId } });
    return { grant };
  });
});

export const DELETE = withApi({ auth: { required: true, minRole: 'admin' }, requireOrg: true, body: revokeSchema, openapi: { tags: ['Equity'], summary: 'Revoke an equity disclosure grant' } }, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  return withRLSContext({ organizationId }, async (tx) => {
    const authority = await requireEquityDisclosureGrantAuthority(tx, { organizationId, userId });
    const [grant] = await tx.update(equityDisclosureGrants).set({ revokedAt: new Date() }).where(and(eq(equityDisclosureGrants.id, body.grantId), eq(equityDisclosureGrants.organizationId, organizationId), isNull(equityDisclosureGrants.revokedAt))).returning();
    if (!grant) throw ApiError.notFound('Disclosure grant');
    await persistAtomicAudit(tx, { organizationId, userId, action: 'equity.disclosure_grant.revoked', resourceType: 'equity_disclosure_grants', resourceId: grant.id, details: { granteeUserId: grant.granteeUserId, purpose: grant.purpose, authorityMandateId: authority.mandateId } });
    return { status: 'revoked' };
  });
});
