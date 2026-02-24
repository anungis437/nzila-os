"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Clock, User, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkflowEvent {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  notes: string | null;
  createdAt: string;
}

interface WorkflowHistoryProps {
  claimId: string;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  investigation: "Investigation",
  pending_documentation: "Pending Documentation",
  resolved: "Resolved",
  rejected: "Rejected",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  assigned: "bg-purple-100 text-purple-800",
  investigation: "bg-orange-100 text-orange-800",
  pending_documentation: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  closed: "bg-gray-100 text-gray-800",
};

export function WorkflowHistory({ claimId }: WorkflowHistoryProps) {
  const [history, setHistory] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/claims/${claimId}/workflow/history`);
        if (!response.ok) throw new Error("Failed to load workflow history");
        
        const data = await response.json();
        setHistory(data.history || []);
      } catch (_err) {
setError("Failed to load workflow history");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [claimId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow History</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow History</CardTitle>
        <CardDescription>
          Timeline of status changes and updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No workflow history available
          </div>
        ) : (
          <div className="relative space-y-6">
            {/* Timeline line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border"></div>

            {history.map((event, _index) => (
              <div key={event.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-background bg-white shadow-sm">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Event content */}
                <div className="flex-1 space-y-2 pb-6">
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[event.newStatus]}>
                      {STATUS_LABELS[event.newStatus]}
                    </Badge>
                    {event.previousStatus && (
                      <>
                        <span className="text-sm text-muted-foreground">from</span>
                        <Badge variant="outline">
                          {STATUS_LABELS[event.previousStatus]}
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{event.changedByName}</span>
                    <span>â€¢</span>
                    <span>
                      {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {event.notes && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <p className="text-foreground whitespace-pre-wrap">{event.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

