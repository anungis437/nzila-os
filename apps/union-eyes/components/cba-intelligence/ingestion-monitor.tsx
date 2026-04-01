"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngestionJob {
  id: string;
  sourceId: string;
  status: string;
  failureClass: string | null;
  documentsFound: number;
  documentsNew: number;
  documentsUpdated: number;
  documentsUnchanged: number;
  documentsFailed: number;
  startedAt: string | null;
  completedAt: string | null;
  triggerType: string;
  adapterVersion: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface JobListResponse {
  success: boolean;
  data: {
    items: IngestionJob[];
    total: number;
    page: number;
    limit: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  running: { label: "Running", variant: "secondary", icon: Loader2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  partial: { label: "Partial", variant: "secondary", icon: AlertTriangle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.round((e - s) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IngestionMonitor() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data, isLoading, error } = useQuery<JobListResponse>({
    queryKey: ["cba-intel-ingestion", page, statusFilter],
    queryFn: () =>
      fetch(`/api/cba-intelligence/ingestion?${queryParams}`).then((r) => r.json()),
    refetchInterval: 10_000, // Poll every 10s for running jobs
  });

  const triggerMutation = useMutation({
    mutationFn: (sourceId: string) =>
      fetch("/api/cba-intelligence/ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, triggerType: "manual" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cba-intel-ingestion"] });
    },
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  // Summary counts
  const running = items.filter((j) => j.status === "running").length;
  const failed = items.filter((j) => j.status === "failed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Ingestion Monitor
            </CardTitle>
            <CardDescription>
              Track ingestion jobs, document discovery, and pipeline health
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {running > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {running} running
              </Badge>
            )}
            {failed > 0 && (
              <Badge variant="destructive">{failed} failed</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading jobs...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-red-500">
                    Failed to load ingestion jobs
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No ingestion jobs found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((job) => {
                  const status = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  const totalDocs =
                    job.documentsNew + job.documentsUpdated + job.documentsUnchanged;
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">
                        {job.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon
                            className={`h-3 w-3 ${job.status === "running" ? "animate-spin" : ""}`}
                          />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {job.triggerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{job.documentsFound}</span> found
                          {totalDocs > 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({job.documentsNew} new, {job.documentsUpdated} updated)
                            </span>
                          )}
                          {job.documentsFailed > 0 && (
                            <span className="text-red-500 ml-1">
                              {job.documentsFailed} failed
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(job.startedAt)}
                      </TableCell>
                      <TableCell>
                        {job.errorMessage && (
                          <span
                            className="text-xs text-red-500 truncate block max-w-[200px]"
                            title={job.errorMessage}
                          >
                            {job.errorMessage}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {total} job{total !== 1 ? "s" : ""} total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
