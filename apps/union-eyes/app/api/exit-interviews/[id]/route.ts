// cognition-governance-ci: allow-route-bypass — Per-interview CRUD.
import { and, asc, eq } from 'drizzle-orm';
import { withApi, z, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { exitInterviews, exitInterviewEvents, exitInterviewDocuments } from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  retiringEmployeeName: z.string().min(2).max(255).optional(),
  roleInUnion: z.enum(['member', 'steward', 'chief_steward', 'officer', 'admin']).optional(),
  yearsOfService: z.number().int().min(0).max(80).optional(),
  retirementReason: z.enum(['retirement', 'career_change', 'health', 'relocation', 'other']).optional(),
  title: z.string().min(5).max(500).optional(),
  summary: z.string().max(4000).optional(),
  keyLessons: z.string().min(10).optional(),
  bestPractices: z.string().optional(),
  bargainingAdvice: z.string().optional(),
  mediationAdvice: z.string().optional(),
  incomingOfficerAdvice: z.string().optional(),
  topics: z.array(z.string()).optional(),
  keyCases: z.array(z.object({ id: z.string().optional(), label: z.string(), notes: z.string().optional() })).optional(),
  containsPii: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  const level = ROLE_HIERARCHY[normalized] ?? 0;
  return level >= ROLE_HIERARCHY.steward;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get exit interview',
      description: 'Returns one exit interview with events and attached interview documents.',
    },
  },
  async ({ params, organizationId, user, userId }) => {
    const [row] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!row) {
      throw ApiError.notFound('Exit interview');
    }

    const stewardPlus = hasStewardPrivileges(user?.role ?? null);
    const isOwner = row.createdBy === userId;
    const isPublished = row.status === 'published' || row.status === 'archived';

    if (!stewardPlus && !isOwner && !isPublished) {
      throw ApiError.forbidden('You do not have permission to access this interview');
    }

    const [events, documents] = await Promise.all([
      db
        .select()
        .from(exitInterviewEvents)
        .where(and(eq(exitInterviewEvents.interviewId, row.id), eq(exitInterviewEvents.organizationId, organizationId!)))
        .orderBy(asc(exitInterviewEvents.createdAt)),
      db
        .select()
        .from(exitInterviewDocuments)
        .where(and(eq(exitInterviewDocuments.interviewId, row.id), eq(exitInterviewDocuments.organizationId, organizationId!)))
        .orderBy(asc(exitInterviewDocuments.createdAt)),
    ]);

    return { data: { ...row, events, documents } };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: patchSchema,
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Update exit interview draft',
      description: 'Updates a draft interview. Published records cannot be edited.',
    },
  },
  async ({ params, organizationId, user, userId, body }) => {
    const [existing] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .limit(1);

    if (!existing) {
      throw ApiError.notFound('Exit interview');
    }

    const stewardPlus = hasStewardPrivileges(user?.role ?? null);
    const isOwner = existing.createdBy === userId;

    if (!stewardPlus && !isOwner) {
      throw ApiError.forbidden('Only the owner or steward-level users can edit this interview');
    }

    if (existing.status !== 'draft') {
      throw ApiError.conflict('Only draft interviews can be edited');
    }

    const [updated] = await db
      .update(exitInterviews)
      .set({
        ...body,
        updatedBy: userId!,
        updatedAt: new Date(),
      })
      .where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))
      .returning();

    await db.insert(exitInterviewEvents).values({
      interviewId: params.id,
      organizationId: organizationId!,
      eventType: 'updated',
      actorUserId: userId!,
      notes: 'Exit interview draft updated',
    });

    return { data: updated };
  },
);
