/**
 * Case Study Editor Form Component
 * 
 * Interactive form for creating/editing case studies with:
 * - Markdown editor
 * - Real-time preview
 * - Publish/unpublish workflow
 * - Image upload (future)
 */

'use client';
import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, FileCheck } from 'lucide-react';
import type { CaseStudy } from '@/types/marketing';

interface CaseStudyEditorFormProps {
  caseStudy: CaseStudy | null;
}

export default function CaseStudyEditorForm({ caseStudy }: CaseStudyEditorFormProps) {
  const router = useRouter();
  const isNew = !caseStudy;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: caseStudy?.title || '',
    slug: caseStudy?.slug || '',
    organizationName: caseStudy?.organizationId || '',
    organizationType: caseStudy?.organizationType || 'local',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sector: (caseStudy as any)?.sector || '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jurisdiction: (caseStudy as any)?.jurisdiction || '',
    category: caseStudy?.category || 'grievance-wins',
    summary: caseStudy?.summary || '',
    challenge: caseStudy?.challenge || '',
    solution: caseStudy?.solution || '',
    results: caseStudy?.outcome || '',
    publishStatus: caseStudy?.publishedAt ? 'published' : 'draft',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featuredImage: (caseStudy as any)?.featuredImage || '',
  });

  // Metrics state
  const [metrics, _setMetrics] = useState(caseStudy?.metrics || []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-generate slug from title
    if (field === 'title' && isNew) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.title || !formData.slug || !formData.organizationName) {
      setError('Title, slug, and organization name are required');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        publishStatus: status,
        metrics,
        publishedAt: status === 'published' ? new Date().toISOString() : null,
      };

      const response = await fetch(
        isNew ? '/api/case-studies' : `/api/case-studies/${caseStudy.slug}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save case study');
      }

      setSuccess(true);

      // Redirect after 1 second
      setTimeout(() => {
        router.push('/admin/case-studies');
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            Case study saved successfully! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="editor" className="w-full">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Core details about the case study
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="How CUPE Local 1234 Won a Major Grievance"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder="cupe-local-1234-major-grievance"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL: /case-studies/{formData.slug || 'your-slug'}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name *</Label>
                  <Input
                    id="organizationName"
                    value={formData.organizationName}
                    onChange={(e) =>
                      handleInputChange('organizationName', e.target.value)
                    }
                    placeholder="CUPE Local 1234"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationType">Organization Type</Label>
                  <Select
                    value={formData.organizationType}
                    onValueChange={(value) =>
                      handleInputChange('organizationType', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sector">Sector</Label>
                  <Input
                    id="sector"
                    value={formData.sector}
                    onChange={(e) => handleInputChange('sector', e.target.value)}
                    placeholder="Healthcare"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jurisdiction">Jurisdiction</Label>
                  <Input
                    id="jurisdiction"
                    value={formData.jurisdiction}
                    onChange={(e) =>
                      handleInputChange('jurisdiction', e.target.value)
                    }
                    placeholder="Ontario"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grievance-wins">Grievance Wins</SelectItem>
                      <SelectItem value="organizing-victory">
                        Organizing Victory
                      </SelectItem>
                      <SelectItem value="system-adoption">System Adoption</SelectItem>
                      <SelectItem value="member-engagement">
                        Member Engagement
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  placeholder="One-paragraph summary of the case study"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>
                Write the case study content using Markdown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="challenge">Challenge</Label>
                <Textarea
                  id="challenge"
                  value={formData.challenge}
                  onChange={(e) => handleInputChange('challenge', e.target.value)}
                  placeholder="Describe the problem the organization faced..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Markdown supported: **bold**, *italic*, [links](url), etc.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="solution">Solution</Label>
                <Textarea
                  id="solution"
                  value={formData.solution}
                  onChange={(e) => handleInputChange('solution', e.target.value)}
                  placeholder="Describe how Union Eyes helped solve the problem..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="results">Results</Label>
                <Textarea
                  id="results"
                  value={formData.results}
                  onChange={(e) => handleInputChange('results', e.target.value)}
                  placeholder="Describe the outcomes and impact..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                How the case study will appear on the marketing site
              </CardDescription>
            </CardHeader>
            <CardContent className="prose max-w-none">
              <h1>{formData.title || 'Untitled Case Study'}</h1>
              
              <div className="flex gap-2 mb-4 not-prose">
                <Badge>{formData.category.replace('-', ' ')}</Badge>
                <Badge variant="outline">{formData.sector}</Badge>
                <Badge variant="outline">{formData.jurisdiction}</Badge>
              </div>

              <p className="lead">{formData.summary}</p>

              <h2>The Challenge</h2>
              <div>{formData.challenge || <em>No content yet</em>}</div>

              <h2>The Solution</h2>
              <div>{formData.solution || <em>No content yet</em>}</div>

              <h2>The Results</h2>
              <div>{formData.results || <em>No content yet</em>}</div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Impact Metrics</CardTitle>
              <CardDescription>
                Add quantifiable results (optional but recommended)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Metrics editor coming soon. For now, metrics can be added via API.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Publishing Settings</CardTitle>
              <CardDescription>
                Control visibility and publication status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div>
                  <Badge
                    variant={
                      formData.publishStatus === 'published' ? 'default' : 'secondary'
                    }
                  >
                    {formData.publishStatus}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="featuredImage">Featured Image URL</Label>
                <Input
                  id="featuredImage"
                  value={formData.featuredImage}
                  onChange={(e) =>
                    handleInputChange('featuredImage', e.target.value)
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/admin/case-studies">Cancel</Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave('draft')}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save as Draft
          </Button>

          <Button onClick={() => handleSave('published')} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileCheck className="mr-2 h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
