'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, File, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface AttachmentMetadata {
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface FileUploadProps {
  claimId: string;
  existingAttachments?: AttachmentMetadata[];
  onUploadComplete?: (attachment: AttachmentMetadata) => void;
  onDeleteComplete?: (url: string) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function FileUpload({
  claimId,
  existingAttachments = [],
  onUploadComplete,
  onDeleteComplete,
  maxFiles = 10,
  disabled = false,
}: FileUploadProps) {
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>(existingAttachments);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const handleUpload = useCallback(async (file: File) => {
    if (attachments.length >= maxFiles) {
      toast({
        title: 'Maximum files reached',
        description: `You can only upload up to ${maxFiles} files per claim.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('claimId', claimId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      const newAttachment = data.attachment;
      setAttachments(prev => [...prev, newAttachment]);
      
      toast({
        title: 'Upload successful',
        description: `${file.name} has been uploaded.`,
      });

      onUploadComplete?.(newAttachment);
    } catch (error) {
toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [attachments.length, maxFiles, claimId, toast, onUploadComplete]);

  const handleDelete = async (attachment: AttachmentMetadata) => {
    try {
      const response = await fetch(
        `/api/upload?claimId=${claimId}&fileUrl=${encodeURIComponent(attachment.url)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      setAttachments(prev => prev.filter(a => a.url !== attachment.url));
      
      toast({
        title: 'File removed',
        description: `${attachment.fileName} has been removed.`,
      });

      onDeleteComplete?.(attachment.url);
    } catch (error) {
toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleUpload(files[0]);
      }
    },
    [disabled, handleUpload]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
    // Reset input so same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={`p-8 border-2 border-dashed transition-all ${
          dragActive
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-gray-300 dark:border-gray-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={disabled || uploading}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          aria-label="Upload file"
        />

        <div className="flex flex-col items-center justify-center text-center">
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uploading file...
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supports: Images, PDF, Word, Excel, Text files (Max 10MB)
              </p>
              {attachments.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {attachments.length} of {maxFiles} files uploaded
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Attachments ({attachments.length})
          </h4>
          
          <AnimatePresence>
            {attachments.map((attachment) => (
              <motion.div
                key={attachment.url}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    {/* File Icon */}
                    <div className="shrink-0">
                      {getFileIcon(attachment.fileType)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(attachment.fileSize)} â€¢ {new Date(attachment.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        View
                      </Button>
                      
                      {!disabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(attachment)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

