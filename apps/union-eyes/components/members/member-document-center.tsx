/**
 * Member Document Center Component
 * 
 * Centralized document management for members with:
 * - Document upload and storage
 * - Category/folder organization
 * - Version control
 * - Preview functionality
 * - Access control
 * - Search and filter
 * 
 * @module components/members/member-document-center
 */

"use client";

import * as React from "react";
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Upload,
  Download,
  Eye,
  Trash,
  FolderOpen,
  Clock,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/components/ui/use-toast";
 
import { format } from "date-fns";

export interface MemberDocument {
  id: string;
  name: string;
  type: "pdf" | "image" | "video" | "audio" | "other";
  category: "personal" | "employment" | "medical" | "legal" | "grievance" | "other";
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  lastAccessed?: Date;
  version: number;
  isConfidential: boolean;
}

export interface MemberDocumentCenterProps {
  memberId: string;
  memberName: string;
  documents: MemberDocument[];
  onUpload: (file: File, category: string) => Promise<void>;
  onDownload: (document: MemberDocument) => void;
  onPreview: (document: MemberDocument) => void;
  onDelete: (id: string) => Promise<void>;
}

const categories = [
  { value: "personal", label: "Personal", color: "blue" },
  { value: "employment", label: "Employment", color: "green" },
  { value: "medical", label: "Medical", color: "red" },
  { value: "legal", label: "Legal", color: "purple" },
  { value: "grievance", label: "Grievance", color: "orange" },
  { value: "other", label: "Other", color: "gray" },
];

export function MemberDocumentCenter({
  memberId: _memberId,
  memberName,
  documents,
  onUpload,
  onDownload,
  onPreview,
  onDelete,
}: MemberDocumentCenterProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const [_viewMode, _setViewMode] = React.useState<"grid" | "list">("list");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Filter documents
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !searchQuery ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        filterCategory === "all" || doc.category === filterCategory;

      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, filterCategory]);

  // Group by category
  const documentsByCategory = React.useMemo(() => {
    const grouped: Record<string, MemberDocument[]> = {};
    filteredDocuments.forEach((doc) => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = [];
      }
      grouped[doc.category].push(doc);
    });
    return grouped;
  }, [filteredDocuments]);

  // Statistics
  const stats = React.useMemo(() => {
    const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
    const confidentialCount = documents.filter((doc) => doc.isConfidential).length;
    return {
      total: documents.length,
      totalSize,
      confidential: confidentialCount,
    };
  }, [documents]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await onUpload(file, filterCategory === "all" ? "other" : filterCategory);
      toast({ title: "Document uploaded successfully" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await onDelete(id);
      toast({ title: "Document deleted successfully" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Center</h2>
          <p className="text-gray-600">{memberName}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatBytes(stats.totalSize)}</div>
                <div className="text-sm text-gray-600">Total Size</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.confidential}</div>
                <div className="text-sm text-gray-600">Confidential</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents by Category */}
      <div className="space-y-6">
        {Object.entries(documentsByCategory).map(([category, docs]) => {
          const categoryConfig = categories.find((c) => c.value === category);
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  {categoryConfig?.label || category}
                  <Badge variant="secondary">{docs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      document={doc}
                      onPreview={() => onPreview(doc)}
                      onDownload={() => onDownload(doc)}
                      onDelete={() => handleDelete(doc.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDocuments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No documents found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  onPreview,
  onDownload,
  onDelete,
}: {
  document: MemberDocument;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const getFileIcon = () => {
    switch (document.type) {
      case "image":
        return <FileImage className="h-5 w-5 text-blue-600" />;
      case "video":
        return <FileVideo className="h-5 w-5 text-purple-600" />;
      case "audio":
        return <FileAudio className="h-5 w-5 text-green-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="shrink-0 w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
        {getFileIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium truncate">{document.name}</span>
          {document.isConfidential && (
            <Badge variant="destructive" className="text-xs">
              Confidential
            </Badge>
          )}
          {document.version > 1 && (
            <Badge variant="outline" className="text-xs">
              v{document.version}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{formatBytes(document.size)}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(document.uploadedAt, "PPp")}
          </span>
          <span>•</span>
          <span>{document.uploadedBy}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onPreview}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

