/**
 * Inspection Report Viewer Component
 * 
 * Displays completed inspection results with:
 * - All checklist responses
 * - Failed items highlighted
 * - Photos and attachments
 * - Corrective actions needed
 * - Export/print functionality
 * 
 * @module components/health-safety/InspectionReportViewer
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Download,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface InspectionResult {
  category: string;
  item: string;
  status: "pass" | "fail" | "na";
  notes?: string;
  photos?: string[];
  isCritical: boolean;
}

export interface InspectionReport {
  id: string;
  title: string;
  date: Date;
  inspector: string;
  location: string;
  status: "completed" | "pending_review" | "approved";
  results: InspectionResult[];
  generalNotes?: string;
  passCount: number;
  failCount: number;
  naCount: number;
  totalCount: number;
  complianceRate: number;
}

export interface InspectionReportViewerProps {
  inspectionId: string;
}

export function InspectionReportViewer({ inspectionId }: InspectionReportViewerProps) {
  const { toast } = useToast();
  const [report, setReport] = React.useState<InspectionReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  async function loadReport() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/health-safety/inspections/${inspectionId}/report`);

      if (!response.ok) {
        throw new Error("Failed to load inspection report");
      }

      const data = await response.json();
      if (data.success) {
        setReport({
          ...data.report,
          date: new Date(data.report.date)
        });
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to load inspection report",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function exportReport() {
    try {
      const response = await fetch(`/api/health-safety/inspections/${inspectionId}/export`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inspection-${inspectionId}.pdf`;
      a.click();

      toast({
        title: "Success",
        description: "Inspection report exported"
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive"
      });
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "na":
        return <MinusCircle className="h-5 w-5 text-gray-600" />;
      default:
        return null;
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Report not found</p>
        </CardContent>
      </Card>
    );
  }

  // Group results by category
  const categories = Array.from(new Set(report.results.map(r => r.category)));
  const failedItems = report.results.filter(r => r.status === "fail");

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{report.title}</CardTitle>
              <CardDescription>Inspection Report</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Inspection Date</p>
                <p className="text-sm text-muted-foreground">
                  {format(report.date, "PPP")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Inspector</p>
                <p className="text-sm text-muted-foreground">{report.inspector}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{report.location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge>{report.status.replace(/_/g, ' ')}</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">{report.complianceRate}%</p>
              <p className="text-xs text-muted-foreground">Compliance Rate</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-green-600">{report.passCount}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-red-600">{report.failCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{report.naCount}</p>
              <p className="text-xs text-muted-foreground">N/A</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Failed Items Alert */}
      {failedItems.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Items Requiring Attention ({failedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {failedItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-1 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      {item.item}
                      {item.isCritical && (
                        <Badge variant="outline" className="ml-2 text-xs">Critical</Badge>
                      )}
                    </p>
                    {item.notes && (
                      <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Results by Category */}
      {categories.map(category => {
        const categoryResults = report.results.filter(r => r.category === category);

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{category}</CardTitle>
              <CardDescription>
                {categoryResults.filter(r => r.status === "pass").length} of{" "}
                {categoryResults.filter(r => r.status !== "na").length} passed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryResults.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3 p-3 border rounded-lg",
                      result.status === "fail" && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                    )}
                  >
                    <div className="mt-0.5">
                      {getStatusIcon(result.status)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {result.item}
                          {result.isCritical && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Critical
                            </Badge>
                          )}
                        </p>
                        <Badge
                          variant={
                            result.status === "pass"
                              ? "default"
                              : result.status === "fail"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shrink-0"
                        >
                          {result.status.toUpperCase()}
                        </Badge>
                      </div>

                      {result.notes && (
                        <p className="text-sm text-muted-foreground">
                          {result.notes}
                        </p>
                      )}

                      {result.photos && result.photos.length > 0 && (
                        <div className="flex gap-2">
                          {result.photos.map((photo, photoIndex) => (
                            <a
                              key={photoIndex}
                              href={photo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo}
                                alt={`Photo ${photoIndex + 1}`}
                                className="w-20 h-20 object-cover rounded border hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* General Notes */}
      {report.generalNotes && (
        <Card>
          <CardHeader>
            <CardTitle>General Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {report.generalNotes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
