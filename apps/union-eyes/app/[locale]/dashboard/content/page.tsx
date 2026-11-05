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
import { FileText, BookOpen, Video, Download, Eye, Clock, GraduationCap, FolderOpen } from 'lucide-react';
import { isUuid } from '@/lib/page-data/uuid';
import { loadContentDashboard, contentFileHref, type ContentItem, type TrainingCourse } from '@/lib/dashboard-reads/content';

// Views and downloads are columns nothing in the application increments, so they are not shown as figures: a count that is always whatever
// was seeded is not a measure. The overview lists what is real: how much content exists, in which state, and what changed last.
interface ContentStats {
  templates: { total: number; published: number; draft: number; review: number; archived: number };
  resources: { total: number; published: number };
  training: { total: number; active: number; totalCompletions: number };
}

function computeStats(items: ContentItem[], courses: TrainingCourse[]): ContentStats {
  const templates = items.filter(i => i.type === 'template');
  const resources = items.filter(i => i.type === 'resource');

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
  // A person who belongs to no organization has no content to read: they go back to the dashboard rather than to an empty one.
  if (!isUuid(organizationId)) {
    redirect('/dashboard');
  }

  // A failed read is an error, not an empty dashboard: nothing here catches it.
  const { items, courses } = await loadContentDashboard(organizationId);

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
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('recentlyUpdatedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...items]
                    .filter((item) => item.updatedAt)
                    .sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
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
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.updatedAt as string).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </Link>
                    ))}
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('noContentFound')}</p>
                  )}
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
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/${locale}/dashboard/content/${template.slug}`} className="p-2 hover:bg-muted rounded-md" title={t('viewTitle')}>
                          <Eye className="h-4 w-4" />
                        </Link>
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
                  {resources.map((resource) => {
                    const href = contentFileHref(resource.fileUrl);
                    return (
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
                            {resource.fileSizeMb && (
                              <><span>&bull;</span><span>{t('fileSizeMb', { size: resource.fileSizeMb })}</span></>
                            )}
                          </div>
                        </div>
                        {href ? (
                          <a
                            href={href}
                            download
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shrink-0 inline-flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            {t('downloadButton')}
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
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
