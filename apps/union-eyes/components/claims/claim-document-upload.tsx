/**
 * Claim Document Upload Component
 * 
 * Advanced file upload with:
 * - Drag and drop
 * - Multiple file selection
 * - File type validation
 * - Size validation
 * - Upload progress
 * - Preview thumbnails
 * - Remove uploaded files
 * 
 * @module components/claims/claim-document-upload
 */

"use client";

import * as React from "react";
import {
  Upload,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  url?: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export interface ClaimDocumentUploadProps {
  onUpload: (files: File[]) => Promise<string[]>; // Returns URLs
  onRemove?: (fileId: string) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/quicktime",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ClaimDocumentUpload({
  onUpload,
  onRemove,
  maxFiles = 10,
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
}: ClaimDocumentUploadProps) {
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];

    Array.from(selectedFiles).forEach((file) => {
      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          progress: 0,
          status: "error",
          error: "File type not supported",
        });
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          progress: 0,
          status: "error",
          error: `File size exceeds ${formatBytes(maxSize)}`,
        });
        return;
      }

      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith("image/")) {
        preview = URL.createObjectURL(file);
      }

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        progress: 0,
        status: "pending",
      });
    });

    setFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles));

    // Auto-upload valid files
    const validFiles = newFiles
      .filter((f) => f.status === "pending")
      .map((f) => f.file);
    
    if (validFiles.length > 0) {
      handleUpload(newFiles.map((f) => f.id), validFiles);
    }
  };

  const handleUpload = async (fileIds: string[], filesToUpload: File[]) => {
    // Set uploading status
    setFiles((prev) =>
      prev.map((f) =>
        fileIds.includes(f.id) ? { ...f, status: "uploading" as const } : f
      )
    );

    try {
      // Simulate progress (in real implementation, track actual upload progress)
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            fileIds.includes(f.id) && f.progress < 90
              ? { ...f, progress: f.progress + 10 }
              : f
          )
        );
      }, 200);

      const urls = await onUpload(filesToUpload);

      clearInterval(progressInterval);

      // Update with success
      setFiles((prev) =>
        prev.map((f, _index) =>
          fileIds.includes(f.id)
            ? {
                ...f,
                progress: 100,
                status: "success" as const,
                url: urls[fileIds.indexOf(f.id)],
              }
            : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          fileIds.includes(f.id)
            ? {
                ...f,
                status: "error" as const,
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const handleRemove = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    onRemove?.(fileId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        )}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium text-blue-600">Click to upload</span> or
          drag and drop
        </p>
        <p className="text-xs text-gray-500">
          {acceptedTypes.includes("image/") && "Images, "}
          {acceptedTypes.includes("application/pdf") && "PDFs, "}
          {acceptedTypes.includes("audio/") && "Audio, "}
          {acceptedTypes.includes("video/") && "Video "}
          up to {formatBytes(maxSize)}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onRemove={() => handleRemove(file.id)}
            />
          ))}
        </div>
      )}

      {/* Status */}
      {files.length > 0 && (
        <div className="text-sm text-gray-600">
          {files.length} file{files.length !== 1 ? "s" : ""} •{" "}
          {files.filter((f) => f.status === "success").length} uploaded •{" "}
          {files.filter((f) => f.status === "error").length} failed
        </div>
      )}
    </div>
  );
}

function FileItem({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const Icon = getFileIcon(file.file.type);

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-white">
      {/* Icon/Preview */}
      <div className="shrink-0">
        {file.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.preview}
            alt={file.file.name}
            className="h-12 w-12 object-cover rounded"
          />
        ) : (
          <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded">
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon className="h-6 w-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          {file.status === "success" && (
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          )}
          {file.status === "error" && (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          {file.status === "uploading" && (
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
          )}
        </div>

        <p className="text-xs text-gray-500">{formatBytes(file.file.size)}</p>

        {file.status === "uploading" && (
          <Progress value={file.progress} className="h-1 mt-2" />
        )}

        {file.status === "error" && file.error && (
          <p className="text-xs text-red-600 mt-1">{file.error}</p>
        )}
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

