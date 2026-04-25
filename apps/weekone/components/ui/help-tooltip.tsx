"use client";

import { useId } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right";

interface HelpTooltipProps {
  label: string;
  content: string;
  side?: TooltipSide;
}

export function HelpTooltip({ label, content, side = "top" }: HelpTooltipProps) {
  const tooltipId = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition hover:text-foreground"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-20 hidden w-56 rounded-md border border-border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg group-hover:block group-focus-within:block",
          side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
          side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
        )}
      >
        {content}
      </span>
    </span>
  );
}
