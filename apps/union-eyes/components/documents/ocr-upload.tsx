/**
 * Document OCR Upload Component
 * 
 * OCR-enabled document upload with:
 * - Drag-and-drop file upload
 * - Multiple file support
 * - Progress indicators
 * - OCR processing status
 * - Text extraction preview
 * - Confidence scores
 * - Manual correction interface
 * - Batch processing
 * 
 * @module components/documents/ocr-upload
 */

"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Image as _ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Eye,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OCRFile {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  ocrText?: string;
  confidence?: number;
  error?: string;
  documentId?: string;
}

interface OCRUploadProps {
  onUploadComplete?: (files: OCRFile[]) => void;
  folderId?: string;
  maxFiles?: number;
  acceptedFormats?: string[];
  autoProcessOCR?: boolean;
}

export function OCRUpload({
  onUploadComplete,
  folderId,
  maxFiles = 10,
  acceptedFormats = ["image/*", "application/pdf"],
  autoProcessOCR = true,
}: OCRUploadProps) {
  const [files, setFiles] = useState<OCRFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<OCRFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (files.length + acceptedFiles.length > maxFiles) {
        toast({
          title: "Too many files",
          description: `You can only upload up to ${maxFiles} files at once.`,
          variant: "destructive",
        });
        return;
      }

      const newFiles: OCRFile[] = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
        status: "pending",
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...newFiles]);

      if (autoProcessOCR) {
        newFiles.forEach((file) => processFile(file));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files.length, maxFiles, autoProcessOCR]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => ({ ...acc, [format]: [] }), {}),
    maxFiles,
  });

  const processFile = async (ocrFile: OCRFile) => {
    // Step 1: Upload file
    updateFileStatus(ocrFile.id, { status: "uploading", progress: 0 });

    try {
      const formData = new FormData();
      formData.append("file", ocrFile.file);
      if (folderId) {
        formData.append("folderId", folderId);
      }
      formData.append("title", ocrFile.file.name);

      // Simulate upload progress
      for (let i = 0; i <= 50; i += 10) {
        updateFileStatus(ocrFile.id, { progress: i });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const uploadResponse = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const { document } = await uploadResponse.json();
      updateFileStatus(ocrFile.id, {
        documentId: document.id,
        progress: 60,
      });

      // Step 2: Process OCR
      updateFileStatus(ocrFile.id, {
        status: "processing",
        progress: 70,
      });

      const ocrResponse = await fetch(`/api/documents/${document.id}/ocr`, {
        method: "POST",
      });

      if (!ocrResponse.ok) {
        throw new Error("OCR processing failed");
      }

      const { text, confidence } = await ocrResponse.json();

      updateFileStatus(ocrFile.id, {
        status: "completed",
        progress: 100,
        ocrText: text,
        confidence,
      });

      toast({
        title: "Processing complete",
        description: `${ocrFile.file.name} has been uploaded and processed.`,
      });
    } catch (error) {
      updateFileStatus(ocrFile.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Processing failed",
      });

      toast({
        title: "Processing failed",
        description: `Failed to process ${ocrFile.file.name}`,
        variant: "destructive",
      });
    }
  };

  const updateFileStatus = (fileId: string, updates: Partial<OCRFile>) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId ? { ...file, ...updates } : file
      )
    );
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const retryFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      updateFileStatus(fileId, {
        status: "pending",
        progress: 0,
        error: undefined,
      });
      processFile(file);
    }
  };

  const handlePreview = (file: OCRFile) => {
    setSelectedFile(file);
    setShowPreview(true);
  };

  const handleSaveCorrections = async (correctedText: string) => {
    if (!selectedFile || !selectedFile.documentId) return;

    try {
      const response = await fetch(`/api/documents/${selectedFile.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText: correctedText }),
      });

      if (!response.ok) {
        throw new Error("Failed to save corrections");
      }

      updateFileStatus(selectedFile.id, { ocrText: correctedText });
      setShowPreview(false);

      toast({
        title: "Corrections saved",
        description: "OCR text has been updated successfully.",
      });
    } catch (_error) {
      toast({
        title: "Save failed",
        description: "Failed to save corrections. Please try again.",
        variant: "destructive",
      });
    }
  };

  const completedFiles = files.filter((f) => f.status === "completed");
  const processingFiles = files.filter(
    (f) => f.status === "uploading" || f.status === "processing"
  );
  const errorFiles = files.filter((f) => f.status === "error");

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Documents with OCR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports images and PDFs (up to {maxFiles} files)
                </p>
              </>
            )}
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Files ({files.length})</h4>
                {completedFiles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUploadComplete?.(completedFiles)}
                  >
                    Complete Upload
                  </Button>
                )}
              </div>

              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">
                    All ({files.length})
                  </TabsTrigger>
                  <TabsTrigger value="processing">
                    Processing ({processingFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed ({completedFiles.length})
                  </TabsTrigger>
                  {errorFiles.length > 0 && (
                    <TabsTrigger value="errors">
                      Errors ({errorFiles.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="all" className="space-y-2">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onRemove={removeFile}
                      onRetry={retryFile}
                      onPreview={handlePreview}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="processing" className="space-y-2">
                  {processingFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onRemove={removeFile}
                      onRetry={retryFile}
                      onPreview={handlePreview}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="completed" className="space-y-2">
                  {completedFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onRemove={removeFile}
                      onRetry={retryFile}
                      onPreview={handlePreview}
                    />
                  ))}
                </TabsContent>

                {errorFiles.length > 0 && (
                  <TabsContent value="errors" className="space-y-2">
                    {errorFiles.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        onRemove={removeFile}
                        onRetry={retryFile}
                        onPreview={handlePreview}
                      />
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {selectedFile && (
        <OCRPreviewDialog
          file={selectedFile}
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onSave={handleSaveCorrections}
        />
      )}
    </div>
  );
}

// File Card Component
function FileCard({
  file,
  onRemove,
  onRetry,
  onPreview,
}: {
  file: OCRFile;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPreview: (file: OCRFile) => void;
}) {
  const getStatusIcon = () => {
    switch (file.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "uploading":
      case "processing":
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<OCRFile["status"], "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      uploading: "default",
      processing: "default",
      completed: "default",
      error: "destructive",
    };

    return (
      <Badge variant={variants[file.status]} className="capitalize">
        {file.status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          {file.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.preview}
              alt={file.file.name}
              className="w-16 h-16 object-cover rounded"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                {getStatusBadge()}
              </div>
            </div>

            {(file.status === "uploading" || file.status === "processing") && (
              <div className="space-y-1">
                <Progress value={file.progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {file.status === "uploading" ? "Uploading..." : "Processing OCR..."}
                </p>
              </div>
            )}

            {file.status === "completed" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">
                    OCR Complete
                    {file.confidence && ` (${Math.round(file.confidence)}% confidence)`}
                  </span>
                </div>
                {file.ocrText && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {file.ocrText}
                  </p>
                )}
              </div>
            )}

            {file.status === "error" && (
              <p className="text-sm text-red-600">{file.error}</p>
            )}

            <div className="flex gap-2 mt-2">
              {file.status === "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreview(file)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              )}
              {file.status === "error" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(file.id)}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(file.id)}
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// OCR Preview Dialog
function OCRPreviewDialog({
  file,
  open,
  onClose,
  onSave,
}: {
  file: OCRFile;
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [editedText, setEditedText] = useState(file.ocrText || "");
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>OCR Preview - {file.file.name}</DialogTitle>
          <DialogDescription>
            {file.confidence && (
              <span>Confidence: {Math.round(file.confidence)}%</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 h-[500px]">
          <div>
            <h4 className="font-medium mb-2">Original Document</h4>
            <ScrollArea className="h-full border rounded">
              {file.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.preview}
                  alt="Document preview"
                  className="w-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <FileText className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </ScrollArea>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Extracted Text</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "View" : "Edit"}
              </Button>
            </div>
            {isEditing ? (
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="h-full font-mono text-sm resize-none"
              />
            ) : (
              <ScrollArea className="h-full border rounded p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {editedText}
                </pre>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isEditing && (
            <Button onClick={() => onSave(editedText)}>
              Save Corrections
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const blob = new Blob([editedText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${file.file.name}.txt`;
              a.click();
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

