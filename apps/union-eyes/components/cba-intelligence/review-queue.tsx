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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueCounts {
  findings: number;
  agreements: number;
  wageAdjustments: number;
  clauses: number;
  total: number;
}

interface ReviewItem {
  id: string;
  clauseFamily?: string;
  confidence?: number;
  sourceSpan?: string;
  citationText?: string;
  isInferred?: boolean;
  // Agreement fields
  title?: string;
  employer?: string;
  jurisdiction?: string;
  // Generic
  createdAt: string;
}

interface ReviewQueueResponse {
  success: boolean;
  data: {
    items: ReviewItem[];
    total: number;
    page: number;
    limit: number;
  };
}

interface ReviewCountsResponse {
  success: boolean;
  data: QueueCounts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TARGET_TYPES = [
  { key: "finding", label: "Findings" },
  { key: "agreement", label: "Agreements" },
  { key: "wage_adjustment", label: "Wage Adjustments" },
  { key: "clause", label: "Clauses" },
] as const;

const DECISIONS = [
  { value: "approved", label: "Approve", icon: CheckCircle2, variant: "default" as const },
  { value: "rejected", label: "Reject", icon: XCircle, variant: "destructive" as const },
  { value: "needs_revision", label: "Needs Revision", icon: RotateCcw, variant: "secondary" as const },
];

function confidenceBadge(c: number | null | undefined) {
  if (c == null) return <Badge variant="outline">—</Badge>;
  const pct = Math.round(c * 100);
  if (pct >= 80) return <Badge variant="default">{pct}%</Badge>;
  if (pct >= 50) return <Badge variant="secondary">{pct}%</Badge>;
  return <Badge variant="destructive">{pct}%</Badge>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewQueue() {
  const [activeTab, setActiveTab] = useState("finding");
  const [page, setPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  // Queue counts
  const { data: countsData } = useQuery<ReviewCountsResponse>({
    queryKey: ["cba-intel-review-counts"],
    queryFn: () =>
      fetch("/api/cba-intelligence/review?counts=true").then((r) => r.json()),
  });
  const counts = countsData?.data;

  // Queue items
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "20",
    targetType: activeTab,
  });
  const { data, isLoading, error } = useQuery<ReviewQueueResponse>({
    queryKey: ["cba-intel-review-queue", activeTab, page],
    queryFn: () =>
      fetch(`/api/cba-intelligence/review?${queryParams}`).then((r) => r.json()),
  });

  // Submit review
  const submitMutation = useMutation({
    mutationFn: (payload: {
      targetType: string;
      targetId: string;
      decision: string;
      reason: string;
      comment?: string;
    }) =>
      fetch("/api/cba-intelligence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cba-intel-review"] });
      queryClient.invalidateQueries({ queryKey: ["cba-intel-review-counts"] });
      setReviewingId(null);
      setDecision("");
      setReason("");
      setComment("");
    },
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  function handleSubmit(targetId: string) {
    if (!decision || !reason) return;
    submitMutation.mutate({
      targetType: activeTab,
      targetId,
      decision,
      reason,
      comment: comment || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Review Queue
            </CardTitle>
            <CardDescription>
              Review and approve extracted CBA intelligence data
            </CardDescription>
          </div>
          {counts && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              {counts.total} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); setReviewingId(null); }}>
          <TabsList>
            {TARGET_TYPES.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1">
                {t.label}
                {counts && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {counts[t.key === "wage_adjustment" ? "wageAdjustments" : `${t.key}s` as keyof QueueCounts]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {TARGET_TYPES.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Loading queue...
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-red-500">
                          Failed to load review queue
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No items pending review
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              {item.clauseFamily && (
                                <Badge variant="outline" className="text-xs mb-1">
                                  {item.clauseFamily.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {item.title && (
                                <div className="font-medium">{item.title}</div>
                              )}
                              {item.employer && (
                                <div className="text-sm text-muted-foreground">{item.employer}</div>
                              )}
                              {item.citationText && (
                                <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                                  &ldquo;{item.citationText}&rdquo;
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{confidenceBadge(item.confidence)}</TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {item.jurisdiction && <span>{item.jurisdiction} · </span>}
                              {item.isInferred && (
                                <Badge variant="secondary" className="text-xs">Inferred</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {reviewingId === item.id ? (
                              <div className="space-y-2 min-w-[250px]">
                                <div className="flex gap-1">
                                  {DECISIONS.map((d) => (
                                    <Button
                                      key={d.value}
                                      variant={decision === d.value ? d.variant : "outline"}
                                      size="sm"
                                      onClick={() => setDecision(d.value)}
                                    >
                                      <d.icon className="h-3 w-3 mr-1" />
                                      {d.label}
                                    </Button>
                                  ))}
                                </div>
                                <Input
                                  placeholder="Reason (required)"
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                />
                                <Textarea
                                  placeholder="Comment (optional)"
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  className="h-16"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={!decision || !reason || submitMutation.isPending}
                                    onClick={() => handleSubmit(item.id)}
                                  >
                                    Submit
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => setReviewingId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReviewingId(item.id);
                                  setDecision("");
                                  setReason("");
                                  setComment("");
                                }}
                              >
                                Review
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">{total} pending</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
