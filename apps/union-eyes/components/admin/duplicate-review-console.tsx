"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Merge,
  AlertTriangle,
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

interface DuplicateMember {
  id: string;
  recordType: string;
  recordId: string;
  similarityScore: number | null;
  isAnchor: boolean;
}

interface DuplicateGroup {
  id: string;
  groupType: string;
  status: string;
  autoScore: number | null;
  matchReasons: Array<{ reason: string; score: number; detail?: string }>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  members: DuplicateMember[];
}

interface DuplicatesResponse {
  groups: DuplicateGroup[];
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><AlertTriangle className="mr-1 h-3 w-3" />Pending</Badge>;
    case "confirmed":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><CheckCircle2 className="mr-1 h-3 w-3" />Confirmed</Badge>;
    case "dismissed":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100"><XCircle className="mr-1 h-3 w-3" />Dismissed</Badge>;
    case "merged":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><Merge className="mr-1 h-3 w-3" />Merged</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 0.9) return "text-red-600 font-bold";
  if (score >= 0.8) return "text-amber-600 font-semibold";
  return "text-yellow-600";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DuplicateReviewConsole() {
  const [data, setData] = useState<DuplicatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/duplicates?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (groupId: string, action: "confirm" | "dismiss" | "merge") => {
    setActionLoading(groupId);
    try {
      const res = await fetch("/api/admin/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId, action }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Copy className="h-6 w-6" />
            Duplicate Review
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and resolve detected duplicate records
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["pending", "confirmed", "dismissed", "merged", ""].map((s) => (
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

      {/* Groups */}
      {data?.groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">
                  {group.groupType.charAt(0).toUpperCase() + group.groupType.slice(1)} Duplicate
                </CardTitle>
                {statusBadge(group.status)}
                <span className={`text-sm ${scoreColor(group.autoScore)}`}>
                  Score: {group.autoScore !== null ? (group.autoScore * 100).toFixed(0) + "%" : "—"}
                </span>
              </div>
              {group.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(group.id, "dismiss")}
                    disabled={actionLoading === group.id}
                  >
                    <XCircle className="mr-1 h-3 w-3" /> Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleAction(group.id, "confirm")}
                    disabled={actionLoading === group.id}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(group.id, "merge")}
                    disabled={actionLoading === group.id}
                  >
                    <Merge className="mr-1 h-3 w-3" /> Merge
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Match Reasons */}
            <div className="mb-3 flex flex-wrap gap-2">
              {group.matchReasons.map((r, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {r.reason}: {(r.score * 100).toFixed(0)}%
                  {r.detail && <span className="ml-1 text-muted-foreground">{r.detail}</span>}
                </Badge>
              ))}
            </div>

            {/* Members Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Similarity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.isAnchor ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Anchor</Badge>
                      ) : (
                        <Badge variant="outline">Duplicate</Badge>
                      )}
                    </TableCell>
                    <TableCell>{m.recordType}</TableCell>
                    <TableCell className="font-mono text-xs">{m.recordId}</TableCell>
                    <TableCell className={scoreColor(m.similarityScore)}>
                      {m.similarityScore !== null ? (m.similarityScore * 100).toFixed(0) + "%" : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Reviewed info */}
            {group.reviewedBy && (
              <p className="text-xs text-muted-foreground mt-2">
                Reviewed by {group.reviewedBy} on {group.reviewedAt ? new Date(group.reviewedAt).toLocaleString() : "—"}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {!loading && (!data?.groups || data.groups.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No duplicate groups found
          </CardContent>
        </Card>
      )}
    </div>
  );
}
