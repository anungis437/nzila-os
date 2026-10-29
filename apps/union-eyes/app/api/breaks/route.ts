/**
 * Member break records are self-reports, not employer-verified findings.
 * The member's organization_members.id must be resolved from the authenticated
 * principal, never supplied in a body or compared with a provider user id.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { memberBreaks, organizationMembers } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  breakType: z.enum(['meal', 'rest', 'union', 'nursing', 'prayer', 'health', 'other']),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['scheduled', 'taken', 'shortened', 'missed', 'denied', 'deferred']).default('scheduled'),
  scheduledStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  scheduledEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  actualStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  actualEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

async function ownMember(tx: Parameters<Parameters<typeof withRLSContext>[1]>[0], organizationId: string, userId: string) {
  const [member] = await tx.select({ id: organizationMembers.id })
    .from(organizationMembers).where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, 'active'),
    )).limit(1);
  if (!member) throw ApiError.forbidden('Active organization membership required');
  return member.id;
}

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Breaks'], summary: 'List own member break records' },
}, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const memberId = await ownMember(tx, organizationId, userId);
    const rows = await tx.select().from(memberBreaks).where(and(
      eq(memberBreaks.organizationId, organizationId),
      eq(memberBreaks.memberId, memberId),
    )).orderBy(desc(memberBreaks.createdAt)).limit(100);
    return { data: rows, limit: 100 };
  });
});

export const POST = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  body: createSchema,
  openapi: { tags: ['Breaks'], summary: 'Create an auditable personal break self-report' },
}, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const memberId = await ownMember(tx, organizationId, userId);
    const [record] = await tx.insert(memberBreaks).values({
      organizationId, memberId, createdBy: userId,
      breakType: body.breakType,
      workDate: body.workDate,
      status: body.status,
      scheduledStart: body.scheduledStart ?? null,
      scheduledEnd: body.scheduledEnd ?? null,
      actualStart: body.actualStart ?? null,
      actualEnd: body.actualEnd ?? null,
      notes: body.notes ?? null,
    }).returning();
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'member.break.self_report.create',
      resourceType: 'member_breaks', resourceId: record.id,
      details: { memberId, status: record.status, selfReported: true },
    });
    return { data: record };
  });
});
