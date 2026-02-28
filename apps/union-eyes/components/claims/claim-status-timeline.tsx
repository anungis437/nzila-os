/**
 * Claim Status Timeline Component
 * 
 * Visual workflow progress indicator showing:
 * - Current status
 * - Status history
 * - Time spent in each status
 * - Status transitions
 * - Next possible actions
 * 
 * @module components/claims/claim-status-timeline
 */

"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Circle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusEvent {
  status: string;
  timestamp: Date;
  user: string;
  notes?: string;
  duration?: number; // milliseconds spent in this status
}

export interface ClaimStatusTimelineProps {
  events: StatusEvent[];
  currentStatus: string;
  className?: string;
}

const statusConfig: Record<
  string,
  { 
    label: string; 
    icon: React.ElementType; 
    color: string;
    bgColor: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  "in-review": {
    label: "In Review",
    icon: AlertCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  "under-investigation": {
    label: "Under Investigation",
    icon: AlertCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  closed: {
    label: "Closed",
    icon: CheckCircle,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
};

export function ClaimStatusTimeline({
  events,
  currentStatus,
  className,
}: ClaimStatusTimelineProps) {
  const sortedEvents = React.useMemo(() => {
    return [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [events]);

  const totalDuration = React.useMemo(() => {
    if (sortedEvents.length === 0) return 0;
    const first = sortedEvents[0].timestamp.getTime();
    const last = sortedEvents[sortedEvents.length - 1].timestamp.getTime();
    return last - first;
  }, [sortedEvents]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Status Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedEvents.map((event, index) => {
            const config = statusConfig[event.status];
            const Icon = config?.icon || Circle;
            const isLast = index === sortedEvents.length - 1;
            const isCurrent = event.status === currentStatus;

            return (
              <div key={index} className="relative">
                <div className="flex items-start gap-4">
                  {/* Timeline Line & Icon */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full",
                        isCurrent
                          ? cn(config?.bgColor, "ring-4 ring-white ring-offset-2")
                          : config?.bgColor
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isCurrent ? config?.color : "opacity-60"
                        )}
                      />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 h-full min-h-[40px] bg-gray-200 mt-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">
                            {config?.label || event.status}
                          </h4>
                          {isCurrent && (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Changed by {event.user}
                        </p>
                        {event.notes && (
                          <p className="text-sm text-gray-700 mt-2 italic">
                            {/* eslint-disable-next-line react/no-unescaped-entities */}
                            "{event.notes}"
                          </p>
                        )}
                      </div>

                      <div className="text-right text-sm">
                        <div className="font-medium">
                          {format(event.timestamp, "MMM d, yyyy")}
                        </div>
                        <div className="text-gray-500">
                          {format(event.timestamp, "h:mm a")}
                        </div>
                        {event.duration && event.duration > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDuration(event.duration)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Next Status Arrow */}
                    {!isLast && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                        <ArrowRight className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(event.timestamp, {
                            addSuffix: false,
                          })}{" "}
                          later
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {totalDuration > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Duration</span>
              <span className="font-medium">{formatDuration(totalDuration)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

