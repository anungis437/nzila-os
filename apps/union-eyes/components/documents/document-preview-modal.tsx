/**
 * Document Preview Modal - Phase 11
 * 
 * Full-screen modal for viewing documents with zoom, metadata, and navigation.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoomIn, ZoomOut, RotateCw, Download, Share2, Trash2, ChevronLeft, ChevronRight, Maximize, Minimize, Eye, FileText, Tag, User, Calendar, HardDrive, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  content_text?: string;
  tags: string[];
  folder_path?: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  updated_at: string;
  version: number;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface DocumentPreviewModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onDelete?: (id: string) => void;
  onDownload?: (document: Document) => void;
  onShare?: (document: Document) => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function DocumentPreviewModal({
  document,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onDelete,
  onDownload,
  onShare,
  hasNext = false,
  hasPrevious = false,
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata' | 'history'>('preview');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [versionHistory, setVersionHistory] = useState<any[]>([]);

  const fetchVersionHistory = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/versions`);
      if (!response.ok) throw new Error('Failed to fetch version history');
      
      const data = await response.json();
      setVersionHistory(data.versions || []);
    } catch (_err) {
setVersionHistory([]);
    }
  }, []);

  // Reset state when document changes
  useEffect(() => {
    if (document) {
      setZoom(100);
      setRotation(0);
      setIsFullscreen(false);
      setActiveTab('preview');
      fetchVersionHistory(document.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, fetchVersionHistory]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen || !document) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext && onNext) onNext();
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(100);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, document, hasNext, hasPrevious, onNext, onPrevious, onClose]);

  if (!document) return null;

  /**
   * Zoom controls
   */
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const _handleZoomReset = () => {
    setZoom(100);
  };

  /**
   * Rotation controls
   */
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  /**
   * Fullscreen toggle
   */
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  /**
   * Action handlers
   */
  const handleDownload = () => {
    if (onDownload) {
      onDownload(document);
    } else {
      // Default download behavior
      const link = window.document.createElement('a');
      link.href = document.file_url;
      link.download = document.name;
      link.click();
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare(document);
    } else {
      // Default share behavior - copy link
      navigator.clipboard.writeText(document.file_url);
      alert('Link copied to clipboard!');
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${document.name}"?`)) {
      if (onDelete) {
        onDelete(document.id);
      }
    }
  };

  /**
   * Render document preview based on file type
   */
  const renderPreview = () => {
    const fileType = document.file_type.toLowerCase();
    const style = {
      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
      transformOrigin: 'center',
      transition: 'transform 0.2s ease',
    };

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType)) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={document.file_url}
            alt={document.name}
            style={style}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    // PDFs
    if (fileType === 'pdf') {
      return (
        <div className="w-full h-full">
          <iframe
            src={`${document.file_url}#zoom=${zoom}`}
            title={document.name}
            className="w-full h-full border-0"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      );
    }

    // Videos
    if (['mp4', 'webm', 'ogg'].includes(fileType)) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-black">
          <video
            src={document.file_url}
            controls
            style={style}
            className="max-w-full max-h-full"
          >
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    // Audio
    if (['mp3', 'wav', 'ogg', 'flac'].includes(fileType)) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-center space-y-4">
            <FileText className="h-24 w-24 mx-auto text-muted-foreground" />
            <audio src={document.file_url} controls className="w-full max-w-md" />
          </div>
        </div>
      );
    }

    // Text files with OCR content
    if (document.content_text) {
      return (
        <div className="w-full h-full p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {document.content_text}
            </pre>
          </div>
        </div>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center space-y-4">
          <FileText className="h-24 w-24 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">Preview not available</p>
            <p className="text-sm text-muted-foreground">
              This file type cannot be previewed in the browser
            </p>
            <Button onClick={handleDownload} className="mt-4">
              <Download className="mr-2 h-4 w-4" />
              Download to view
            </Button>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={isFullscreen ? 'max-w-full h-screen' : 'max-w-7xl h-[90vh]'}>
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate">{document.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{document.file_type.toUpperCase()}</Badge>
                <span>{formatFileSize(document.file_size)}</span>
                <span>â€¢</span>
                <span>Version {document.version}</span>
              </DialogDescription>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 25}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">{zoom}%</span>
              <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 300}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-4 h-[calc(100%-80px)]">
          {/* Main Preview Area */}
          <div className="flex-1 flex flex-col">
            {/* Navigation Controls */}
            {(hasNext || hasPrevious) && (
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrevious}
                  disabled={!hasPrevious}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Preview */}
            <div className="flex-1 border rounded-lg overflow-hidden bg-muted/20">
              {renderPreview()}
            </div>
          </div>

          {/* Sidebar with Tabs */}
          <div className="w-80 border-l pl-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <FileText className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="history">
                  <Clock className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>

              {/* Preview Info Tab */}
              <TabsContent value="preview" className="mt-4">
                <ScrollArea className="h-[calc(90vh-200px)]">
                  <div className="space-y-6">
                    {/* Description */}
                    {document.description && (
                      <div>
                        <h3 className="font-semibold mb-2">Description</h3>
                        <p className="text-sm text-muted-foreground">{document.description}</p>
                      </div>
                    )}

                    {/* Tags */}
                    {document.tags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="h-4 w-4" />
                          <h3 className="font-semibold">Tags</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {document.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* File Info */}
                    <div>
                      <h3 className="font-semibold mb-3">File Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Name</p>
                            <p className="text-sm text-muted-foreground">{document.name}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <HardDrive className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Size</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(document.file_size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Type</p>
                            <p className="text-sm text-muted-foreground">
                              {document.file_type.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        {document.folder_path && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Location</p>
                              <p className="text-sm text-muted-foreground">
                                {document.folder_path}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload Info */}
                    <div>
                      <h3 className="font-semibold mb-3">Upload Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Uploaded by</p>
                            <p className="text-sm text-muted-foreground">
                              {document.uploaded_by_name || document.uploaded_by}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Uploaded</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(document.uploaded_at), 'PPpp')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Last modified</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(document.updated_at), 'PPpp')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="mt-4">
                <ScrollArea className="h-[calc(90vh-200px)]">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Additional Metadata</h3>
                      {document.metadata && Object.keys(document.metadata).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(document.metadata).map(([key, value]) => (
                            <div key={key} className="border-b pb-2">
                              <p className="text-sm font-medium capitalize">
                                {key.replace(/_/g, ' ')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {typeof value === 'object'
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No additional metadata</p>
                      )}
                    </div>

                    {/* OCR Content */}
                    {document.content_text && (
                      <div>
                        <h3 className="font-semibold mb-3">Extracted Text (OCR)</h3>
                        <div className="bg-muted p-3 rounded-lg">
                          <pre className="text-xs whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                            {document.content_text}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Version History Tab */}
              <TabsContent value="history" className="mt-4">
                <ScrollArea className="h-[calc(90vh-200px)]">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Version History</h3>
                    {versionHistory.length > 0 ? (
                      <div className="space-y-3">
                        {versionHistory.map((version) => (
                          <div key={version.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge>Version {version.version}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(version.created_at), 'PPp')}
                              </span>
                            </div>
                            {version.description && (
                              <p className="text-sm">{version.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{version.uploaded_by_name}</span>
                              <span>â€¢</span>
              <span>{formatFileSize(version.file_size)}</span>
                            </div>
                            <Button variant="outline" size="sm" className="w-full">
                              <Download className="mr-2 h-3 w-3" />
                              Download this version
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No version history available
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

