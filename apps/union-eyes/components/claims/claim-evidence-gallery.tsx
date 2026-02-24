/**
 * Claim Evidence Gallery Component
 * 
 * Gallery view for claim evidence with:
 * - Image thumbnails
 * - Lightbox/modal view
 * - Document preview
 * - Audio/video playback
 * - Download functionality
 * - Annotations (future)
 * 
 * @module components/claims/claim-evidence-gallery
 */

"use client";

import * as React from "react";
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  Download,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Evidence {
  id: string;
  name: string;
  type: "image" | "document" | "audio" | "video";
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ClaimEvidenceGalleryProps {
  evidence: Evidence[];
  onDownload?: (evidence: Evidence) => void;
  className?: string;
}

export function ClaimEvidenceGallery({
  evidence,
  onDownload,
  className,
}: ClaimEvidenceGalleryProps) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  const openViewer = (index: number) => {
    setSelectedIndex(index);
    setIsViewerOpen(true);
  };

  const closeViewer = () => {
    setIsViewerOpen(false);
    setSelectedIndex(null);
  };

  const navigatePrevious = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex - 1 + evidence.length) % evidence.length);
  };

  const navigateNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % evidence.length);
  };

  const groupedEvidence = React.useMemo(() => {
    return {
      images: evidence.filter((e) => e.type === "image"),
      documents: evidence.filter((e) => e.type === "document"),
      audio: evidence.filter((e) => e.type === "audio"),
      video: evidence.filter((e) => e.type === "video"),
    };
  }, [evidence]);

  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Images */}
        {groupedEvidence.images.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Images ({groupedEvidence.images.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {groupedEvidence.images.map((item, _index) => (
                <ImageThumbnail
                  key={item.id}
                  evidence={item}
                  onClick={() => openViewer(evidence.indexOf(item))}
                  onDownload={onDownload}
                />
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {groupedEvidence.documents.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents ({groupedEvidence.documents.length})
            </h3>
            <div className="space-y-2">
              {groupedEvidence.documents.map((item) => (
                <DocumentItem
                  key={item.id}
                  evidence={item}
                  onClick={() => openViewer(evidence.indexOf(item))}
                  onDownload={onDownload}
                />
              ))}
            </div>
          </div>
        )}

        {/* Audio */}
        {groupedEvidence.audio.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              Audio ({groupedEvidence.audio.length})
            </h3>
            <div className="space-y-2">
              {groupedEvidence.audio.map((item) => (
                <AudioItem
                  key={item.id}
                  evidence={item}
                  onDownload={onDownload}
                />
              ))}
            </div>
          </div>
        )}

        {/* Video */}
        {groupedEvidence.video.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileVideo className="h-4 w-4" />
              Videos ({groupedEvidence.video.length})
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {groupedEvidence.video.map((item) => (
                <VideoItem
                  key={item.id}
                  evidence={item}
                  onClick={() => openViewer(evidence.indexOf(item))}
                  onDownload={onDownload}
                />
              ))}
            </div>
          </div>
        )}

        {evidence.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FileImage className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No evidence uploaded yet</p>
          </div>
        )}
      </div>

      {/* Viewer Dialog */}
      {selectedIndex !== null && (
        <EvidenceViewer
          evidence={evidence[selectedIndex]}
          isOpen={isViewerOpen}
          onClose={closeViewer}
          onPrevious={navigatePrevious}
          onNext={navigateNext}
          hasPrevious={evidence.length > 1}
          hasNext={evidence.length > 1}
          onDownload={onDownload}
        />
      )}
    </>
  );
}

function ImageThumbnail({
  evidence,
  onClick,
  onDownload,
}: {
  evidence: Evidence;
  onClick: () => void;
  onDownload?: (evidence: Evidence) => void;
}) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden border bg-gray-100 cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={evidence.thumbnailUrl || evidence.url}
        alt={evidence.name}
        className="w-full h-full object-cover transition-transform group-hover:scale-110"
        onClick={onClick}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {onDownload && (
          <Button
            size="icon"
            variant="secondary"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(evidence);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function DocumentItem({
  evidence,
  onClick,
  onDownload,
}: {
  evidence: Evidence;
  onClick: () => void;
  onDownload?: (evidence: Evidence) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 rounded">
        <FileText className="h-5 w-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{evidence.name}</p>
        <p className="text-xs text-gray-500">
          {formatBytes(evidence.size)} • {evidence.mimeType}
        </p>
      </div>
      {onDownload && (
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(evidence);
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function AudioItem({
  evidence,
  onDownload,
}: {
  evidence: Evidence;
  onDownload?: (evidence: Evidence) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium mb-2">{evidence.name}</p>
        <audio controls className="w-full">
          <source src={evidence.url} type={evidence.mimeType} />
          Your browser does not support audio playback.
        </audio>
      </div>
      {onDownload && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDownload(evidence)}
        >
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function VideoItem({
  evidence,
  onClick,
  onDownload,
}: {
  evidence: Evidence;
  onClick: () => void;
  onDownload?: (evidence: Evidence) => void;
}) {
  return (
    <div className="group relative aspect-video rounded-lg overflow-hidden border bg-black cursor-pointer">
      <video
        src={evidence.url}
        className="w-full h-full object-contain"
        onClick={onClick}
      />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onClick}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {onDownload && (
          <Button
            size="icon"
            variant="secondary"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(evidence);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EvidenceViewer({
  evidence,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  onDownload,
}: {
  evidence: Evidence;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  onDownload?: (evidence: Evidence) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate pr-4">{evidence.name}</span>
            <div className="flex items-center gap-2">
              {onDownload && (
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onDownload(evidence)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden min-h-100">
          {/* Navigation */}
          {hasPrevious && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute left-4 z-10"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {hasNext && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute right-4 z-10"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Content */}
          {evidence.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={evidence.url}
              alt={evidence.name}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
          {evidence.type === "video" && (
            <video controls className="max-w-full max-h-[70vh]">
              <source src={evidence.url} type={evidence.mimeType} />
            </video>
          )}
          {evidence.type === "document" && (
            <iframe
              src={evidence.url}
              className="w-full h-[70vh]"
              title={evidence.name}
            />
          )}
          {evidence.type === "audio" && (
            <div className="p-8">
              <FileAudio className="h-24 w-24 text-gray-400 mx-auto mb-6" />
              <audio controls className="w-full">
                <source src={evidence.url} type={evidence.mimeType} />
              </audio>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600">
          {formatBytes(evidence.size)} • Uploaded by {evidence.uploadedBy}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

