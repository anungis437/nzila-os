/**
 * Inspection Report Viewer Component
 *
 * Shows one safety inspection as it is recorded:
 * - Every checklist result, with failed and attention items highlighted
 * - The recorded score, findings, observations and recommendations
 *
 * It reads the inspection itself (GET /api/health-safety/inspections/{id}). There is no report-generation or PDF export
 * service, so nothing is exported or offered for download from here.
 *
 * @module components/health-safety/InspectionReportViewer
 */

"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

export interface InspectionResult {
  item: string;
  /** The status the checklist recorded: pass, fail, na or requires_attention. Anything else is shown as recorded. */
  status: string;
  notes?: string;
}

export interface InspectionReport {
  id: string;
  inspectionNumber: string;
  title: string;
  /** The completion date, or the scheduled date while the inspection is not completed. */
  date: Date | null;
  dateLabel: "Completed" | "Scheduled";
  inspector: string | null;
  location: string | null;
  status: string;
  checklistName: string | null;
  results: InspectionResult[];
  passCount: number;
  failCount: number;
  attentionCount: number;
  naCount: number;
  /** The score recorded on the inspection; null when none was recorded, which is not 0%. */
  scorePercentage: number | null;
  sections: { label: string; text: string }[];
}

export interface InspectionReportViewerProps {
  inspectionId: string;
}

const TEXT_SECTIONS = [
  ["findings", "Findings"],
  ["observations", "Observations"],
  ["positiveFindings", "Positive findings"],
  ["areasOfConcern", "Areas of concern"],
  ["recommendations", "Recommendations"],
  ["notes", "Notes"],
] as const;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Reads the inspection out of the route's { success, data: { data: row } } envelope. Anything else is an error, never an empty report. */
export function toInspectionReport(body: unknown): InspectionReport {
  const row = (body as { data?: { data?: unknown } } | null)?.data?.data;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Unexpected inspection response");
  }
  const record = row as Record<string, unknown>;
  // The number and the status are never empty in the database: a row without them is not an inspection this screen can show.
  const id = asText(record.id);
  const inspectionNumber = asText(record.inspectionNumber);
  const status = asText(record.status);
  if (!id || !inspectionNumber || !status) throw new Error("Unexpected inspection response");

  // A checklist that was never filled in is null; anything else that is not a list is not what the route stores.
  const checklist = record.checklistItems;
  if (checklist !== null && checklist !== undefined && !Array.isArray(checklist)) throw new Error("Unexpected inspection response");
  const entries: unknown[] = Array.isArray(checklist) ? checklist : [];

  // An entry that lacks its text or its status is shown with a dash for what it lacks: it is not given a made-up name or status.
  const results: InspectionResult[] = entries.map((entry) => {
    const fields = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const notes = asText(fields.notes);
    return {
      item: asText(fields.item) ?? "—",
      status: asText(fields.status) ?? "—",
      ...(notes ? { notes } : {}),
    };
  });
  const count = (status: string) => results.filter((result) => result.status === status).length;

  const score = record.scorePercentage === null || record.scorePercentage === undefined ? null : Number(record.scorePercentage);
  const completed = asDate(record.completedDate);

  return {
    id,
    inspectionNumber,
    title: asText(record.inspectionScope) ?? asText(record.checklistUsed) ?? `Inspection ${inspectionNumber}`,
    date: completed ?? asDate(record.scheduledDate),
    dateLabel: completed ? "Completed" : "Scheduled",
    inspector: asText(record.leadInspectorName),
    location: asText(record.workplaceName) ?? asText(record.specificLocation),
    status,
    checklistName: asText(record.checklistUsed),
    results,
    passCount: count("pass"),
    failCount: count("fail"),
    attentionCount: count("requires_attention"),
    naCount: count("na"),
    scorePercentage: score !== null && Number.isFinite(score) ? score : null,
    sections: TEXT_SECTIONS.flatMap(([key, label]) => {
      const text = asText(record[key]);
      return text ? [{ label, text }] : [];
    }),
  };
}

