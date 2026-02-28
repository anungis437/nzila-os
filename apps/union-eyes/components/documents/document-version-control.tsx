/**
 * Document Version Control Component
 * 
 * Version history management with:
 * - Version timeline
 * - Compare versions
 * - Restore capabilities
 * - Change tracking
 * - Version comments
 * - Download versions
 * 
 * @module components/documents/document-version-control
 */

"use client";

import * as React from "react";
import {
  Clock,
  Download,
  RotateCcw,
  GitBranch,
  User,
  FileText,
  Eye,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
 
import { format, formatDistanceToNow } from "date-fns";

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  size: number;
  comment?: string;
  changes?: {
    type: "created" | "updated" | "minor" | "major";
    summary?: string;
  };
  isCurrent: boolean;
  downloadUrl: string;
}

export interface DocumentInfo {
  id: string;
  name: string;
  currentVersion: number;
  totalVersions: number;
}

export interface DocumentVersionControlProps {
  document: DocumentInfo;
  versions: DocumentVersion[];
  onDownload?: (version: DocumentVersion) => void;
  onRestore?: (version: DocumentVersion) => Promise<void>;
  onPreview?: (version: DocumentVersion) => void;
  onCompare?: (version1: DocumentVersion, version2: DocumentVersion) => void;
}

export function DocumentVersionControl({
  document,
  versions,
  onDownload,
  onRestore,
  onPreview,
  onCompare,
}: DocumentVersionControlProps) {
  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false);
  const [selectedVersion, setSelectedVersion] = React.useState<DocumentVersion | null>(null);
  const [restoreComment, setRestoreComment] = React.useState("");
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [compareMode, setCompareMode] = React.useState(false);
  const [compareVersions, setCompareVersions] = React.useState<DocumentVersion[]>([]);

  const currentVersion = versions.find((v) => v.isCurrent);

  const handleRestore = async () => {
    if (!selectedVersion || !onRestore) return;

    setIsRestoring(true);
    try {
      await onRestore(selectedVersion);
      setRestoreDialogOpen(false);
      setRestoreComment("");
      setSelectedVersion(null);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCompareSelect = (version: DocumentVersion) => {
    if (compareVersions.find((v) => v.id === version.id)) {
      setCompareVersions(compareVersions.filter((v) => v.id !== version.id));
    } else if (compareVersions.length < 2) {
      setCompareVersions([...compareVersions, version]);
    }
  };

  const handleCompare = () => {
    if (compareVersions.length === 2 && onCompare) {
      onCompare(compareVersions[0], compareVersions[1]);
      setCompareMode(false);
      setCompareVersions([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Version History</h2>
          <div className="flex gap-2">
            {!compareMode ? (
              <Button
                variant="outline"
                onClick={() => setCompareMode(true)}
                disabled={versions.length < 2}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Compare Versions
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleCompare}
                  disabled={compareVersions.length !== 2}
                >
                  Compare Selected
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompareMode(false);
                    setCompareVersions([]);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-gray-600">{document.name}</p>
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
                <div className="text-2xl font-bold">v{document.currentVersion}</div>
                <div className="text-sm text-gray-600">Current Version</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{document.totalVersions}</div>
                <div className="text-sm text-gray-600">Total Versions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium">Last Updated</div>
                <div className="text-sm text-gray-600">
                  {currentVersion && format(currentVersion.createdAt, "MMM d, yyyy")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compare Mode Alert */}
      {compareMode && (
        <Alert>
          <GitBranch className="h-4 w-4" />
          <AlertDescription>
            Select two versions to compare. ({compareVersions.length}/2 selected)
          </AlertDescription>
        </Alert>
      )}

      {/* Version Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Version Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-6">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            {versions.map((version, index) => (
              <VersionItem
                key={version.id}
                version={version}
                isFirst={index === 0}
                compareMode={compareMode}
                isSelected={compareVersions.some((v) => v.id === version.id)}
                onSelect={() => handleCompareSelect(version)}
                onDownload={() => onDownload?.(version)}
                onPreview={() => onPreview?.(version)}
                onRestore={() => {
                  setSelectedVersion(version);
                  setRestoreDialogOpen(true);
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore version {selectedVersion?.versionNumber}? This
              will create a new version with the content from the selected version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedVersion && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Version {selectedVersion.versionNumber}</span>
                  <Badge variant="outline">
                    {format(selectedVersion.createdAt, "MMM d, yyyy")}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">
                  by {selectedVersion.createdBy.name}
                </div>
                {selectedVersion.comment && (
                  <div className="text-sm mt-2">{selectedVersion.comment}</div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="restoreComment">Restore Comment (Optional)</Label>
              <Textarea
                id="restoreComment"
                placeholder="Explain why you&apos;re restoring this version..."
                value={restoreComment}
                onChange={(e) => setRestoreComment(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The current version will be preserved. Restoring creates a new version with
                the old content.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restoring..." : "Restore Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionItem({
  version,
  isFirst: _isFirst,
  compareMode,
  isSelected,
  onSelect,
  onDownload,
  onPreview,
  onRestore,
}: {
  version: DocumentVersion;
  isFirst: boolean;
  compareMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onPreview: () => void;
  onRestore: () => void;
}) {
  const changeTypeConfig = {
    created: { label: "Created", color: "bg-green-500" },
    updated: { label: "Updated", color: "bg-blue-500" },
    minor: { label: "Minor Update", color: "bg-gray-500" },
    major: { label: "Major Update", color: "bg-purple-500" },
  };

  const config = version.changes
    ? changeTypeConfig[version.changes.type]
    : changeTypeConfig.updated;

  return (
    <div className="relative pl-12">
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-[0.6rem] w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center",
          version.isCurrent ? "border-blue-500" : "border-gray-300",
          compareMode && isSelected && "border-purple-500"
        )}
      >
        {version.isCurrent ? (
          <CheckCircle2 className="h-3 w-3 text-blue-500" />
        ) : compareMode && isSelected ? (
          <CheckCircle2 className="h-3 w-3 text-purple-500" />
        ) : (
          <div className={cn("w-2 h-2 rounded-full", config.color)} />
        )}
      </div>

      <Card
        className={cn(
          "transition-all",
          compareMode && "cursor-pointer hover:shadow-md",
          isSelected && "ring-2 ring-purple-500"
        )}
        onClick={compareMode ? onSelect : undefined}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">Version {version.versionNumber}</h4>
              {version.isCurrent && (
                <Badge variant="default">Current</Badge>
              )}
              {version.changes && (
                <Badge variant="outline">{config.label}</Badge>
              )}
            </div>
            <span className="text-sm text-gray-600">
              {formatDistanceToNow(version.createdAt, { addSuffix: true })}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{version.createdBy.name}</span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">
                {formatFileSize(version.size)}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">
                {format(version.createdAt, "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>

            {version.comment && (
              <p className="text-sm text-gray-700 italic">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                "{version.comment}"
              </p>
            )}

            {version.changes?.summary && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                {version.changes.summary}
              </div>
            )}

            {!compareMode && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPreview}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownload}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                {!version.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRestore}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

