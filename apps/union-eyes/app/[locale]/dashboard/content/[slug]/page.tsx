/**
 * Template Detail View
 * Displays a single content template with its full structured content.
 *
 * @dashboard_path /dashboard/content/[slug]
 */

export const dynamic = 'force-dynamic';

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { ArrowLeft, Download, Eye, Calendar, FolderOpen, FileText } from 'lucide-react';
import { ContentWorkflowActions } from '../_components/content-workflow-actions';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

interface TemplateField {
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface ContentBlock {
  type: 'heading' | 'info' | 'section' | 'footer';
  text?: string;
  heading?: string;
  fields?: TemplateField[];
}

interface TemplateData {
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

async function loadTemplate(orgId: string, slug: string): Promise<TemplateData | null> {
  const result = await db.execute(sql`
    SELECT id, title, slug, meta_description, status, category,
           content_type, content, file_url, file_size_mb,
           download_count, view_count, published_at, updated_at
    FROM cms_pages
    WHERE organization_id = ${orgId}::uuid AND slug = ${slug}
    LIMIT 1
  `);

  const rows = Array.from(result);
  if (rows.length === 0) return null;

  const r = rows[0] as Record<string, unknown>;
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
    fileSizeMb: r.file_size_mb ? Number(r.file_size_mb) : null,
    downloads: Number(r.download_count ?? 0),
    views: Number(r.view_count ?? 0),
    publishedAt: r.published_at as string | null,
    updatedAt: r.updated_at as string | null,
  };
}

function FieldRenderer({ field }: { field: TemplateField }) {
  const labelClass = 'block text-sm font-medium text-foreground mb-1';
  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/50';

  return (
    <div>
      <label className={labelClass}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          className={`${inputClass} min-h-20 resize-none`}
          placeholder={field.placeholder}
          readOnly
          rows={3}
        />
      ) : field.type === 'select' ? (
        <select className={inputClass} disabled>
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'signature' ? (
        <div className="h-16 rounded-md border border-dashed border-input bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          Signature field
        </div>
      ) : (
        <input
          className={inputClass}
          type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
          placeholder={field.placeholder}
          readOnly
        />
      )}
    </div>
  );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h2 className="text-xl font-bold tracking-tight">{block.text}</h2>
      );
    case 'info':
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">{block.text}</p>
        </div>
      );
    case 'section':
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">{block.heading}</h3>
          {block.fields && block.fields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {block.fields.map((field, i) => {
                const isWide = field.type === 'textarea' || field.type === 'signature';
                return (
                  <div key={i} className={isWide ? 'sm:col-span-2' : ''}>
                    <FieldRenderer field={field} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    case 'footer':
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 mt-2">
          <p className="text-sm text-amber-800 dark:text-amber-200">{block.text}</p>
        </div>
      );
    default:
      return null;
  }
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  const user = await requireUser();

  const hasAccess = await hasMinRole('member');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    redirect('/dashboard');
  }

  const template = await withSystemContext(() => loadTemplate(organizationId, slug));
  if (!template) {
    notFound();
  }

  const statusVariant = template.status === 'published' ? 'default'
    : template.status === 'draft' ? 'secondary'
    : 'outline';

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      {/* Back navigation */}
      <Link
        href="/dashboard/content"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Content
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={statusVariant}>{template.status}</Badge>
          {template.category && (
            <Badge variant="outline" className="text-xs">
              <FolderOpen className="h-3 w-3 mr-1" />
              {template.category}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {template.contentType}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{template.title}</h1>
        {template.description && (
          <p className="text-muted-foreground">{template.description}</p>
        )}
      </div>

      {/* Workflow actions */}
      <ContentWorkflowActions
        itemId={template.id}
        currentStatus={template.status}
        title={template.title}
      />

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          {template.views.toLocaleString()} views
        </span>
        <span className="flex items-center gap-1.5">
          <Download className="h-4 w-4" />
          {template.downloads.toLocaleString()} downloads
        </span>
        {template.updatedAt && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Updated {new Date(template.updatedAt).toLocaleDateString('en-CA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      <Separator />

      {/* Template content */}
      {template.content.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {template.content.map((block, index) => (
              <ContentBlockRenderer key={index} block={block} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No template content available yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
