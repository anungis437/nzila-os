/**
 * Content Dashboard
 * For Content Manager - Templates, resources, training materials
 *
 * @role content_manager
 * @dashboard_path /dashboard/content
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import Link from 'next/link';
import { FileText, BookOpen, Video, Download, Eye, TrendingUp, GraduationCap, FolderOpen } from 'lucide-react';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

interface ContentItem {
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

interface TrainingCourse {
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

interface ContentStats {
  templates: { total: number; published: number; draft: number; review: number; archived: number };
  resources: { total: number; published: number };
  views: number;
  downloads: number;
  mostViewed: { title: string; category: string; views: number } | null;
  training: { total: number; active: number; totalCompletions: number };
}

async function loadContentData(orgId: string): Promise<ContentItem[]> {
  const result = await db.execute(sql`
    SELECT id, title, slug, meta_description, status, category,
           content_type, file_url, file_size_mb, download_count,
           view_count, published_at, updated_at
    FROM cms_pages
    WHERE organization_id = ${orgId}::uuid
    ORDER BY updated_at DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    description: r.meta_description as string | null,
    status: r.status as string,
    category: r.category as string | null,
    type: r.content_type as string,
    fileUrl: r.file_url as string | null,
    fileSizeMb: r.file_size_mb ? Number(r.file_size_mb) : null,
    downloads: Number(r.download_count ?? 0),
    views: Number(r.view_count ?? 0),
    publishedAt: r.published_at as string | null,
    updatedAt: r.updated_at as string | null,
  }));
}

async function loadTrainingCourses(orgId: string): Promise<TrainingCourse[]> {
  const result = await db.execute(sql`
    SELECT id, course_code, course_name, course_description,
           course_category, delivery_method, duration_label,
           completion_count, is_active, is_mandatory
    FROM training_courses
    WHERE organization_id = ${orgId}::uuid AND is_active = true
    ORDER BY is_mandatory DESC, completion_count DESC
  `);

  return Array.from(result).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    courseCode: r.course_code as string,
    name: r.course_name as string,
    description: r.course_description as string | null,
    category: r.course_category as string,
    deliveryMethod: r.delivery_method as string,
    durationLabel: r.duration_label as string | null,
    completions: Number(r.completion_count ?? 0),
    isActive: r.is_active as boolean,
    isMandatory: r.is_mandatory as boolean,
  }));
}

function computeStats(items: ContentItem[], courses: TrainingCourse[]): ContentStats {
  const templates = items.filter(i => i.type === 'template');
  const resources = items.filter(i => i.type === 'resource');
  const totalViews = items.reduce((sum, i) => sum + i.views, 0);
  const totalDownloads = items.reduce((sum, i) => sum + i.downloads, 0);

  const sorted = [...items].sort((a, b) => b.views - a.views);
  const top = sorted[0] ?? null;

  return {
    templates: {
      total: templates.length,
      published: templates.filter(t => t.status === 'published').length,
      draft: templates.filter(t => t.status === 'draft').length,
      review: templates.filter(t => t.status === 'review').length,
      archived: templates.filter(t => t.status === 'archived').length,
    },
    resources: {
      total: resources.length,
      published: resources.filter(r => r.status === 'published').length,
    },
    views: totalViews,
    downloads: totalDownloads,
    mostViewed: top ? { title: top.title, category: top.category ?? 'Uncategorized', views: top.views } : null,
    training: {
      total: courses.length,
      active: courses.filter(c => c.isActive).length,
      totalCompletions: courses.reduce((sum, c) => sum + c.completions, 0),
    },
  };
}

export default async function ContentDashboard({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; status?: string; type?: string }>;
}) {
  const { locale } = await paramsPromise;
  const t = await getTranslations('contentPage');
  const params = await searchParams;
  const activeTab = params.tab ?? 'overview';
  const filterStatus = params.status ?? null;
  const filterType = params.type ?? null;

  const user = await requireUser();

  const hasAccess = await hasMinRole('content_manager');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const organizationId = user.organizationId;

  let items: ContentItem[] = [];
  let courses: TrainingCourse[] = [];

  if (organizationId) {
    try {
      [items, courses] = await withSystemContext(() =>
        Promise.all([
          loadContentData(organizationId),
          loadTrainingCourses(organizationId),
        ])
      );
    } catch (error) {
      logger.error('Error loading content data:', error);
    }
  }

  const stats = computeStats(items, courses);
  const allTemplates = items.filter(i => i.type === 'template');
  const allResources = items.filter(i => i.type === 'resource');

  // Apply status filter when navigating from overview
  const templates = filterStatus && activeTab === 'templates'
    ? allTemplates.filter(t => t.status === filterStatus)
    : allTemplates;
  const resources = filterStatus && activeTab === 'resources'
    ? allResources.filter(r => r.status === filterStatus)
    : allResources;
  const filteredCourses = filterType && activeTab === 'training'
    ? courses.filter(c => c.category === filterType)
    : courses;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Link href={`/${locale}/dashboard/content`} className="no-underline">{t('tabOverview')}</Link>
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Link href={`/${locale}/dashboard/content?tab=templates`} className="no-underline">{t('tabTemplates', { count: stats.templates.total })}</Link>
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Link href={`/${locale}/dashboard/content?tab=resources`} className="no-underline">{t('tabResources', { count: stats.resources.total })}</Link>
          </TabsTrigger>
          <TabsTrigger value="training">
            <Link href={`/${locale}/dashboard/content?tab=training`} className="no-underline">{t('tabTraining', { count: stats.training.total })}</Link>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href={`/${locale}/dashboard/content?tab=templates`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('templatesTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.templates.total}</div>
                  <p className="text-xs text-muted-foreground">{t('publishedCount', { count: stats.templates.published })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/content?tab=resources`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {t('resourcesTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.resources.total}</div>
                  <p className="text-xs text-muted-foreground">{t('publishedCount', { count: stats.resources.published })}</p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/${locale}/dashboard/content?tab=training`} className="no-underline">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    {t('trainingCoursesTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.training.total}</div>
                  <p className="text-xs text-muted-foreground">{t('completionsCount', { count: stats.training.totalCompletions.toLocaleString(locale) })}</p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t('totalViewsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.views.toLocaleString(locale)}</div>
                <p className="text-xs text-muted-foreground">{t('downloadsCount', { count: stats.downloads.toLocaleString(locale) })}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('contentPerformanceTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('mostViewedLabel')}</span>
                    <span className="text-sm font-bold">{stats.mostViewed?.title ?? t('emptyDash')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('topViewsLabel')}</span>
                    <span className="text-sm font-bold">{stats.mostViewed?.views.toLocaleString(locale) ?? '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('totalDownloadsLabel')}</span>
                    <span className="text-sm font-bold">{stats.downloads.toLocaleString(locale)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('avgViewsPerItemLabel')}</span>
                    <span className="text-sm font-bold">
                      {items.length > 0 ? Math.round(stats.views / items.length).toLocaleString(locale) : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('contentStatusTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link href={`/${locale}/dashboard/content?tab=templates&status=published`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('status.published')}</span>
                    <Badge variant="default">{stats.templates.published + stats.resources.published}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/content?tab=templates&status=draft`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('status.inDraft')}</span>
                    <Badge variant="secondary">{stats.templates.draft}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/content?tab=templates&status=review`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('status.needsReview')}</span>
                    <Badge variant="outline">{stats.templates.review}</Badge>
                  </Link>
                  <Link href={`/${locale}/dashboard/content?tab=templates&status=archived`} className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                    <span className="text-sm">{t('status.archived')}</span>
                    <Badge variant="outline">{stats.templates.archived}</Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('popularContentTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...items]
                  .sort((a, b) => b.views - a.views)
                  .slice(0, 5)
                  .map((item) => (
                    <Link key={item.id} href={item.type === 'template' ? `/${locale}/dashboard/content/${item.slug}` : `/${locale}/dashboard/content?tab=resources`} className="flex items-center justify-between border-b pb-3 last:border-0 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors no-underline">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge variant="outline" className="text-xs">{t(`itemType.${item.type}`)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.category ?? t('uncategorizedLabel')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{item.views.toLocaleString(locale)}</p>
                        <p className="text-xs text-muted-foreground">{t('viewsLabel')}</p>
                      </div>
                    </Link>
                  ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('noContentFound')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('contentTemplatesTitle')}</CardTitle>
                {filterStatus && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t('filteredBadge', { status: filterStatus })}</Badge>
                    <Link href={`/${locale}/dashboard/content?tab=templates`} className="text-xs text-muted-foreground hover:text-foreground">
                      {t('clearFilter')}
                    </Link>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTemplatesFound')}</p>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/${locale}/dashboard/content?tab=templates&status=${template.status}`}>
                            <Badge variant={
                              template.status === 'published' ? 'default' :
                              template.status === 'draft' ? 'secondary' :
                              'outline'
                            } className="cursor-pointer hover:opacity-80">
                              {t(`statusValue.${template.status}`)}
                            </Badge>
                          </Link>
                          <Link href={`/${locale}/dashboard/content/${template.slug}`} className="text-sm font-semibold hover:underline">{template.title}</Link>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{template.category ?? t('uncategorizedLabel')}</span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{template.views.toLocaleString(locale)}</span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{template.downloads.toLocaleString(locale)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/${locale}/dashboard/content/${template.slug}`} className="p-2 hover:bg-muted rounded-md" title={t('viewTitle')}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button className="p-2 hover:bg-muted rounded-md" title={t('downloadTitle')}>
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('resourceLibraryTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noResourcesFound')}</p>
              ) : (
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <div key={resource.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{resource.title}</p>
                          {resource.status !== 'published' && (
                            <Badge variant="secondary">{resource.status}</Badge>
                          )}
                        </div>
                        {resource.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{resource.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{resource.category ?? t('uncategorizedLabel')}</span>
                          <span>&bull;</span>
                          <span>{t('pdfLabel')}</span>
                          {resource.fileSizeMb && (
                            <><span>&bull;</span><span>{t('fileSizeMb', { size: resource.fileSizeMb })}</span></>
                          )}
                          <span>&bull;</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{resource.downloads.toLocaleString(locale)}</span>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shrink-0">
                        {t('downloadButton')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('trainingMaterialsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTrainingCoursesFound')}</p>
              ) : (
                <div className="space-y-3">
                  {filteredCourses.map((course) => (
                    <div key={course.id} className="flex items-start justify-between border-b pb-4 last:border-0 gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {course.deliveryMethod === 'video' ? (
                          <Video className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                        ) : course.deliveryMethod === 'workshop' ? (
                          <GraduationCap className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <BookOpen className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{course.name}</p>
                            {course.isMandatory && (
                              <Badge variant="destructive" className="text-xs">{t('requiredBadge')}</Badge>
                            )}
                          </div>
                          {course.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{course.deliveryMethod === 'video' ? t('deliveryMethod.video') :
                             course.deliveryMethod === 'workshop' ? t('deliveryMethod.workshop') : t('deliveryMethod.document')}</span>
                            {course.durationLabel && (
                              <><span>&bull;</span><span>{course.durationLabel}</span></>
                            )}
                            <span>&bull;</span>
                            <span>{t('completionsCount', { count: course.completions })}</span>
                          </div>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shrink-0">
                        {course.deliveryMethod === 'video' ? t('action.watch') :
                         course.deliveryMethod === 'workshop' ? t('action.enroll') : t('action.read')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
