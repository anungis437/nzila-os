/**
 * Document Library Browser Component
 * 
 * Comprehensive document management with:
 * - Hierarchical folder structure
 * - File browsing & navigation
 * - Preview capabilities
 * - Search & filtering
 * - Sorting & view modes
 * - Bulk operations
 * 
 * @module components/documents/document-library-browser
 */

"use client";

import * as React from "react";
import {
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileVideo,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  Grid,
  List,
  Search,
  ChevronRight,
  Home,
  Star,
  Eye,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
 
 
 
import { format } from "date-fns";

export interface DocumentItem {
  id: string;
  name: string;
  type: "folder" | "file";
  mimeType?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  parentId: string | null;
  path: string[];
  starred?: boolean;
  tags?: string[];
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
}

export interface DocumentLibraryBrowserProps {
  items: DocumentItem[];
  currentFolderId?: string | null;
  onNavigate?: (folderId: string | null) => void;
  onDownload?: (item: DocumentItem) => void;
  onDelete?: (items: DocumentItem[]) => void;
  onShare?: (item: DocumentItem) => void;
  onPreview?: (item: DocumentItem) => void;
  onUpload?: () => void;
  onToggleStar?: (item: DocumentItem) => void;
}

export function DocumentLibraryBrowser({
  items,
  currentFolderId,
  onNavigate,
  onDownload,
  onDelete,
  onShare,
  onPreview,
  onUpload,
  onToggleStar,
}: DocumentLibraryBrowserProps) {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortBy, setSortBy] = React.useState<"name" | "date" | "size">("name");
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());
  const [filterType, setFilterType] = React.useState<"all" | "folders" | "files">("all");

  // Get current folder path
  const currentPath = React.useMemo(() => {
    if (!currentFolderId) return [{ id: null, name: "Documents" }];
    
    const folder = items.find((item) => item.id === currentFolderId);
    if (!folder) return [{ id: null, name: "Documents" }];
    
    return [
      { id: null, name: "Documents" },
      ...folder.path.map((pathId) => {
        const pathItem = items.find((item) => item.id === pathId);
        return { id: pathId, name: pathItem?.name || "Unknown" };
      }),
      { id: folder.id, name: folder.name },
    ];
  }, [currentFolderId, items]);

  // Filter and sort items
  const displayItems = React.useMemo(() => {
    let filtered = items.filter((item) => item.parentId === currentFolderId);

    // Type filter
    if (filterType === "folders") {
      filtered = filtered.filter((item) => item.type === "folder");
    } else if (filterType === "files") {
      filtered = filtered.filter((item) => item.type === "file");
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      // Folders first
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "date":
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case "size":
          return (b.size || 0) - (a.size || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, currentFolderId, filterType, searchTerm, sortBy]);

  const handleSelectItem = (itemId: string, selected: boolean) => {
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(displayItems.map((item) => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleDeleteSelected = () => {
    const itemsToDelete = displayItems.filter((item) => selectedItems.has(item.id));
    onDelete?.(itemsToDelete);
    setSelectedItems(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Library</h2>
          <Breadcrumbs path={currentPath} onNavigate={onNavigate} />
        </div>
        <Button onClick={onUpload}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="folders">Folders Only</SelectItem>
                <SelectItem value="files">Files Only</SelectItem>
              </SelectContent>
            </Select>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="size">Sort by Size</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-1 border rounded-md">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium">
                {selectedItems.size} item(s) selected
              </span>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItems(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === "list" ? (
        <ListView
          items={displayItems}
          selectedItems={selectedItems}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
          onNavigate={onNavigate}
          onDownload={onDownload}
          onShare={onShare}
          onPreview={onPreview}
          onToggleStar={onToggleStar}
        />
      ) : (
        <GridView
          items={displayItems}
          selectedItems={selectedItems}
          onSelectItem={handleSelectItem}
          onNavigate={onNavigate}
          onDownload={onDownload}
          onShare={onShare}
          onPreview={onPreview}
          onToggleStar={onToggleStar}
        />
      )}

      {displayItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-gray-600">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Upload documents to get started"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: { id: string | null; name: string }[];
  onNavigate?: (folderId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
      {path.map((segment, index) => (
        <React.Fragment key={segment.id || "root"}>
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          <button
            onClick={() => onNavigate?.(segment.id)}
            className="hover:text-gray-900 transition-colors"
          >
            {index === 0 && <Home className="h-3 w-3 inline mr-1" />}
            {segment.name}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function ListView({
  items,
  selectedItems,
  onSelectItem,
  onSelectAll,
  onNavigate,
  onDownload,
  onShare,
  onPreview,
  onToggleStar,
}: {
  items: DocumentItem[];
  selectedItems: Set<string>;
  onSelectItem: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onNavigate?: (folderId: string | null) => void;
  onDownload?: (item: DocumentItem) => void;
  onShare?: (item: DocumentItem) => void;
  onPreview?: (item: DocumentItem) => void;
  onToggleStar?: (item: DocumentItem) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-4 flex items-center gap-4 bg-gray-50">
          <Checkbox
            checked={selectedItems.size === items.length && items.length > 0}
            onCheckedChange={onSelectAll}
          />
          <div className="flex-1 font-medium">Name</div>
          <div className="w-32 font-medium">Modified</div>
          <div className="w-24 font-medium">Size</div>
          <div className="w-10"></div>
        </div>

        <div className="divide-y">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
            >
              <Checkbox
                checked={selectedItems.has(item.id)}
                onCheckedChange={(checked) => onSelectItem(item.id, !!checked)}
              />

              <div
                className="flex-1 flex items-center gap-3 cursor-pointer"
                onClick={() => {
                  if (item.type === "folder") {
                    onNavigate?.(item.id);
                  } else {
                    onPreview?.(item);
                  }
                }}
              >
                <FileIcon item={item} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="text-sm text-gray-600">
                    by {item.createdBy.name}
                  </div>
                </div>
                {item.starred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
              </div>

              <div className="w-32 text-sm text-gray-600">
                {format(item.updatedAt, "MMM d, yyyy")}
              </div>

              <div className="w-24 text-sm text-gray-600">
                {item.type === "file" && item.size ? formatFileSize(item.size) : "-"}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {item.type === "file" && (
                    <DropdownMenuItem onClick={() => onPreview?.(item)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  {item.type === "file" && item.permissions.canView && (
                    <DropdownMenuItem onClick={() => onDownload?.(item)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                  )}
                  {item.permissions.canShare && (
                    <DropdownMenuItem onClick={() => onShare?.(item)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onToggleStar?.(item)}>
                    <Star className="h-4 w-4 mr-2" />
                    {item.starred ? "Unstar" : "Star"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {item.permissions.canDelete && (
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GridView({
  items,
  selectedItems,
  onSelectItem,
  onNavigate,
  onDownload: _onDownload,
  onShare: _onShare,
  onPreview,
  onToggleStar: _onToggleStar,
}: {
  items: DocumentItem[];
  selectedItems: Set<string>;
  onSelectItem: (id: string, selected: boolean) => void;
  onNavigate?: (folderId: string | null) => void;
  onDownload?: (item: DocumentItem) => void;
  onShare?: (item: DocumentItem) => void;
  onPreview?: (item: DocumentItem) => void;
  onToggleStar?: (item: DocumentItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card
          key={item.id}
          className={cn(
            "relative hover:shadow-md transition-shadow cursor-pointer",
            selectedItems.has(item.id) && "ring-2 ring-blue-500"
          )}
        >
          <CardContent className="p-4">
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedItems.has(item.id)}
                onCheckedChange={(checked) => onSelectItem(item.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {item.starred && (
              <div className="absolute top-2 right-2 z-10">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              </div>
            )}

            <div
              className="space-y-3"
              onClick={() => {
                if (item.type === "folder") {
                  onNavigate?.(item.id);
                } else {
                  onPreview?.(item);
                }
              }}
            >
              <div className="flex items-center justify-center h-24 bg-gray-100 rounded-lg">
                <FileIcon item={item} className="h-12 w-12" />
              </div>

              <div>
                <div className="font-medium text-sm truncate" title={item.name}>
                  {item.name}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {item.type === "file" && item.size ? formatFileSize(item.size) : "Folder"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FileIcon({ item, className }: { item: DocumentItem; className?: string }) {
  const iconClass = cn("text-gray-600", className);

  if (item.type === "folder") {
    return <Folder className={iconClass} />;
  }

  if (!item.mimeType) {
    return <File className={iconClass} />;
  }

  if (item.mimeType.startsWith("image/")) {
    return <ImageIcon className={iconClass} />;
  }

  if (item.mimeType.includes("spreadsheet") || item.mimeType.includes("excel")) {
    return <FileSpreadsheet className={iconClass} />;
  }

  if (item.mimeType.startsWith("video/")) {
    return <FileVideo className={iconClass} />;
  }

  if (item.mimeType.includes("pdf") || item.mimeType.includes("document")) {
    return <FileText className={iconClass} />;
  }

  return <File className={iconClass} />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

