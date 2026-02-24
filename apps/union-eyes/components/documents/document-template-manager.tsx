/**
 * Document Template Manager Component
 * 
 * Template management system with:
 * - Template library
 * - Template creation
 * - Variable placeholders
 * - Template preview
 * - Category organization
 * - Usage tracking
 * 
 * @module components/documents/document-template-manager
 */

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  FileText,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit,
  Eye,
  TrendingUp,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  content: z.string().min(1, "Template content is required"),
  variables: z.array(z.string()).optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  usageCount: number;
  lastUsed?: Date;
}

export interface TemplateCategory {
  id: string;
  name: string;
  count: number;
}

export interface DocumentTemplateManagerProps {
  templates: DocumentTemplate[];
  categories: TemplateCategory[];
  onCreateTemplate?: (data: TemplateFormData) => Promise<void>;
  onUpdateTemplate?: (id: string, data: TemplateFormData) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  onUseTemplate?: (template: DocumentTemplate) => void;
  onPreviewTemplate?: (template: DocumentTemplate) => void;
}

export function DocumentTemplateManager({
  templates,
  categories,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onUseTemplate,
  onPreviewTemplate,
}: DocumentTemplateManagerProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<DocumentTemplate | null>(null);

  const filteredTemplates = React.useMemo(() => {
    return templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [templates, searchTerm, selectedCategory]);

  const stats = React.useMemo(() => {
    const totalTemplates = templates.length;
    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const mostUsed = templates.reduce(
      (max, t) => (t.usageCount > max.usageCount ? t : max),
      templates[0]
    );

    return { totalTemplates, totalUsage, mostUsed };
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Templates</h2>
          <p className="text-gray-600 mt-1">Manage and organize document templates</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <TemplateEditor
              categories={categories}
              onSave={async (data) => {
                await onCreateTemplate?.(data);
                setCreateDialogOpen(false);
              }}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalTemplates}</div>
                <div className="text-sm text-gray-600">Total Templates</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalUsage}</div>
                <div className="text-sm text-gray-600">Total Usage</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <div className="font-semibold truncate">{stats.mostUsed?.name || "N/A"}</div>
              <div className="text-sm text-gray-600">
                Most Used ({stats.mostUsed?.usageCount || 0} times)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onUse={() => onUseTemplate?.(template)}
            onEdit={() => setEditingTemplate(template)}
            onDelete={() => onDeleteTemplate?.(template.id)}
            onPreview={() => onPreviewTemplate?.(template)}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Create your first template to get started"}
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <TemplateEditor
              template={editingTemplate}
              categories={categories}
              onSave={async (data) => {
                await onUpdateTemplate?.(editingTemplate.id, data);
                setEditingTemplate(null);
              }}
              onCancel={() => setEditingTemplate(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  onPreview,
}: {
  template: DocumentTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate" title={template.name}>
              {template.name}
            </CardTitle>
            <Badge variant="secondary" className="mt-2">
              {template.category}
            </Badge>
          </div>
          <FileText className="h-5 w-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {template.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Variables:</span>
            <span className="font-medium">{template.variables.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Used:</span>
            <span className="font-medium">{template.usageCount} times</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Updated:</span>
            <span className="font-medium">{format(template.updatedAt, "MMM d, yyyy")}</span>
          </div>
        </div>

        {template.variables.length > 0 && (
          <div>
            <div className="text-xs text-gray-600 mb-1">Variables:</div>
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, 3).map((variable) => (
                <Badge key={variable} variant="outline" className="text-xs">
                  {variable}
                </Badge>
              ))}
              {template.variables.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{template.variables.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={onUse} className="flex-1">
            <Copy className="h-3 w-3 mr-1" />
            Use
          </Button>
          <Button size="sm" variant="outline" onClick={onPreview}>
            <Eye className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  template,
  categories,
  onSave,
  onCancel,
}: {
  template?: DocumentTemplate;
  categories: TemplateCategory[];
  onSave: (data: TemplateFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: template || {
      name: "",
      category: "",
      description: "",
      content: "",
      variables: [],
    },
  });

  const content = form.watch("content");

  // Extract variables from content
  React.useEffect(() => {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = content.matchAll(variableRegex);
    const variables = Array.from(new Set(Array.from(matches, (m) => m[1].trim())));
    form.setValue("variables", variables);
  }, [content, form]);

  const handleSubmit = async (data: TemplateFormData) => {
    setIsSubmitting(true);
    try {
      await onSave(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "Create New Template"}</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Grievance Report Template" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this template is for..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Content *</FormLabel>
                    <FormDescription>
                      Use {`{{variable_name}}`} for placeholders that will be filled in when
                      using the template
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter your template content here..."
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(() => {
                const variables = form.watch("variables");
                return variables && variables.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium mb-2">Detected Variables:</h4>
                    <div className="flex flex-wrap gap-2">
                      {variables.map((variable) => (
                        <Badge key={variable} variant="secondary">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : template ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

