/**
 * Federation Resource Library Component
 * 
 * Shared resources and documents library with:
 * - Document categories (forms, guides, templates)
 * - Search and filtering
 * - Upload new resources
 * - Download tracking
 * - Version control
 * - Access permissions
 * 
 * @module components/federation/FederationResourceLibrary
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText,
  Download,
  Eye,
  Upload,
  Search,
  Folder,
  File,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";

export interface Resource {
  id: string;
  title: string;
  description?: string;
  category: "forms" | "guides" | "templates" | "policies" | "reports" | "training";
  fileType: "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "other";
  fileSize: number;
  uploadedBy: string;
  uploadDate: Date;
  lastModified: Date;
  downloadCount: number;
  version: string;
  tags: string[];
  url: string;
}

export interface FederationResourceLibraryProps {
  federationId: string;
}

export function FederationResourceLibrary({
  federationId
}: FederationResourceLibraryProps) {
  const { toast } = useToast();
  const [resources, setResources] = React.useState<Resource[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<"date" | "name" | "downloads">("date");

  React.useEffect(() => {
    loadResources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId]);

  async function loadResources() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/federation/resources?federationId=${federationId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to load resources");
      }

      const data = await response.json();
      if (data.success) {
        setResources(data.resources);
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load resources",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDownload(resourceId: string, title: string) {
    try {
      const response = await fetch(
        `/api/federation/resources/${resourceId}/download`,
        { method: 'POST' }
      );
      
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      a.click();
      
      toast({
        title: "Download Started",
        description: `Downloading ${title}`
      });

      // Refresh to update download count
      loadResources();
    } catch (_error) {
      toast({
        title: "Download Failed",
        description: "Unable to download resource",
        variant: "destructive"
      });
    }
  }

  const filteredAndSortedResources = React.useMemo(() => {
    let filtered = resources;

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "downloads":
        sorted.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case "date":
      default:
        sorted.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
        break;
    }

    return sorted;
  }, [resources, categoryFilter, searchQuery, sortBy]);

  const getCategoryBadge = (category: Resource["category"]) => {
    const variants: Record<Resource["category"], { variant: string; label: string }> = {
      forms: { variant: "default", label: "Forms" },
      guides: { variant: "secondary", label: "Guides" },
      templates: { variant: "outline", label: "Templates" },
      policies: { variant: "secondary", label: "Policies" },
      reports: { variant: "default", label: "Reports" },
      training: { variant: "outline", label: "Training" }
    };
    const config = variants[category];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getFileIcon = (_fileType: Resource["fileType"]) => {
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Resource Library
            </CardTitle>
            <CardDescription>
              Shared documents and resources for federation members
            </CardDescription>
          </div>
          <Button asChild>
            <a href={`/federation/${federationId}/resources/upload`}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Resource
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="forms">Forms</SelectItem>
              <SelectItem value="guides">Guides</SelectItem>
              <SelectItem value="templates">Templates</SelectItem>
              <SelectItem value="policies">Policies</SelectItem>
              <SelectItem value="reports">Reports</SelectItem>
              <SelectItem value="training">Training</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-45">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Most Recent</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
              <SelectItem value="downloads">Most Downloaded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resource List */}
        {filteredAndSortedResources.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No resources found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedResources.map((resource) => (
              <div
                key={resource.id}
                className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* File Icon */}
                  <div className="shrink-0 mt-1">
                    {getFileIcon(resource.fileType)}
                  </div>

                  {/* Resource Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{resource.title}</h3>
                          {getCategoryBadge(resource.category)}
                          <Badge variant="outline" className="text-xs">
                            v{resource.version}
                          </Badge>
                        </div>
                        {resource.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{resource.uploadedBy}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(resource.uploadDate), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        <span>{resource.downloadCount} downloads</span>
                      </div>
                      <div>
                        <span className="font-medium">{formatFileSize(resource.fileSize)}</span>
                      </div>
                      <div>
                        <span className="uppercase">{resource.fileType}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {resource.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {resource.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      title="Preview"
                    >
                      <a href={`/federation/resources/${resource.id}`}>
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(resource.id, resource.title)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{resources.length}</div>
              <div className="text-sm text-muted-foreground">Total Resources</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {resources.reduce((sum, r) => sum + r.downloadCount, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Downloads</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {new Set(resources.map(r => r.category)).size}
              </div>
              <div className="text-sm text-muted-foreground">Categories</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatFileSize(resources.reduce((sum, r) => sum + r.fileSize, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Size</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
