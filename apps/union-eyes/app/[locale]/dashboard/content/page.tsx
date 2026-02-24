/**
 * Content Dashboard
 * For Content Manager - Templates, resources, training materials
 * 
 * @role content_manager
 * @dashboard_path /dashboard/content
 */


export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { requireMinRole } from '@/lib/api-auth-guard';
import { FileText, BookOpen, Video, Download, Eye, TrendingUp } from 'lucide-react';
import { logger } from '@/lib/logger';

// Fetch content templates from API
async function getContentTemplates() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/content/templates?limit=50`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch content templates');
      return [];
    }
    
    const data = await response.json();
    return data.data?.templates || [];
  } catch (error) {
    logger.error('Error fetching content templates:', error);
    return [];
  }
}

export default async function ContentDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }
  
  // Require content manager role
  await requireMinRole('content_manager');
  
  // Fetch real data
  const templates = await getContentTemplates();
  
  // Calculate metrics
  const totalTemplates = templates.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publishedTemplates = templates.filter((t: any) => t.status === 'published').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draftTemplates = templates.filter((t: any) => t.status === 'draft').length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalViews = templates.reduce((sum: number, t: any) => sum + (t.views || 0), 0);
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Content Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage templates, resources, and training materials
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Total Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalTemplates}</div>
                <p className="text-xs text-muted-foreground">{publishedTemplates} published</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156</div>
                <p className="text-xs text-muted-foreground">Available resources</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Training Materials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">42</div>
                <p className="text-xs text-muted-foreground">Videos & guides</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Total Views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Content Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Most Viewed Template</span>
                    <span className="text-sm font-bold">Grievance Form</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg. Template Views</span>
                    <span className="text-sm font-bold">{totalTemplates > 0 ? Math.round(totalViews / totalTemplates) : 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Downloads (30d)</span>
                    <span className="text-sm font-bold">2,345</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Engagement Rate</span>
                    <span className="text-sm font-bold text-green-600">87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Content Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Published</span>
                    <Badge variant="default">{publishedTemplates}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">In Draft</span>
                    <Badge variant="secondary">{draftTemplates}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Needs Review</span>
                    <Badge variant="outline">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {templates.filter((t: any) => t.status === 'review').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Archived</span>
                    <Badge variant="outline">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {templates.filter((t: any) => t.status === 'archived').length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Popular Content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templates
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                  .slice(0, 5)
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((template: any, index: number) => (
                    <div key={template.id || index} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{template.name || template.title}</p>
                        <p className="text-xs text-muted-foreground">{template.category || 'Uncategorized'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{(template.views || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">views</p>
                      </div>
                    </div>
                  ))}
                {templates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No templates found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates found</p>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {templates.map((template: any) => (
                    <div key={template.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            template.status === 'published' ? 'default' :
                            template.status === 'draft' ? 'secondary' :
                            'outline'
                          }>
                            {template.status}
                          </Badge>
                          <span className="text-sm font-medium">{template.name || template.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {template.category} • {template.type || 'Document'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(template.views || 0).toLocaleString()} views • Last updated: {template.updated_at || 'Unknown'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-muted rounded-md">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-md">
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
              <CardTitle>Resource Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">CBA Negotiation Guide</p>
                    <p className="text-xs text-muted-foreground">PDF • 2.3 MB • 1,234 downloads</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Download
                  </button>
                </div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Health & Safety Checklist</p>
                    <p className="text-xs text-muted-foreground">PDF • 1.1 MB • 892 downloads</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Download
                  </button>
                </div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Grievance Handling Manual</p>
                    <p className="text-xs text-muted-foreground">PDF • 3.8 MB • 2,101 downloads</p>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Download
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Materials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1 flex items-center gap-3">
                    <Video className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Platform Onboarding</p>
                      <p className="text-xs text-muted-foreground">Video • 15:30 • 45 completions</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Watch
                  </button>
                </div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1 flex items-center gap-3">
                    <Video className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Claims Management Training</p>
                      <p className="text-xs text-muted-foreground">Video • 22:15 • 67 completions</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Watch
                  </button>
                </div>
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1 flex items-center gap-3">
                    <BookOpen className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Admin Best Practices Guide</p>
                      <p className="text-xs text-muted-foreground">Document • 89 reads</p>
                    </div>
                  </div>
                  <button className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Read
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
