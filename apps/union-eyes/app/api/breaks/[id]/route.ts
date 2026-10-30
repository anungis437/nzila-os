/**
 * Break self-reports are attributable to the signed-in organization member.
 * Item reads and amendments must never use the generic CRUD member role floor,
 * which permits access to another member's record by identifier.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { memberBreaks, organizationMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Breaks'], summary: 'Read own break self-report' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [member] = await tx.select({ id: organizationMembers.id })
      .from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active'),
      )).limit(1);
    if (!member) throw ApiError.forbidden('Active organization membership required');
    const [record] = await tx.select().from(memberBreaks).where(and(
      eq(memberBreaks.id, params.id),
      eq(memberBreaks.organizationId, organizationId),
      eq(memberBreaks.memberId, member.id),
    )).limit(1);
    if (!record) throw ApiError.notFound('Break self-report');
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'member.break.self_report.read',
      resourceType: 'member_breaks', resourceId: record.id,
      details: { memberId: member.id },
    });
    return { data: record };
  });
});

const amendmentSchema = z.object({
  breakType: z.enum(['meal', 'rest', 'union', 'nursing', 'prayer', 'health', 'other']).optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['scheduled', 'taken', 'shortened', 'missed', 'denied', 'deferred']).optional(),
  scheduledStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  scheduledEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  actualStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  actualEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export const PATCH = withApi({
  auth: { required: true, minRole: 'member' }, requireOrg: true,
  body: amendmentSchema,
  openapi: { tags: ['Breaks'], summary: 'Amend own break self-report with audit history' },
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const [member] = await tx.select({ id: organizationMembers.id })
      .from(organizationMembers).where(and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active'),
      )).limit(1);
    if (!member) throw ApiError.forbidden('Active organization membership required');
    const predicate = and(
      eq(memberBreaks.id, params.id),
      eq(memberBreaks.organizationId, organizationId),
      eq(memberBreaks.memberId, member.id),
    );
    const [original] = await tx.select().from(memberBreaks).where(predicate).limit(1);
    if (!original) throw ApiError.notFound('Break self-report');
    const [updated] = await tx.update(memberBreaks).set(body).where(predicate).returning();
    if (!updated) throw ApiError.notFound('Break self-report');
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'member.break.self_report.amend',
      resourceType: 'member_breaks', resourceId: original.id,
      details: { memberId: member.id, before: original, after: updated, selfReported: true },
    });
    return { data: updated };
  });
});

// Deletion remains disabled: preserving reported workplace evidence requires
// a separately governed retention and disposal workflow.
