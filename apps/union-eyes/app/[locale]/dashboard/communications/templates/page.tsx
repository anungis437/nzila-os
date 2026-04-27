/**
 * Templates Library Page
 * 
 * Manage message templates for campaigns
 * Path: /dashboard/communications/templates
 * 
 * Phase 4: Communications & Organizing
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, MessageSquare, Bell, Plus, Search, RefreshCw, Eye } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  category: string;
  subject: string | null;
  body: string;
  preheader: string | null;
  htmlContent: string | null;
  plainTextContent: string | null;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
    default: string | null;
    example: string | null;
  }>;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const t = useTranslations('communicationsTemplatesPage');
  const locale = useLocale();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      if (statusFilter !== 'all') {
        params.append('isActive', statusFilter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/communications/templates?${params}`);
      
      if (!response.ok) {
        throw new Error(t('failedToFetchTemplates'));
      }

      const json = await response.json();
      // withApi wraps in { success, data: { data, pagination }, timestamp }
      const payload = json.data ?? json;
      setTemplates(Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : []);
      setTotalPages(payload.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToFetchTemplates'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, categoryFilter, statusFilter]);

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'push':
        return <Bell className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter templates by search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/communications/templates/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createTemplateButton')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('totalTemplatesTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('type.email')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter(t => t.type === 'email').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('type.sms')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter(t => t.type === 'sms').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('status.active')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter(t => t.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>{t('filtersTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder={t('typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTypes')}</SelectItem>
                  <SelectItem value="email">{t('type.email')}</SelectItem>
                  <SelectItem value="sms">{t('type.sms')}</SelectItem>
                  <SelectItem value="push">{t('type.push')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allCategories')}</SelectItem>
                  <SelectItem value="campaign">{t('category.campaign')}</SelectItem>
                  <SelectItem value="transactional">{t('category.transactional')}</SelectItem>
                  <SelectItem value="alert">{t('category.alert')}</SelectItem>
                  <SelectItem value="newsletter">{t('category.newsletter')}</SelectItem>
                  <SelectItem value="announcement">{t('category.announcement')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-45">
                  <SelectValue placeholder={t('statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  <SelectItem value="active">{t('status.active')}</SelectItem>
                  <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={fetchTemplates}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('allTemplatesTitle')}</CardTitle>
            <CardDescription>
              {t('templatesFound', { count: filteredTemplates.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">{t('loadingTemplates')}</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
                <Button variant="outline" onClick={fetchTemplates} className="mt-4">
                  {t('tryAgainButton')}
                </Button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('noTemplatesFound')}</p>
                <Button onClick={() => router.push('/dashboard/communications/templates/new')} className="mt-4">
                  {t('createFirstTemplateButton')}
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('columnTemplate')}</TableHead>
                      <TableHead>{t('columnType')}</TableHead>
                      <TableHead>{t('columnCategory')}</TableHead>
                      <TableHead>{t('columnVariables')}</TableHead>
                      <TableHead>{t('columnStatus')}</TableHead>
                      <TableHead>{t('columnLastUpdated')}</TableHead>
                      <TableHead>{t('columnActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow 
                        key={template.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/dashboard/communications/templates/${template.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {template.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getChannelIcon(template.type)}
                            <span>{t(`type.${template.type}`)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t(`category.${template.category}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          {template.variables.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {template.variables.slice(0, 3).map((variable, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {variable.name}
                                </Badge>
                              ))}
                              {template.variables.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('moreVariables', { count: template.variables.length - 3 })}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t('noneLabel')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? 'default' : 'secondary'}>
                            {template.isActive ? t('status.active') : t('status.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(template.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplate(template);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/communications/templates/${template.id}`);
                              }}
                            >
                              {t('editButton')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t('pageInfo', { page, totalPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        {t('previousButton')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        {t('nextButton')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>{previewTemplate?.description}</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              {previewTemplate.subject && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('subjectLabel')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {previewTemplate.subject}
                  </div>
                </div>
              )}

              {previewTemplate.preheader && (
                <div>
                  <div className="text-sm font-medium mb-1">{t('preheaderLabel')}</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {previewTemplate.preheader}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-1">{t('bodyLabel')}</div>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                  {previewTemplate.body}
                </div>
              </div>

              {previewTemplate.variables.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">{t('variablesLabel')}</div>
                  <div className="space-y-2">
                    {previewTemplate.variables.map((variable, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{variable.name}</Badge>
                          {variable.required && (
                            <Badge variant="destructive" className="text-xs">{t('requiredLabel')}</Badge>
                          )}
                        </div>
                        {variable.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {variable.description}
                          </p>
                        )}
                        {variable.example && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('examplePrefix')}: {variable.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewTemplate.tags.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">{t('tagsLabel')}</div>
                  <div className="flex gap-2 flex-wrap">
                    {previewTemplate.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
