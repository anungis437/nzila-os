/**
 * Next Actions Panel
 *
 * Context-aware action recommendations for stewards/staff
 * based on the current grievance state.
 *
 * @module components/grievances/next-actions-panel
 */

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  UserPlus,
  FileText,
  Send,
  ArrowUpRight,
  CheckCircle,
  MessageSquare,
  Clock,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Button as _Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type RepresentationProtocol,
  PROTOCOL_STEWARD_LED,
  getAssignActionLabel,
  getAssignActionDescription,
} from "@/lib/representation/protocol-types";

// ─── Types ────────────────────────────────────────────────────

export interface NextAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  priority: "primary" | "secondary" | "outline";
  disabled?: boolean;
}

export interface NextActionsPanelProps {
  grievanceStatus: string;
  hasSteward: boolean;
  hasEmployerResponse: boolean;
  isOverdue: boolean;
  onAction: (actionId: string) => void;
  /** Per-org representation protocol — controls labels and available actions */
  protocol?: RepresentationProtocol;
  className?: string;
}

// ─── Action Generator ─────────────────────────────────────────

function deriveActions({
  grievanceStatus,
  hasSteward,
  hasEmployerResponse,
  isOverdue,
  protocol = PROTOCOL_STEWARD_LED,
}: Omit<NextActionsPanelProps, "onAction" | "className">): NextAction[] {
  const actions: NextAction[] = [];

  if (!hasSteward) {
    actions.push({
      id: "assign_steward",
      label: getAssignActionLabel(protocol),
      description: getAssignActionDescription(protocol),
      icon: UserPlus,
      priority: "primary",
    });
  }

  if (["filed", "investigating"].includes(grievanceStatus) && !hasEmployerResponse) {
    actions.push({
      id: "contact_employer",
      label: "Contact Employer",
      description: "Send formal notification or request a response from the employer.",
      icon: Send,
      priority: hasSteward ? "primary" : "secondary",
    });
  }

  if (["filed", "investigating", "response_due"].includes(grievanceStatus)) {
    actions.push({
      id: "request_docs",
      label: "Request Documentation",
      description: "Ask the grievant or employer for additional supporting documents.",
      icon: FileText,
      priority: "secondary",
    });
  }

  if (isOverdue) {
    actions.push({
      id: "follow_up",
      label: "Follow Up (Overdue)",
      description: "Send a follow-up — a response deadline has passed.",
      icon: Clock,
      priority: "primary",
    });
  }

  if (
    hasEmployerResponse &&
    ["response_received", "investigating"].includes(grievanceStatus)
  ) {
    actions.push({
      id: "escalate",
      label: "Escalate to Next Step",
      description: "Move this grievance to the next step in the process.",
      icon: ArrowUpRight,
      priority: "secondary",
    });
  }

  if (["escalated", "mediation"].includes(grievanceStatus)) {
    actions.push({
      id: "arbitration",
      label: "Send to Arbitration",
      description: "Refer this case to arbitration.",
      icon: Scale,
      priority: "secondary",
    });
  }

  if (!["closed", "settled", "withdrawn", "denied"].includes(grievanceStatus)) {
    actions.push({
      id: "add_note",
      label: "Add Note",
      description: "Document an observation or internal note about this case.",
      icon: MessageSquare,
      priority: "outline",
    });
  }

  if (["settled", "response_received"].includes(grievanceStatus)) {
    actions.push({
      id: "resolve",
      label: "Resolve / Close Case",
      description: "Mark this grievance as resolved and close it.",
      icon: CheckCircle,
      priority: "secondary",
    });
  }

  return actions;
}

// ─── Component ────────────────────────────────────────────────

export function NextActionsPanel({
  grievanceStatus,
  hasSteward,
  hasEmployerResponse,
  isOverdue,
  onAction,
  protocol,
  className,
}: NextActionsPanelProps) {
  const t = useTranslations("nextActions");
  const KNOWN_ACTION_IDS = ['assign_steward','contact_employer','request_docs','follow_up','escalate','arbitration','add_note','resolve'] as const;
  const actions = deriveActions({
    grievanceStatus,
    hasSteward,
    hasEmployerResponse,
    isOverdue,
    protocol,
  });

  if (actions.length === 0) return null;

  return (
    <Card className={cn("p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <Badge variant="outline" className="text-xs">
          {actions.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              disabled={action.disabled}
              className={cn(
                "w-full flex items-start gap-3 rounded-md p-3 text-left transition-colors",
                "hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                action.priority === "primary" && "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800",
                action.priority === "secondary" && "bg-muted/30",
                action.priority === "outline" && "border border-dashed"
              )}
            >
              <div className={cn(
                "p-1.5 rounded",
                action.priority === "primary" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-muted"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{(KNOWN_ACTION_IDS as readonly string[]).includes(action.id) ? t(`actions.${action.id}.label` as 'actions.assign_steward.label') : action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(KNOWN_ACTION_IDS as readonly string[]).includes(action.id) ? t(`actions.${action.id}.description` as 'actions.assign_steward.description') : action.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
