/**
 * GET /api/content/training
 * Returns training courses from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    const url = new URL(ctx.request.url);
    const activeOnly = url.searchParams.get('active') !== 'false';

    let query = sql`
      SELECT id, course_code, course_name, course_description,
             course_category, delivery_method, duration_hours,
             duration_label, completion_count, is_active, is_mandatory,
             materials_url, created_at, updated_at
      FROM training_courses
      WHERE organization_id = ${orgId}::uuid
    `;

    if (activeOnly) {
      query = sql`${query} AND is_active = true`;
    }

    query = sql`${query} ORDER BY is_mandatory DESC, completion_count DESC`;

    const result = await db.execute(query);
    const rows = Array.from(result);

    const courses = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      courseCode: r.course_code,
      name: r.course_name,
      description: r.course_description,
      category: r.course_category,
      deliveryMethod: r.delivery_method,
      durationHours: r.duration_hours ? Number(r.duration_hours) : null,
      durationLabel: r.duration_label,
      completions: Number(r.completion_count ?? 0),
      isActive: r.is_active,
      isMandatory: r.is_mandatory,
      materialsUrl: r.materials_url,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { courses };
  },
);
