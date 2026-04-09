"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BatchSummary {
  id: string;
  sourceSystem: string;
  status: string;
  totalRecords: number;
  succeeded: number;
  failed: number;
  skipped: number;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  durationMs: number | null;
}

interface MetricsSummary {
  totalBatches: number;
  totalRecords: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
  successRate: number;
  failureRate: number;
  duplicateGroupsTotal: number;
  duplicateGroupsPending: number;
  qualityWarningsTotal: number;
  qualityWarningsUnresolved: number;
}

interface BatchesResponse {
  batches: BatchSummary[];
  total: number;
  metrics: MetricsSummary;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle className="mr-1 h-3 w-3" />Partial</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
    case "processing":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="mr-1 h-3 w-3" />Processing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MigrationsConsole() {
  const router = useRouter();
  const [data, setData] = useState<BatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/ingest/batches?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metrics = data?.metrics;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            Migration Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Observability for data migrations and imports
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ─── Metrics Summary (§10) ─────────────────────────────────────── */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{metrics.totalBatches}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{metrics.successRate}%</div>
              <p className="text-xs text-muted-foreground">{metrics.totalSucceeded.toLocaleString()} / {metrics.totalRecords.toLocaleString()} records</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Duplicates</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{metrics.duplicateGroupsPending}</div>
              <p className="text-xs text-muted-foreground">{metrics.duplicateGroupsTotal} total groups</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Quality Warnings</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{metrics.qualityWarningsUnresolved}</div>
              <p className="text-xs text-muted-foreground">{metrics.qualityWarningsTotal} total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Status Filter ─────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {["", "completed", "partial", "failed", "processing"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      {/* ─── Batch Table ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Succeeded</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.batches.map((batch) => (
                <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{batch.sourceSystem}</TableCell>
                  <TableCell>{statusBadge(batch.status)}</TableCell>
                  <TableCell className="text-right">{batch.totalRecords}</TableCell>
                  <TableCell className="text-right text-green-600">{batch.succeeded}</TableCell>
                  <TableCell className="text-right text-red-600">{batch.failed}</TableCell>
                  <TableCell>{formatDuration(batch.durationMs)}</TableCell>
                  <TableCell>{formatDate(batch.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/admin/migrations/${batch.id}`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (!data?.batches || data.batches.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No migration batches found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
