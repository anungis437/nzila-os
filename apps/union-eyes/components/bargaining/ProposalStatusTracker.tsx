/**
 * Proposal Status Tracker
 * 
 * Visual tracker showing status of all proposals in the negotiation.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react";

interface Proposal {
  status: string;
}

interface ProposalStatusTrackerProps {
  proposals: Proposal[];
}

export function ProposalStatusTracker({ proposals }: ProposalStatusTrackerProps) {
  const statusCounts = {
    draft: proposals.filter(p => p.status === "draft").length,
    submitted: proposals.filter(p => p.status === "submitted").length,
    under_review: proposals.filter(p => p.status === "under_review").length,
    accepted: proposals.filter(p => p.status === "accepted").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
    counter_offered: proposals.filter(p => p.status === "counter_offered").length,
    withdrawn: proposals.filter(p => p.status === "withdrawn").length,
  };

  const total = proposals.length;
  const acceptanceRate = total > 0 ? (statusCounts.accepted / total) * 100 : 0;
  const _pendingRate = total > 0 ? ((statusCounts.submitted + statusCounts.under_review) / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Status</CardTitle>
        <CardDescription>Track progress of all proposals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between mb-2 text-sm">
              <span>Acceptance Rate</span>
              <span className="font-semibold">{acceptanceRate.toFixed(1)}%</span>
            </div>
            <Progress value={acceptanceRate} className="h-2" />
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg bg-green-50/50">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Accepted</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{statusCounts.accepted}</p>
            </div>

            <div className="p-3 border rounded-lg bg-yellow-50/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {statusCounts.submitted + statusCounts.under_review}
              </p>
            </div>

            <div className="p-3 border rounded-lg bg-red-50/50">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Rejected</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
            </div>

            <div className="p-3 border rounded-lg bg-blue-50/50">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Counter Offered</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{statusCounts.counter_offered}</p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold">Detailed Breakdown</h4>
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between text-sm">
                <span className="text-muted-foreground capitalize">
                  {status.replace("_", " ")}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