type LoadState = {
  inspectionId: string;
  report: InspectionReport | null;
  error: "not_found" | "failed" | null;
};

function getStatusIcon(status: string) {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "fail":
      return <XCircle className="h-5 w-5 text-red-600" />;
    case "requires_attention":
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    default:
      return <MinusCircle className="h-5 w-5 text-gray-600" />;
  }
}

function getStatusBadgeVariant(status: string) {
  if (status === "pass") return "default" as const;
  if (status === "fail") return "destructive" as const;
  return "secondary" as const;
}

export function InspectionReportViewer({ inspectionId }: InspectionReportViewerProps) {
  const { toast } = useToast();
  const [state, setState] = React.useState<LoadState | null>(null);
  // The answer belongs to the inspection it was asked for: a different inspection is loading until its own answer arrives.
  const current = state !== null && state.inspectionId === inspectionId ? state : null;

  React.useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const response = await fetch(`/api/health-safety/inspections/${encodeURIComponent(inspectionId)}`);
        if (response.status === 404) {
          if (!cancelled) setState({ inspectionId, report: null, error: "not_found" });
          return;
        }
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const report = toInspectionReport(await response.json());
        if (!cancelled) setState({ inspectionId, report, error: null });
      } catch (error) {
        if (cancelled) return;
        logger.error("Failed to load the inspection", error);
        setState({ inspectionId, report: null, error: "failed" });
        toast({
          title: "Error",
          description: "Failed to load inspection",
          variant: "destructive"
        });
      }
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [inspectionId, toast]);

  if (!current) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const report = current.report;
  if (!report) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p role={current.error === "failed" ? "alert" : undefined} className="text-center text-muted-foreground">
            {current.error === "not_found" ? "Inspection not found" : "The inspection could not be loaded"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const needsAttention = report.results.filter(r => r.status === "fail" || r.status === "requires_attention");
  const hasResults = report.results.length > 0;
  const figure = (value: number) => (hasResults ? value : "—");
  const answered = report.passCount + report.failCount + report.attentionCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{report.title}</CardTitle>
            {report.title !== `Inspection ${report.inspectionNumber}` && (
              <CardDescription>Inspection {report.inspectionNumber}</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{report.dateLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {report.date ? format(report.date, "PPP") : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Inspector</p>
                <p className="text-sm text-muted-foreground">{report.inspector ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{report.location ?? "—"}</p>
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
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold">{report.scorePercentage === null ? "—" : `${report.scorePercentage}%`}</p>
              <p className="text-xs text-muted-foreground">Recorded Score</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-green-600">{figure(report.passCount)}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-red-600">{figure(report.failCount)}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{figure(report.attentionCount)}</p>
              <p className="text-xs text-muted-foreground">Needs Attention</p>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{figure(report.naCount)}</p>
              <p className="text-xs text-muted-foreground">N/A</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items needing attention */}
      {needsAttention.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Items Requiring Attention ({needsAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {needsAttention.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  {getStatusIcon(item.status)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      {item.item}
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

      {/* Checklist results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{report.checklistName ?? "Checklist results"}</CardTitle>
          <CardDescription>
            {hasResults
              ? `${report.passCount} of ${answered} passed`
              : "No checklist results have been recorded for this inspection."}
          </CardDescription>
        </CardHeader>
        {hasResults && (
          <CardContent>
            <div className="space-y-3">
              {report.results.map((result, index) => (
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
                      <p className="text-sm font-medium">{result.item}</p>
                      <Badge variant={getStatusBadgeVariant(result.status)} className="shrink-0">
                        {result.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>

                    {result.notes && (
                      <p className="text-sm text-muted-foreground">
                        {result.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Recorded findings and notes */}
      {report.sections.map(section => (
        <Card key={section.label}>
          <CardHeader>
            <CardTitle>{section.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {section.text}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
