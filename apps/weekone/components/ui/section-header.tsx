import { cn } from "@/lib/utils";
import { HelpTooltip } from "@/components/ui/help-tooltip";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  helpContent?: string;
  helpLabel?: string;
  tooltipSide?: "top" | "right";
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  helpContent,
  helpLabel,
  tooltipSide,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {helpContent && (
            <HelpTooltip
              label={helpLabel ?? `Explain ${title}`}
              content={helpContent}
              side={tooltipSide ?? "top"}
            />
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
