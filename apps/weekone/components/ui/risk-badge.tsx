import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/domain/risk";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  className?: string;
}

const levelConfig: Record<
  RiskLevel,
  { bg: string; text: string; icon: React.ElementType }
> = {
  critical: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    icon: AlertCircle,
  },
  high: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
  },
  medium: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
  },
  low: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle,
  },
};

const levelFallback: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function RiskBadge({ level, label, className }: RiskBadgeProps) {
  const { bg, text, icon: Icon } = levelConfig[level];
  return (
    <span className={cn("risk-badge", bg, text, className)}>
      <Icon className="h-3 w-3" />
      {label ?? levelFallback[level]}
    </span>
  );
}

export function RiskInfoBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const { bg, text } = levelConfig[level];
  return (
    <span className={cn("risk-badge", bg, text, className)}>
      <Info className="h-3 w-3" />
      {levelFallback[level]}
    </span>
  );
}
