/**
 * Pilot Readiness Checklist
 *
 * Guided checklist for new pilot organizations to confirm
 * setup steps: org seeded, users invited, roles assigned,
 * contracts uploaded, employers imported, integrations configured,
 * evidence export verified.
 *
 * @module components/pilot/pilot-readiness-checklist
 */

"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Building2,
  Users,
  Shield,
  FileText,
  Briefcase,
  Link2,
  Download,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export interface PilotReadinessChecklistProps {
  items?: ChecklistItem[];
  readinessData?: PilotReadinessData;
  onItemComplete?: (id: string) => void;
  className?: string;
}

// ─── Readiness data from API ──────────────────────────────────

export interface PilotReadinessData {
  users: number;
  contracts: number;
  employers: number;
  grievances: number;
  roles: number;
  evidenceExport: boolean;
}

export interface PilotChecklistFlags {
  [key: string]: boolean;
}

// ─── Default items ────────────────────────────────────────────

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "completed">[] = [
  {
    id: "org_seeded",
    label: "Organization seeded",
    description: "Your organization has been created and configured in UnionEyes.",
    icon: Building2,
    actionLabel: "View org settings",
    actionHref: "/dashboard/settings",
  },
  {
    id: "users_invited",
    label: "Users invited",
    description: "Invite stewards, staff, and administrators to join the platform.",
    icon: Users,
    actionLabel: "Invite users",
    actionHref: "/dashboard/admin/users",
  },
  {
    id: "roles_assigned",
    label: "Roles assigned",
    description: "Assign appropriate roles (admin, officer, steward, member) to each user.",
    icon: Shield,
    actionLabel: "Manage roles",
    actionHref: "/dashboard/admin/users",
  },
  {
    id: "contracts_uploaded",
    label: "Collective agreements uploaded",
    description: "Upload your collective bargaining agreements for clause lookup and reference.",
    icon: FileText,
    actionLabel: "Upload agreements",
    actionHref: "/dashboard/bargaining",
  },
  {
    id: "employers_imported",
    label: "Employers imported",
    description: "Import or create employer records and their contact information.",
    icon: Briefcase,
    actionLabel: "Manage employers",
    actionHref: "/employers",
  },
  {
    id: "integrations_configured",
    label: "Integrations configured",
    description: "Connect email, calendar, or external systems if applicable.",
    icon: Link2,
    actionLabel: "Configure integrations",
    actionHref: "/dashboard/settings/integrations",
  },
  {
    id: "export_verified",
    label: "Evidence export verified",
    description: "Test that grievance evidence packs export correctly for arbitration use.",
    icon: Download,
    actionLabel: "Test export",
    actionHref: "/grievances",
  },
];

const API_ITEM_TO_CHECKLIST_ID: Record<string, string> = {
  "org-seeded": "org_seeded",
  "users-invited": "users_invited",
  "roles-assigned": "roles_assigned",
  "contracts-uploaded": "contracts_uploaded",
  "employers-imported": "employers_imported",
  "integrations-configured": "integrations_configured",
  "export-verified": "export_verified",
};

/**
 * Convert backend onboarding flags to checklist item completion states.
 * Unknown keys are ignored by design to keep the UI forward compatible.
 */
export function buildChecklistFromFlags(flags: PilotChecklistFlags): ChecklistItem[] {
  const completionById = new Map<string, boolean>();

  for (const [apiItemId, completed] of Object.entries(flags)) {
    const checklistId = API_ITEM_TO_CHECKLIST_ID[apiItemId];
    if (!checklistId) continue;
    completionById.set(checklistId, Boolean(completed));
  }

  return DEFAULT_CHECKLIST.map((item) => ({
    ...item,
    completed: completionById.get(item.id) ?? false,
  }));
}

// ─── Dynamic checklist builder ────────────────────────────────

