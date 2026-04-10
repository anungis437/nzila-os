import { cn } from "@/lib/utils";
import { STAGE_METADATA_LIST } from "./stage-metadata";

interface DealStageBadgeProps {
  stage: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
};

export function DealStageBadge({ stage, className }: DealStageBadgeProps) {
  const meta = STAGE_METADATA_LIST[stage];
  const color = meta?.color ?? "gray";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        colorMap[color] ?? colorMap.gray,
        className
      )}
    >
      {meta?.label ?? stage}
    </span>
  );
}
