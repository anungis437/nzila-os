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
import { NextResponse } from 'next/server';

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

const refuseMutation = () => NextResponse.json({
  error: 'BREAK_SELF_REPORT_AMENDMENT_NOT_IMPLEMENTED',
  message: 'Break record changes require an attributable amendment and retention workflow.',
}, { status: 501, headers: { 'Cache-Control': 'private, no-store' } });

export const PATCH = withApi({
  auth: { required: true, minRole: 'member' }, requireOrg: true,
  openapi: { tags: ['Breaks'], summary: 'Amend break self-report (not implemented)' },
}, refuseMutation);

export const DELETE = withApi({
  auth: { required: true, minRole: 'member' }, requireOrg: true,
  openapi: { tags: ['Breaks'], summary: 'Delete break self-report (not implemented)' },
}, refuseMutation);
