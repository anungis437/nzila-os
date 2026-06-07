/**
 * Bulk Import Members Component
 * 
 * Upload and import multiple union members from CSV/Excel files.
 * Features:
 * - CSV/Excel file upload with drag & drop
 * - Import preview with validation
 * - Error reporting with row numbers
 * - Progress tracking
 * - Download template file
 * - Duplicate membership number detection
 * 
 * @module components/admin/bulk-import-members
 */

"use client";

import { useState, useCallback } from "react";
import { Upload, Download, AlertCircle, CheckCircle, X, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preview: any[];
}

interface BulkImportMembersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  organizationId?: string;
}

export function BulkImportMembers({
  open,
  onOpenChange,
  onSuccess,
  organizationId,
}: BulkImportMembersProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Download CSV template
  const downloadTemplate = useCallback(() => {
    const headers = [
      "organizationSlug",
      "name",
      "email",
      "membershipNumber",
      "phone",
      "status",
      "role",
      "joinedDate",
      "department",
      "position",
      "hireDate",
    ];

    const exampleRow = [
      "unifor-local-444",
      "Jane Smith",
      "jane.smith@example.com",
      "M-12345",
      "+1-555-0100",
      "active",
      "member",
      "2024-01-15",
      "Assembly Line",
      "Production Worker",
      "2023-06-01",
    ];

    const csv = [headers.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "members-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // Preview import
  const previewImport = useCallback(async (fileToPreview: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", fileToPreview);
      formData.append("preview", "true");
      if (organizationId) {
        formData.append("organizationId", organizationId);
      }

      const response = await fetch("/api/admin/members/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to preview import");
      }

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview import");
    } finally {
      setIsUploading(false);
    }
  }, [organizationId]);

  // Handle file selection
  const handleFileChange = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      setPreview(null);
      setImportResult(null);
      setError(null);

      // Validate file type
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      if (!validTypes.includes(selectedFile.type)) {
        setError("Invalid file type. Please upload a CSV or Excel file.");
        setFile(null);
        return;
      }

      // Auto-preview on selection
      previewImport(selectedFile);
    },
    [previewImport]
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileChange(files[0]);
      }
    },
    [handleFileChange]
  );

  // Execute import
  const executeImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (organizationId) {
        formData.append("organizationId", organizationId);
      }

      const response = await fetch("/api/admin/members/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import members");
      }

      setImportResult(data);
      
      if (data.success && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import members");
    } finally {
      setIsImporting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setIsUploading(false);
    setIsImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Members</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import multiple union members at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template with example data
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload Area */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                Drag and drop your file here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                or click to browse
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv,.xls,.xlsx";
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files.length > 0) {
                      handleFileChange(files[0]);
                    }
                  };
                  input.click();
                }}
              >
                Select File
              </Button>
            </div>
          )}

          {/* File Selected */}
          {file && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Analyzing file...
              </p>
              <Progress value={undefined} className="h-2" />
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{preview.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {preview.validRows}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Valid Rows
                  </p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {preview.invalidRows}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Invalid Rows
                  </p>
                </div>
              </div>

              {preview.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Validation Errors</p>
                  <ScrollArea className="h-48 border rounded-lg p-4">
                    <div className="space-y-2">
                      {preview.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Badge variant="destructive" className="shrink-0">
                            Row {err.row}
                          </Badge>
                          <div>
                            <span className="font-medium">{err.field}:</span>{" "}
                            {err.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {preview.errors.length === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    All rows are valid and ready to import!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              {importResult.success ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600 dark:text-green-400">
                    Successfully imported {importResult.created} member(s)!
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Import completed with {importResult.errors.length} error(s).
                    {importResult.created > 0 &&
                      ` ${importResult.created} member(s) were created.`}
                  </AlertDescription>
                </Alert>
              )}

              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Import Errors</p>
                  <ScrollArea className="h-48 border rounded-lg p-4">
                    <div className="space-y-2">
                      {importResult.errors.map((err: ValidationError, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Badge variant="destructive" className="shrink-0">
                            Row {err.row}
                          </Badge>
                          <div>
                            <span className="font-medium">{err.field}:</span>{" "}
                            {err.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {importResult?.success ? "Close" : "Cancel"}
          </Button>
          {!importResult && preview && preview.errors.length === 0 && (
            <Button
              onClick={executeImport}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import Members"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