export function buildReadinessChecklist(data: PilotReadinessData): ChecklistItem[] {
  return [
    {
      id: "users",
      label: "Users invited",
      description: data.users > 0
        ? `${data.users} user${data.users !== 1 ? "s" : ""} registered.`
        : "Invite stewards, staff, and administrators to join the platform.",
      icon: Users,
      completed: data.users > 0,
      actionLabel: "Invite users",
      actionHref: "/dashboard/admin/users",
    },
    {
      id: "roles",
      label: "Roles assigned",
      description: data.roles > 0
        ? `${data.roles} role assignment${data.roles !== 1 ? "s" : ""} configured.`
        : "Assign appropriate roles (admin, officer, steward, member) to each user.",
      icon: Shield,
      completed: data.roles > 0,
      actionLabel: "Manage roles",
      actionHref: "/dashboard/admin/users",
    },
    {
      id: "contracts",
      label: "Collective agreements uploaded",
      description: data.contracts > 0
        ? `${data.contracts} agreement${data.contracts !== 1 ? "s" : ""} on file.`
        : "Upload your collective bargaining agreements for clause lookup and reference.",
      icon: FileText,
      completed: data.contracts > 0,
      actionLabel: "Upload agreements",
      actionHref: "/dashboard/bargaining",
    },
    {
      id: "employers",
      label: "Employers imported",
      description: data.employers > 0
        ? `${data.employers} employer${data.employers !== 1 ? "s" : ""} imported.`
        : "Import or create employer records and their contact information.",
      icon: Briefcase,
      completed: data.employers > 0,
      actionLabel: "Manage employers",
      actionHref: "/employers",
    },
    {
      id: "grievances",
      label: "Grievance workflow tested",
      description: data.grievances > 0
        ? `${data.grievances} grievance${data.grievances !== 1 ? "s" : ""} filed.`
        : "File a test grievance to verify the intake and assignment workflow.",
      icon: Building2,
      completed: data.grievances > 0,
      actionLabel: "File test grievance",
      actionHref: "/grievances/new",
    },
    {
      id: "evidence_export",
      label: "Evidence export verified",
      description: data.evidenceExport
        ? "Evidence export is working correctly."
        : "Test that grievance evidence packs export correctly for arbitration use.",
      icon: Download,
      completed: data.evidenceExport,
      actionLabel: "Test export",
      actionHref: "/grievances",
    },
  ];
}

// ─── Component ────────────────────────────────────────────────

export function PilotReadinessChecklist({
  items,
  readinessData,
  onItemComplete,
  className,
}: PilotReadinessChecklistProps) {
  const checklist = items
    ?? (readinessData ? buildReadinessChecklist(readinessData) : DEFAULT_CHECKLIST.map((item) => ({ ...item, completed: false })));
  const completedCount = checklist.filter((i) => i.completed).length;
  const totalCount = checklist.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className={cn("p-5 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pilot Readiness</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} of {totalCount} steps completed
          </p>
        </div>
        <Badge variant={progressPct === 100 ? "default" : "secondary"}>
          {progressPct}%
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progressPct === 100 ? "bg-green-500" : "bg-blue-500"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-1" role="list">
        {checklist.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-md transition-colors",
                item.completed
                  ? "bg-green-50 dark:bg-green-950/20"
                  : "hover:bg-muted/50"
              )}
              role="listitem"
            >
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    item.completed && "line-through text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
              {!item.completed && (item.actionHref || item.onAction) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs h-7"
                  onClick={() => {
                    if (item.onAction) item.onAction();
                    if (onItemComplete) onItemComplete(item.id);
                  }}
                  asChild={!!item.actionHref}
                >
                  {item.actionHref ? (
                    <a href={item.actionHref}>
                      {item.actionLabel ?? "Go"}
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </a>
                  ) : (
                    <>
                      {item.actionLabel ?? "Complete"}
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion message */}
      {progressPct === 100 && (
        <div className="text-center py-3 bg-green-50 dark:bg-green-950/20 rounded-md">
          <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Your pilot environment is ready!
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You can begin filing grievances and managing cases.
          </p>
        </div>
      )}
    </Card>
  );
}
