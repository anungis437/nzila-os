/**
 * Document Bulk Operations Component
 * 
 * Batch document operations with:
 * - Multi-selection
 * - Bulk download
 * - Bulk move/copy
 * - Bulk delete
 * - Bulk tagging
 * - Bulk sharing
 * - Progress tracking
 * 
 * @module components/documents/document-bulk-operations
 */

"use client";

import * as React from "react";
import {
  CheckSquare,
  Download,
  Trash2,
  Move,
  Copy,
  Tag,
  Share2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BulkOperation {
  id: string;
  type: "download" | "delete" | "move" | "copy" | "tag" | "share";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  total: number;
  current: number;
  error?: string;
}

export interface DocumentBulkOperationsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDownload?: () => Promise<void>;
  onBulkDelete?: () => Promise<void>;
  onBulkMove?: (folderId: string) => Promise<void>;
  onBulkCopy?: (folderId: string) => Promise<void>;
  onBulkTag?: (tags: string[]) => Promise<void>;
  onBulkShare?: (permission: string) => Promise<void>;
  folders?: { id: string; name: string }[];
  availableTags?: string[];
}

export function DocumentBulkOperations({
  selectedCount,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
  onBulkMove,
  onBulkCopy,
  onBulkTag,
  onBulkShare,
  folders = [],
  availableTags = [],
}: DocumentBulkOperationsProps) {
  const [operation, setOperation] = React.useState<BulkOperation | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<string>("");
  const [selectedFolder, setSelectedFolder] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");

  if (selectedCount === 0) return null;

  const handleOperation = async (type: string, action: () => Promise<void>) => {
    setOperation({
      id: Date.now().toString(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      status: "running",
      progress: 0,
      total: selectedCount,
      current: 0,
    });

    try {
      await action();
      setOperation((prev) => prev && { ...prev, status: "completed", progress: 100 });
      setTimeout(() => {
        setOperation(null);
        onClearSelection();
      }, 2000);
    } catch (error) {
      setOperation((prev) => prev && { 
        ...prev, 
        status: "failed",
        error: error instanceof Error ? error.message : "Operation failed"
      });
    }
  };

  const openDialog = (type: string) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    setDialogOpen(false);
    
    switch (dialogType) {
      case "move":
        if (onBulkMove && selectedFolder) {
          await handleOperation("move", () => onBulkMove(selectedFolder));
        }
        break;
      case "copy":
        if (onBulkCopy && selectedFolder) {
          await handleOperation("copy", () => onBulkCopy(selectedFolder));
        }
        break;
      case "tag":
        if (onBulkTag && selectedTags.length > 0) {
          await handleOperation("tag", () => onBulkTag(selectedTags));
        }
        break;
      case "delete":
        if (onBulkDelete) {
          await handleOperation("delete", onBulkDelete);
        }
        break;
      case "download":
        if (onBulkDownload) {
          await handleOperation("download", onBulkDownload);
        }
        break;
    }

    // Reset dialog state
    setSelectedFolder("");
    setSelectedTags([]);
    setNewTag("");
  };

  const addTag = () => {
    if (newTag && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag("");
    }
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-blue-600 text-white rounded-lg shadow-2xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            <span className="font-medium">{selectedCount} selected</span>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex gap-2">
            {onBulkDownload && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("download")}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}

            {onBulkMove && folders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("move")}
              >
                <Move className="h-4 w-4 mr-1" />
                Move
              </Button>
            )}

            {onBulkCopy && folders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("copy")}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            )}

            {onBulkTag && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("tag")}
              >
                <Tag className="h-4 w-4 mr-1" />
                Tag
              </Button>
            )}

            {onBulkShare && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("share")}
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => openDialog("delete")}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>

          <div className="h-6 w-px bg-white/20" />

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Operation Progress */}
      {operation && operation.status === "running" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-96">
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing {operation.type}...</span>
                  <span>{operation.current} / {operation.total}</span>
                </div>
                <Progress value={operation.progress} />
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Confirmation Dialogs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "move" && "Move Documents"}
              {dialogType === "copy" && "Copy Documents"}
              {dialogType === "tag" && "Add Tags"}
              {dialogType === "delete" && "Delete Documents"}
              {dialogType === "download" && "Download Documents"}
            </DialogTitle>
            <DialogDescription>
              {selectedCount} document{selectedCount > 1 ? "s" : ""} selected
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(dialogType === "move" || dialogType === "copy") && (
              <div>
                <Label>Destination Folder</Label>
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogType === "tag" && (
              <div className="space-y-3">
                <div>
                  <Label>Add Tags</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Enter tag name..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button onClick={addTag}>Add</Button>
                  </div>
                </div>

                {availableTags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Or select from existing:</Label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedTags(
                              selectedTags.includes(tag)
                                ? selectedTags.filter((t) => t !== tag)
                                : [...selectedTags, tag]
                            );
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Selected Tags:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                          <button
                            onClick={() =>
                              setSelectedTags(selectedTags.filter((t) => t !== tag))
                            }
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {dialogType === "delete" && (
              <Alert variant="destructive">
                <AlertDescription>
                  This action cannot be undone. {selectedCount} document
                  {selectedCount > 1 ? "s" : ""} will be permanently deleted.
                </AlertDescription>
              </Alert>
            )}

            {dialogType === "download" && (
              <Alert>
                <AlertDescription>
                  {selectedCount} document{selectedCount > 1 ? "s" : ""} will be downloaded as a
                  ZIP file.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                (dialogType === "move" || dialogType === "copy") && !selectedFolder ||
                dialogType === "tag" && selectedTags.length === 0
              }
              variant={dialogType === "delete" ? "destructive" : "default"}
            >
              {dialogType === "delete" && "Delete"}
              {dialogType === "move" && "Move"}
              {dialogType === "copy" && "Copy"}
              {dialogType === "tag" && "Add Tags"}
              {dialogType === "download" && "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

