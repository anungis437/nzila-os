/**
 * What the content dashboard and the template page read, in the organization's own context.
 *
 * cms_pages, training_courses and course_registrations are tenant tables: the runtime role sees them only inside
 * withRLSContext({ organizationId }). The pages read them inside withSystemContext, a role that holds no grant on any of the three, so on
 * the real roles the dashboard came back empty or failed and the page swallowed the failure into an empty dashboard. A failed read now
 * rejects, and the caller shows the error state.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { isInAppPath } from '@/lib/notifications/links';

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  category: string | null;
  type: string;
  fileUrl: string | null;
  fileSizeMb: number | null;
  downloads: number;
  views: number;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface TrainingCourse {
  id: string;
  courseCode: string;
  name: string;
  description: string | null;
  category: string;
  deliveryMethod: string;
  durationLabel: string | null;
  completions: number;
  isActive: boolean;
  isMandatory: boolean;
}

export interface TemplateField {
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ContentBlock {
  type: 'heading' | 'info' | 'section' | 'footer';
  text?: string;
  heading?: string;
  fields?: TemplateField[];
}

export interface TemplateData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  category: string | null;
  contentType: string;
  content: ContentBlock[];
  fileUrl: string | null;
  fileSizeMb: number | null;
  downloads: number;
  views: number;
  publishedAt: string | null;
  updatedAt: string | null;
}

type Row = Record<string, unknown>;

async function readContentItems(tx: RLSTx, organizationId: string): Promise<ContentItem[]> {
  const result = await tx.execute(sql`
    SELECT id, title, slug, meta_description, status, category,
           content_type, file_url, file_size_mb, download_count,
           view_count, published_at, updated_at
    FROM cms_pages
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY updated_at DESC
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    description: r.meta_description as string | null,
    status: r.status as string,
    category: r.category as string | null,
    type: r.content_type as string,
    fileUrl: r.file_url as string | null,
    fileSizeMb: r.file_size_mb === null || r.file_size_mb === undefined ? null : Number(r.file_size_mb),
    downloads: Number(r.download_count ?? 0),
    views: Number(r.view_count ?? 0),
    publishedAt: r.published_at as string | null,
    updatedAt: r.updated_at as string | null,
  }));
}

/** "8 hours", "1.5 hours", "1 hour": numeric(…,2) comes back as "8.00", which is not how a course length reads. */
export function formatDurationHours(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const hours = Number(value);
  if (!Number.isFinite(hours)) return null;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * The link a resource's Download opens: a path on this site or an https address, and nothing else. file_url is free text a content manager
 * wrote, so a value that is any other scheme (javascript:, data:, http:) or not an address at all is not offered as a download.
 */
export function contentFileHref(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  if (isInAppPath(fileUrl)) return fileUrl;
  try {
    return new URL(fileUrl).protocol === 'https:' ? fileUrl : null;
  } catch {
    return null;
  }
}

async function readTrainingCourses(tx: RLSTx, organizationId: string): Promise<TrainingCourse[]> {
  // A course records its length in hours and keeps no completion counter: completions are the registrations marked completed (as /api/content/training derives them).
  const result = await tx.execute(sql`
    SELECT c.id, c.course_code, c.course_name, c.course_description,
           c.course_category, c.delivery_method, c.duration_hours,
           (SELECT count(*)::int FROM course_registrations cr
             WHERE cr.course_id = c.id AND cr.organization_id = c.organization_id AND cr.completed IS TRUE) AS completion_count,
           c.is_active, c.is_mandatory
    FROM training_courses c
    WHERE c.organization_id = ${organizationId}::uuid AND c.is_active = true
    ORDER BY c.is_mandatory DESC, completion_count DESC
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    id: r.id as string,
    courseCode: r.course_code as string,
    name: r.course_name as string,
    description: r.course_description as string | null,
    category: r.course_category as string,
    deliveryMethod: r.delivery_method as string,
    durationLabel: formatDurationHours(r.duration_hours),
    completions: Number(r.completion_count ?? 0),
    isActive: r.is_active as boolean,
    isMandatory: r.is_mandatory as boolean,
  }));
}

/** The organization's content items and its active training courses, in one transaction. Rejects when either cannot be read. */
export function loadContentDashboard(organizationId: string): Promise<{ items: ContentItem[]; courses: TrainingCourse[] }> {
  return withRLSContext({ organizationId }, async (tx) => ({
    items: await readContentItems(tx, organizationId),
    courses: await readTrainingCourses(tx, organizationId),
  }));
}

/** One of the organization's templates by slug, or null when it has none with that slug. Rejects when it cannot be read. */
export function loadContentTemplate(organizationId: string, slug: string): Promise<TemplateData | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const result = await tx.execute(sql`
      SELECT id, title, slug, meta_description, status, category,
             content_type, content, file_url, file_size_mb,
             download_count, view_count, published_at, updated_at
      FROM cms_pages
      WHERE organization_id = ${organizationId}::uuid AND slug = ${slug}
      LIMIT 1
    `);

    const rows = Array.from(result as Iterable<Row>);
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id as string,
      title: r.title as string,
      slug: r.slug as string,
      description: r.meta_description as string | null,
      status: r.status as string,
      category: r.category as string | null,
      contentType: r.content_type as string,
      content: (r.content as ContentBlock[]) ?? [],
      fileUrl: r.file_url as string | null,
      fileSizeMb: r.file_size_mb === null || r.file_size_mb === undefined ? null : Number(r.file_size_mb),
      downloads: Number(r.download_count ?? 0),
      views: Number(r.view_count ?? 0),
      publishedAt: r.published_at as string | null,
      updatedAt: r.updated_at as string | null,
    };
  });
}
