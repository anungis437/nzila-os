"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Info,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecordSummary {
  id: string;
  recordIndex: number;
  recordType: string;
  externalId: string | null;
  status: string;
  resolvedId: string | null;
  errorMessage: string | null;
  fingerprint: string | null;
  processedAt: string | null;
}

interface WarningEntry {
  id: string;
  severity: string;
  category: string;
  fieldName: string | null;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface BatchDetail {
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
  errorSummary: unknown;
  metadata: unknown;
  records: RecordSummary[];
  warnings: WarningEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function recordStatusBadge(status: string) {
  switch (status) {
    case "succeeded":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="mr-1 h-3 w-3" />OK</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
    case "skipped":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Skipped</Badge>;
    case "pending":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function warningSeverityBadge(severity: string) {
  switch (severity) {
    case "error":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Error</Badge>;
    case "warning":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Warning</Badge>;
    case "info":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Info</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  batchId: string;
}

export default function MigrationDetailConsole({ batchId }: Props) {
  const router = useRouter();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ingest/batches/${batchId}`);
      if (res.ok) {
        setBatch(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // §3: Retry failed records
  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const res = await fetch("/api/admin/ingest/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json();
      setRetryResult(data.message ?? "Retry completed");
      await fetchDetail();
    } catch {
      setRetryResult("Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const failedRecords = batch?.records.filter((r) => r.status === "failed") ?? [];
  const succeededRecords = batch?.records.filter((r) => r.status === "succeeded") ?? [];

  if (loading && !batch) {
    return <div className="p-6 text-muted-foreground">Loading batch details...</div>;
  }

  if (!batch) {
    return <div className="p-6 text-muted-foreground">Batch not found</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/admin/migrations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Batch: {batch.sourceSystem}
            </h1>
            <p className="text-muted-foreground text-sm font-mono">{batch.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDetail} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {failedRecords.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
            >
              <RotateCcw className={`mr-1 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              Retry {failedRecords.length} Failed
            </Button>
          )}
        </div>
      </div>

      {retryResult && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 flex items-center gap-2">
          <Info className="h-4 w-4" /> {retryResult}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent>{recordStatusBadge(batch.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Records</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{batch.totalRecords}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Succeeded</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{batch.succeeded}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{batch.failed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Duration</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{batch.durationMs !== null ? `${(batch.durationMs / 1000).toFixed(1)}s` : "—"}</div></CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">
            Records ({batch.records.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({failedRecords.length})
          </TabsTrigger>
          <TabsTrigger value="warnings">
            Warnings ({batch.warnings.length})
          </TabsTrigger>
        </TabsList>

        {/* All Records */}
        <TabsContent value="records">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolved ID</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.records.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.recordIndex}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.externalId ?? "—"}</TableCell>
                      <TableCell>{rec.recordType}</TableCell>
                      <TableCell>{recordStatusBadge(rec.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.resolvedId?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell>{rec.processedAt ? new Date(rec.processedAt).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Records (§2 detail) */}
        <TabsContent value="failed">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>External ID</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Fingerprint</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No failed records
                      </TableCell>
                    </TableRow>
                  )}
                  {failedRecords.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.recordIndex}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.externalId ?? "—"}</TableCell>
                      <TableCell className="text-red-600 max-w-md truncate">{rec.errorMessage ?? "Unknown error"}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.fingerprint?.slice(0, 12) ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Quality Warnings (§9) */}
        <TabsContent value="warnings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.warnings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No quality warnings
                      </TableCell>
                    </TableRow>
                  )}
                  {batch.warnings.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{warningSeverityBadge(w.severity)}</TableCell>
                      <TableCell>{w.category}</TableCell>
                      <TableCell>{w.fieldName ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate">{w.message}</TableCell>
                      <TableCell>
                        {w.resolved ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>
                        ) : (
                          <Badge variant="outline">Open</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
