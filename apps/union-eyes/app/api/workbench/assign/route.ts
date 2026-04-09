/**
 * POST /api/workbench/assign
 * Assign a claim to the current user (or a specified steward).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  claimId: z.string().uuid(),
  assignTo: z.string().optional(), // defaults to current user
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench'],
      summary: 'Assign a claim',
      description: 'Assign a claim to the current user or a specified steward.',
    },
  },
  async (ctx) => {
    const body = await ctx.request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { claimId, assignTo } = parsed.data;
    const assigneeId = assignTo ?? ctx.userId ?? '';

    const [updated] = await db
      .update(claims)
      .set({
        assignedTo: assigneeId,
        assignedAt: new Date(),
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(eq(claims.claimId, claimId))
      .returning({ claimId: claims.claimId, assignedTo: claims.assignedTo });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 });
    }

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.MEDIUM,
      userId: ctx.userId ?? '',
      organizationId: ctx.organizationId ?? '',
      resource: 'claims',
      action: 'assign',
      resourceId: claimId,
      details: { assignedTo: assigneeId },
      outcome: 'success',
    });

    return { claim: updated };
  },
);
