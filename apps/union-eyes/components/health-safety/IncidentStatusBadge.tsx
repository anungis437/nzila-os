/**
 * Incident Status Badge Component
 * 
 * Visual status indicator for incidents with:
 * - Color-coded badges
 * - Status labels
 * - Dark mode support
 * 
 * @module components/health-safety/IncidentStatusBadge
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface IncidentStatusBadgeProps {
  /** The incident status as stored: reported, investigating or closed (resolved and open are read too). */
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  reported: {
    label: "Reported",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
  },
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
  },
  investigating: {
    label: "Investigating",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
  },
  closed: {
    label: "Closed",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
  }
};

export function IncidentStatusBadge({ status, className }: IncidentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // A status this screen does not know is shown as it is stored, not relabelled "Pending".
  if (!config) {
    return (
      <Badge className={cn("bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 capitalize", className)}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  }

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
