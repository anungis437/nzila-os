/**
 * Newsletter Template Gallery Component
 * 
 * Browse, preview, and select newsletter templates:
 * - Grid layout with thumbnails
 * - Category filtering
 * - Search functionality
 * - Template preview modal
 * - Usage statistics
 * 
 * Version: 1.0.0
 * Created: December 6, 2025
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Search,
  Eye,
  Copy,
  Trash2,
  Plus,
  MoreVertical,
  Star,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';

interface NewsletterTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'general' | 'announcement' | 'event' | 'update' | 'custom';
  thumbnailUrl?: string;
  htmlContent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonStructure?: any;
  variables?: TemplateVariable[];
  isSystem: boolean;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateVariable {
  name: string;
  label: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default?: any;
  required?: boolean;
}

interface TemplateGalleryProps {
  onSelect?: (template: NewsletterTemplate) => void;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export function TemplateGallery({
  onSelect,
  allowCreate = true,
  allowEdit = true,
  allowDelete = false,
}: TemplateGalleryProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] =
    useState<NewsletterTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/communications/templates');

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSelectTemplate = (template: NewsletterTemplate) => {
    if (onSelect) {
      onSelect(template);
    } else {
      // Navigate to campaign creator with template
      router.push(`/communications/newsletters/new?templateId=${template.id}`);
    }
  };

  const handleDuplicateTemplate = async (templateId: string) => {
    try {
      const response = await fetch(
        `/api/communications/templates/${templateId}/duplicate`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to duplicate template');
      }

      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
      });

      fetchTemplates();
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to duplicate template',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(
        `/api/communications/templates/${templateId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setDeleteConfirm(null);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || template.category === categoryFilter;

    return matchesSearch && matchesCategory && template.isActive;
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-100 text-gray-800',
      announcement: 'bg-blue-100 text-blue-800',
      event: 'bg-purple-100 text-purple-800',
      update: 'bg-green-100 text-green-800',
      custom: 'bg-orange-100 text-orange-800',
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Newsletter Templates
          </h2>
          <p className="text-sm text-gray-600">
            Choose a template to start your campaign
          </p>
        </div>

        {allowCreate && (
          <Button onClick={() => router.push('/communications/templates/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No templates found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || categoryFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first template to get started'}
          </p>
          {allowCreate && (
            <Button
              onClick={() => router.push('/communications/templates/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="group hover:shadow-lg transition-shadow cursor-pointer"
            >
              {/* Thumbnail */}
              <div
                className="h-48 bg-linear-to-br from-gray-100 to-gray-200 relative overflow-hidden"
                onClick={() => handleSelectTemplate(template)}
              >
                {template.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.thumbnailUrl}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Mail className="w-16 h-16 text-gray-400" />
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTemplate(template);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTemplate(template);
                    }}
                  >
                    Use Template
                  </Button>
                </div>

                {/* System Badge */}
                {template.isSystem && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 bg-white/90"
                  >
                    <Star className="w-3 h-3 mr-1" />
                    System
                  </Badge>
                )}
              </div>

              {/* Content */}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {template.description || 'No description'}
                    </CardDescription>
                  </div>

                  {(allowEdit || allowDelete) && !template.isSystem && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {allowEdit && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/communications/templates/${template.id}/edit`
                              )
                            }
                          >
                            Edit Template
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDuplicateTemplate(template.id)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {allowDelete && (
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm(template.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>

              <CardFooter className="flex items-center justify-between pt-0">
                <Badge className={getCategoryColor(template.category)}>
                  {template.category}
                </Badge>

                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>{template.usageCount} uses</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={() => setPreviewTemplate(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              {/* Variables */}
              {previewTemplate.variables &&
                previewTemplate.variables.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Template Variables
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {previewTemplate.variables.map((variable) => (
                        <Badge key={variable.name} variant="outline">
                          {variable.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Preview */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(previewTemplate.htmlContent),
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewTemplate(null)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  handleSelectTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }
              }}
            >
              Use This Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirm && handleDeleteTemplate(deleteConfirm)
              }
            >
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

