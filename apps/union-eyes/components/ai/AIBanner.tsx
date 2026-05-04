"use client";

import { AlertTriangle, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SENSITIVE_DATA_CLASSES = [
  "pension_financial",
  "grievance_legal",
  "member_personal",
];

export interface AIBannerProps {
  variant?: "info" | "warning";
  context?: "summary" | "recommendation" | "analysis" | "prediction";
  showIcon?: boolean;
  dataClass?: string;
  className?: string;
}

export function AIBanner({
  variant = "info",
  context,
  showIcon = true,
  dataClass,
  className,
}: AIBannerProps) {
  const isSensitive = dataClass !== undefined && SENSITIVE_DATA_CLASSES.includes(dataClass);
  const isWarning = variant === "warning" || isSensitive;
  const Icon = isWarning ? AlertTriangle : Bot;

  const contextLabel =
    context === "summary"
      ? "AI-generated summary"
      : context === "recommendation"
        ? "AI-generated recommendation"
        : context === "analysis"
          ? "AI-generated analysis"
          : context === "prediction"
            ? "AI-generated prediction"
            : "AI-assisted output";

  const baseClasses =
    "flex items-start gap-3 rounded-md border px-4 py-3 text-sm";
  const colorClasses = isWarning
    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
    : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";

  return (
    <div
      role="note"
      aria-label="AI content disclosure"
      className={[baseClasses, colorClasses, className].filter(Boolean).join(" ")}
    >
      {showIcon && (
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      )}
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Badge
          variant={isWarning ? "destructive" : "secondary"}
          className="shrink-0 text-xs"
        >
          {contextLabel}
        </Badge>
        <span>Review required before taking action.</span>
        <span className="text-xs opacity-75">
          This output does not make decisions or constitute professional advice.
        </span>
        {isSensitive && (
          <span className="mt-1 w-full text-xs font-medium">
            ⚠ This content relates to sensitive data. Independent verification
            is required before use.
          </span>
        )}
      </div>
    </div>
  );
}
