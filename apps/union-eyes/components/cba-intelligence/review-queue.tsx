"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReviewQueueItem, getReviewQueueCounts } from "@/lib/services/cba-intelligence/review-service";
import { ApiShapeError, apiErrorMessage, envelopeData, failureText, readApiError } from "@/lib/client/api-envelope";
import { useOperationalHealth } from "./use-operational-health";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type QueueCounts = Awaited<ReturnType<typeof getReviewQueueCounts>>;

interface ReviewQueuePage {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
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
  { value: "needs_followup", label: "Needs Follow-up", icon: RotateCcw, variant: "secondary" as const },
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
  const [activeTab, setActiveTab] = useState<(typeof TARGET_TYPES)[number]["key"]>("finding");
  const [page, setPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  // Queue counts
  const { data: counts } = useQuery<QueueCounts>({
    queryKey: ["cba-intel-review-counts"],
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/cba-intelligence/review?counts=true");
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, "Failed to load the review queue counts"));
      const queueCounts: QueueCounts = envelopeData(body) as unknown as QueueCounts;
      return queueCounts;
    },
  });

  // Queue items
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "20",
    targetType: activeTab,
  });
  const { data, isLoading, error } = useQuery<ReviewQueuePage>({
    queryKey: ["cba-intel-review-queue", activeTab, page],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/cba-intelligence/review?${queryParams}`);
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, "Failed to load review queue"));
      const queue: ReviewQueuePage = envelopeData(body) as unknown as ReviewQueuePage;
      if (!Array.isArray(queue.items)) throw new ApiShapeError("no review queue");
      return queue;
    },
  });

  const { data: health } = useOperationalHealth();

  // Submit review: a decision the route refused (a role, a row already decided, a reason too long) is shown, not taken for a decision made.
  const submitMutation = useMutation({
    mutationFn: async (payload: {
      targetType: string;
      targetId: string;
      decision: string;
      reason: string;
      comment?: string;
    }) => {
      const response = await fetch("/api/cba-intelligence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Failed to submit the review decision"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cba-intel-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["cba-intel-review-counts"] });
      setReviewingId(null);
      setDecision("");
      setReason("");
      setComment("");
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const backlogHealth = health?.checks.find((c) => c.name === "review_backlog");
  const showBacklogAlert = backlogHealth && backlogHealth.level !== "healthy";

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
        {showBacklogAlert && (
          <Alert
            className={`mb-4 ${backlogHealth.level === "critical" ? "border-red-300 text-red-700" : "border-yellow-300 text-yellow-700"}`}
            variant={backlogHealth.level === "critical" ? "destructive" : "default"}
          >
            <AlertDescription>
              {backlogHealth.detail}. Triage low-confidence and inferred items first to reduce operational risk.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setPage(1); setReviewingId(null); submitMutation.reset(); }}>
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
                        <TableCell colSpan={4} role="alert" className="text-center py-8 text-red-500">
                          {failureText(error, "Failed to load review queue")}
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
                                <div className="text-sm text-muted-foreground truncate max-w-75">
                                  &ldquo;{item.citationText}&rdquo;
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{confidenceBadge(item.confidence)}</TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {item.jurisdiction && <span>{item.jurisdiction} · </span>}
                              {item.reviewStatus === "needs_followup" && (
                                <Badge variant="outline" className="mr-1 text-xs">Needs Follow-up</Badge>
                              )}
                              {item.isInferred && (
                                <Badge variant="secondary" className="text-xs">Inferred</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {reviewingId === item.id ? (
                              <div className="space-y-2 min-w-62.5">
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
                                {submitMutation.error && (
                                  <div role="alert" className="text-sm text-red-500">
                                    {failureText(submitMutation.error, "Failed to submit the review decision")}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  submitMutation.reset();
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
