/**
 * Hazard Priority Badge Component
 * 
 * Visual priority indicator for hazards with:
 * - Color-coded badges
 * - Priority labels
 * - Icons
 * - Dark mode support
 * 
 * @module components/health-safety/HazardPriorityBadge
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HazardPriorityBadgeProps {
  priority: "low" | "medium" | "high" | "critical";
  showIcon?: boolean;
  className?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string; icon: typeof AlertTriangle }> = {
  critical: {
    label: "Critical",
    className: "bg-red-600 text-white dark:bg-red-600 dark:text-white",
    icon: AlertTriangle
  },
  extreme: {
    label: "Extreme",
    className: "bg-red-800 text-white dark:bg-red-800 dark:text-white",
    icon: AlertTriangle
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    icon: AlertCircle
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    icon: AlertCircle
  },
  moderate: {
    label: "Moderate",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    icon: AlertCircle
  },
  low: {
    label: "Low",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    icon: Info
  }
};

export function HazardPriorityBadge({ 
  priority, 
  showIcon = true,
  className 
}: HazardPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;
  const Icon = config.icon;

  return (
    <Badge className={cn(config.className, "font-semibold", className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
