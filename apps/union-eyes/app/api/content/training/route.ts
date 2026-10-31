/**
 * GET /api/content/training
 * Returns training courses from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    const url = new URL(ctx.request.url);
    const activeOnly = url.searchParams.get('active') !== 'false';
    const page = listPage(ctx.request, 200);

    // duration_label, completion_count and materials_url are not stored columns: they are derived
    // from the canonical duration, registration and materials fields.
    let query = sql`
      SELECT tc.id, tc.course_code, tc.course_name, tc.course_description,
             tc.course_category, tc.delivery_method, tc.duration_hours,
             CASE WHEN tc.duration_hours IS NOT NULL THEN tc.duration_hours::text || ' hours' END AS duration_label,
             (SELECT count(*)::int FROM course_registrations cr
               WHERE cr.course_id = tc.id AND cr.organization_id = tc.organization_id
                 AND cr.attended IS TRUE) AS completion_count,
             tc.is_active, tc.is_mandatory,
             tc.course_materials_url AS materials_url, tc.created_at, tc.updated_at
      FROM training_courses tc
      WHERE tc.organization_id = ${orgId}::uuid
    `;

    if (activeOnly) {
      query = sql`${query} AND tc.is_active = true`;
    }

    // The id breaks ties so a page is stable while the list is paged through.
    query = sql`${query} ORDER BY tc.is_mandatory DESC, completion_count DESC, tc.id LIMIT ${page.limit} OFFSET ${page.offset}`;

    const result = await withRLSContext(async () => db.execute(query));
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
