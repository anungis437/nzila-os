/**
 * Document Browser Component - Phase 11
 * 
 * Visual grid/list browser for documents with thumbnails, filters, and batch operations.
 * Provides comprehensive document management interface with advanced search capabilities.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Image as ImageIcon,
  FileArchive,
  File,
  Grid3x3,
  List,
  Search,
  Download,
  Trash2,
  Tag,
  FolderOpen,
  SortAsc,
  SortDesc,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Share2,
  MoreVertical,
  User,
  FileType,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react';
 
import { format } from 'date-fns';

interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  thumbnail_url: string | null;
  storage_path: string;
  uploaded_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
  uploaded_at: string;
  tags: string[];
  folder_path: string | null;
  ocr_text: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
}

interface DocumentBrowserProps {
  onDocumentSelect?: (document: Document) => void;
  selectionMode?: 'single' | 'multiple' | 'none';
  filterByType?: string[];
  defaultView?: 'grid' | 'list';
}

const FILE_TYPE_ICONS = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  gif: ImageIcon,
  zip: FileArchive,
  rar: FileArchive,
  default: File,
};

const FILE_TYPE_COLORS = {
  pdf: 'text-red-500',
  doc: 'text-blue-500',
  docx: 'text-blue-500',
  txt: 'text-gray-500',
  jpg: 'text-green-500',
  jpeg: 'text-green-500',
  png: 'text-green-500',
  gif: 'text-green-500',
  zip: 'text-yellow-500',
  rar: 'text-yellow-500',
  default: 'text-gray-400',
};

export function DocumentBrowser({
  onDocumentSelect: _onDocumentSelect,
  selectionMode = 'none',
  filterByType,
  defaultView = 'grid',
}: DocumentBrowserProps) {
  const _router = useRouter();
  const searchParams = useSearchParams();

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Data state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [fileTypeFilter, setFileTypeFilter] = useState<string[]>(filterByType || []);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [uploadedByFilter, setUploadedByFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [folderPath, _setFolderPath] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, _setPageSize] = useState(24);
  const [totalCount, setTotalCount] = useState(0);

  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Available filters
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string }>>([]);

  /**
   * Fetch documents with filters
   */
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (fileTypeFilter.length > 0) params.append('file_types', fileTypeFilter.join(','));
      if (dateRange?.start) params.append('start_date', dateRange.start);
      if (dateRange?.end) params.append('end_date', dateRange.end);
      if (uploadedByFilter.length > 0) params.append('uploaded_by', uploadedByFilter.join(','));
      if (tagFilter.length > 0) params.append('tags', tagFilter.join(','));
      if (folderPath) params.append('folder_path', folderPath);
      params.append('sort_by', sortBy);
      params.append('sort_direction', sortDirection);
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());

      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data.documents);
      setTotalCount(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, fileTypeFilter, dateRange, uploadedByFilter, tagFilter, folderPath, sortBy, sortDirection, page, pageSize]);

  /**
   * Fetch available filter options
   */
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/filters');
      if (!response.ok) throw new Error('Failed to fetch filters');

      const data = await response.json();
      setAvailableTags(data.tags);
      setAvailableUsers(data.users);
    } catch (_err) {
}
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  /**
   * Handle document selection
   */
  const handleDocumentSelect = (documentId: string) => {
    if (selectionMode === 'none') return;

    setSelectedDocuments((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(documentId)) {
        newSelection.delete(documentId);
      } else {
        if (selectionMode === 'single') {
          newSelection.clear();
        }
        newSelection.add(documentId);
      }
      return newSelection;
    });
  };

  /**
   * Handle select all
   */
  const _handleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map((d) => d.id)));
    }
  };

  /**
   * Handle batch download
   */
  const handleBatchDownload = async () => {
    try {
      const documentIds = Array.from(selectedDocuments);
      const response = await fetch('/api/documents/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: documentIds }),
      });

      if (!response.ok) throw new Error('Failed to download documents');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents-${format(new Date(), 'yyyy-MM-dd')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download documents');
    }
  };

  /**
   * Handle batch delete
   */
  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedDocuments.size} document(s)?`)) return;

    try {
      const documentIds = Array.from(selectedDocuments);
      const response = await fetch('/api/documents/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: documentIds }),
      });

      if (!response.ok) throw new Error('Failed to delete documents');

      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete documents');
    }
  };

  /**
   * Handle batch tag
   */
  const handleBatchTag = async (tags: string[]) => {
    try {
      const documentIds = Array.from(selectedDocuments);
      const response = await fetch('/api/documents/batch-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: documentIds, tags }),
      });

      if (!response.ok) throw new Error('Failed to tag documents');

      setSelectedDocuments(new Set());
      fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to tag documents');
    }
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  /**
   * Get file icon
   */
  const getFileIcon = (fileType: string) => {
    const extension = fileType.toLowerCase().replace('.', '');
    const Icon = FILE_TYPE_ICONS[extension as keyof typeof FILE_TYPE_ICONS] || FILE_TYPE_ICONS.default;
    const colorClass = FILE_TYPE_COLORS[extension as keyof typeof FILE_TYPE_COLORS] || FILE_TYPE_COLORS.default;
    return { Icon, colorClass };
  };

  /**
   * Render document grid item
   */
  const renderGridItem = (document: Document) => {
    const { Icon, colorClass } = getFileIcon(document.file_type);
    const isSelected = selectedDocuments.has(document.id);

    return (
      <Card
        key={document.id}
        className={`cursor-pointer transition-all hover:shadow-lg ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => handleDocumentSelect(document.id)}
      >
        <CardContent className="p-4">
          {selectionMode !== 'none' && (
            <div className="absolute top-2 left-2 z-10">
              <Checkbox checked={isSelected} />
            </div>
          )}
          
          <div className="relative aspect-square mb-3 bg-muted rounded-lg overflow-hidden">
            {document.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={document.thumbnail_url}
                alt={document.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon className={`w-16 h-16 ${colorClass}`} />
              </div>
            )}
            
            <div className="absolute top-2 right-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 hover:bg-white">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPreviewDocument(document)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm truncate" title={document.title}>
              {document.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="uppercase">{document.file_type}</span>
              <span>â€¢</span>
              <span>{formatFileSize(document.file_size)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(document.uploaded_at), 'MMM d, yyyy')}
            </div>
            {document.tags && document.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {document.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {document.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{document.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * Render document list item
   */
  const renderListItem = (document: Document) => {
    const { Icon, colorClass } = getFileIcon(document.file_type);
    const isSelected = selectedDocuments.has(document.id);

    return (
      <div
        key={document.id}
        className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => handleDocumentSelect(document.id)}
      >
        {selectionMode !== 'none' && (
          <Checkbox checked={isSelected} />
        )}

        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0">
          {document.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={document.thumbnail_url}
              alt={document.title}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <Icon className={`w-6 h-6 ${colorClass}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{document.title}</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="uppercase">{document.file_type}</span>
            <span>â€¢</span>
            <span>{formatFileSize(document.file_size)}</span>
            <span>â€¢</span>
            <span>
              {document.uploaded_by.first_name} {document.uploaded_by.last_name}
            </span>
            <span>â€¢</span>
            <span>{format(new Date(document.uploaded_at), 'MMM d, yyyy')}</span>
          </div>
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {document.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPreviewDocument(document)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasSelection = selectedDocuments.size > 0;

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {totalCount} document{totalCount !== 1 ? 's' : ''} total
                {hasSelection && ` â€¢ ${selectedDocuments.size} selected`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setViewMode('grid')}>
                <Grid3x3 className={`h-4 w-4 ${viewMode === 'grid' ? 'text-primary' : ''}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setViewMode('list')}>
                <List className={`h-4 w-4 ${viewMode === 'list' ? 'text-primary' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents, OCR text, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={fetchDocuments}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileType className="mr-2 h-4 w-4" />
                  File Type
                  {fileTypeFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {fileTypeFilter.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {['pdf', 'doc', 'docx', 'txt', 'jpg', 'png', 'zip'].map((type) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={fileTypeFilter.includes(type)}
                    onCheckedChange={(checked) => {
                      setFileTypeFilter((prev) =>
                        checked ? [...prev, type] : prev.filter((t) => t !== type)
                      );
                    }}
                  >
                    {type.toUpperCase()}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="mr-2 h-4 w-4" />
                  Tags
                  {tagFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tagFilter.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={tagFilter.includes(tag)}
                    onCheckedChange={(checked) => {
                      setTagFilter((prev) =>
                        checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                      );
                    }}
                  >
                    {tag}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <User className="mr-2 h-4 w-4" />
                  Uploaded By
                  {uploadedByFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {uploadedByFilter.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableUsers.map((user) => (
                  <DropdownMenuCheckboxItem
                    key={user.id}
                    checked={uploadedByFilter.includes(user.id)}
                    onCheckedChange={(checked) => {
                      setUploadedByFilter((prev) =>
                        checked ? [...prev, user.id] : prev.filter((id) => id !== user.id)
                      );
                    }}
                  >
                    {user.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {sortDirection === 'asc' ? (
                    <SortAsc className="mr-2 h-4 w-4" />
                  ) : (
                    <SortDesc className="mr-2 h-4 w-4" />
                  )}
                  Sort: {sortBy}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('date')}>Date</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('size')}>Size</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('type')}>Type</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortDirection('asc')}>Ascending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortDirection('desc')}>Descending</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {(fileTypeFilter.length > 0 || tagFilter.length > 0 || uploadedByFilter.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFileTypeFilter([]);
                  setTagFilter([]);
                  setUploadedByFilter([]);
                  setDateRange(null);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Batch Actions */}
          {hasSelection && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedDocuments.size} selected
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleBatchDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBatchTag(['new-tag'])}>
                <Tag className="mr-2 h-4 w-4" />
                Add Tags
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Grid/List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchDocuments} className="mt-4">
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents found</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {documents.map(renderGridItem)}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(renderListItem)}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of{' '}
              {totalCount} documents
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewDocument && (
        <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>{previewDocument.title}</DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">{zoomLevel}%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setPreviewDocument(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogDescription>
                {previewDocument.file_type.toUpperCase()} â€¢ {formatFileSize(previewDocument.file_size)} â€¢
                Uploaded by {previewDocument.uploaded_by.first_name}{' '}
                {previewDocument.uploaded_by.last_name} on{' '}
                {format(new Date(previewDocument.uploaded_at), 'MMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="preview" className="mt-4">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                {previewDocument.ocr_text && <TabsTrigger value="ocr">OCR Text</TabsTrigger>}
              </TabsList>

              <TabsContent value="preview" className="overflow-auto max-h-[60vh]">
                {previewDocument.file_type.match(/image/) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewDocument.storage_path}
                    alt={previewDocument.title}
                    style={{ width: `${zoomLevel}%` }}
                    className="mx-auto"
                  />
                ) : previewDocument.file_type === 'pdf' ? (
                  <iframe
                    src={previewDocument.storage_path}
                    className="w-full h-full min-h-[60vh]"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Preview not available for this file type</p>
                    <Button variant="outline" className="mt-4">
                      <Download className="mr-2 h-4 w-4" />
                      Download to View
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>File Name</Label>
                    <p className="text-sm text-muted-foreground">{previewDocument.file_name}</p>
                  </div>
                  <div>
                    <Label>File Type</Label>
                    <p className="text-sm text-muted-foreground">
                      {previewDocument.file_type.toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <Label>File Size</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(previewDocument.file_size)}
                    </p>
                  </div>
                  <div>
                    <Label>Uploaded</Label>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(previewDocument.uploaded_at), 'PPP')}
                    </p>
                  </div>
                  {previewDocument.folder_path && (
                    <div>
                      <Label>Folder</Label>
                      <p className="text-sm text-muted-foreground">{previewDocument.folder_path}</p>
                    </div>
                  )}
                  {previewDocument.tags && previewDocument.tags.length > 0 && (
                    <div className="col-span-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {previewDocument.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {previewDocument.ocr_text && (
                <TabsContent value="ocr" className="overflow-auto max-h-[60vh]">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{previewDocument.ocr_text}</p>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

