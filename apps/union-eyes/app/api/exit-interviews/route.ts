// cognition-governance-ci: allow-route-bypass — Exit-interview entity CRUD (not a cognition engine).
import { and, desc, eq, inArray } from 'drizzle-orm';
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import {
  exitInterviews,
  exitInterviewEvents,
  exitInterviewStatusEnum,
} from '@/db/schema';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

const createExitInterviewSchema = z.object({
  retiringEmployeeName: z.string().min(2).max(255),
  roleInUnion: z.enum(['member', 'steward', 'chief_steward', 'officer', 'admin']),
  yearsOfService: z.number().int().min(0).max(80),
  retirementReason: z.enum(['retirement', 'career_change', 'health', 'relocation', 'other']).optional(),
  title: z.string().min(5).max(500),
  summary: z.string().max(4000).optional(),
  keyLessons: z.string().min(10),
  bestPractices: z.string().optional(),
  bargainingAdvice: z.string().optional(),
  mediationAdvice: z.string().optional(),
  incomingOfficerAdvice: z.string().optional(),
  topics: z.array(z.string()).optional(),
  keyCases: z.array(z.object({ id: z.string().optional(), label: z.string(), notes: z.string().optional() })).optional(),
  containsPii: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  mine: z.enum(['true', 'false']).optional(),
});

function hasStewardPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  const level = ROLE_HIERARCHY[normalized] ?? 0;
  return level >= ROLE_HIERARCHY.steward;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    query: listQuerySchema,
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'List exit interviews',
      description: 'Returns org-scoped exit interviews. Members can see published records and their own drafts.',
    },
  },
  async ({ organizationId, user, userId, query }) => {
    const conditions = [eq(exitInterviews.organizationId, organizationId!)];

    if (query.status?.length) {
      const allowed = query.status
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is (typeof exitInterviewStatusEnum.enumValues)[number] =>
          exitInterviewStatusEnum.enumValues.includes(value as (typeof exitInterviewStatusEnum.enumValues)[number]),
        );

      if (allowed.length) {
        conditions.push(inArray(exitInterviews.status, allowed));
      }
    }

    const stewardPlus = hasStewardPrivileges(user?.role ?? null);
    if (!stewardPlus) {
      conditions.push(
        inArray(exitInterviews.status, ['published', 'archived']),
      );
    }

    if (query.mine === 'true') {
      conditions.push(eq(exitInterviews.createdBy, userId!));
    }

    const rows = await db
      .select()
      .from(exitInterviews)
      .where(and(...conditions))
      .orderBy(desc(exitInterviews.createdAt))
      .limit(200);

    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: createExitInterviewSchema,
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Create exit interview draft',
      description: 'Creates an exit interview draft for review and publication.',
    },
  },
  async ({ organizationId, userId, body }) => {
    const now = new Date();

    const [created] = await db
      .insert(exitInterviews)
      .values({
        ...body,
        organizationId: organizationId!,
        createdBy: userId!,
        updatedBy: userId!,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(exitInterviewEvents).values({
      interviewId: created.id,
      organizationId: organizationId!,
      eventType: 'created',
      actorUserId: userId!,
      notes: 'Exit interview draft created',
      payload: { status: created.status },
    });

    return { data: created };
  },
);
