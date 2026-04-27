/**
 * Grievance Workspace Tabs
 *
 * Tab layout for the grievance detail page:
 * Overview, Timeline, Documents, Clauses, Employer, AI Assist, Audit / History
 *
 * @module components/grievances/grievance-workspace-tabs
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Clock,
  FileText,
  BookOpen,
  Building2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────

export interface WorkspaceTab {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  disabled?: boolean;
  content: React.ReactNode;
}

export interface GrievanceWorkspaceTabsProps {
  grievanceId: string;
  tabs: WorkspaceTab[];
  defaultTab?: string;
  className?: string;
}

// ─── Default Tab Config ───────────────────────────────────────

export const DEFAULT_WORKSPACE_TAB_IDS = [
  "overview",
  "timeline",
  "documents",
  "clauses",
  "employer",
  "ai",
  "audit",
] as const;

export const DEFAULT_WORKSPACE_TABS: Omit<WorkspaceTab, "content">[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "clauses", label: "Clauses", icon: BookOpen },
  { id: "employer", label: "Employer", icon: Building2 },
  { id: "ai", label: "AI Assist", icon: Sparkles },
  { id: "audit", label: "Audit / History", icon: ShieldCheck },
];

// ─── Component ────────────────────────────────────────────────

export function GrievanceWorkspaceTabs({
  tabs,
  defaultTab,
  className,
}: GrievanceWorkspaceTabsProps) {
  const t = useTranslations("grievanceWorkspaceTabs");
  const [activeTab, setActiveTab] = React.useState(
    defaultTab ?? tabs[0]?.id ?? ""
  );

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const labelFor = (tab: WorkspaceTab) =>
    (DEFAULT_WORKSPACE_TAB_IDS as readonly string[]).includes(tab.id)
      ? t(`tabs.${tab.id}` as 'tabs.overview')
      : tab.label;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tab Bar */}
      <div
        role="tablist"
        aria-label={t("ariaLabel")}
        className="flex items-center gap-1 border-b overflow-x-auto pb-px"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors whitespace-nowrap",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isActive
                  ? "text-foreground border-b-2 border-blue-600 bg-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{labelFor(tab)}</span>
              {tab.badge != null && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {tab.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${currentTab?.id}`}
        aria-labelledby={`tab-${currentTab?.id}`}
      >
        {currentTab?.content}
      </div>
    </div>
  );
}
