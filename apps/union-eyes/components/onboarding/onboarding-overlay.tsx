"use client";

/**
 * OnboardingOverlay — lightweight, role-aware first-visit nudge.
 *
 * Displays up to 3 short steps as a non-blocking bottom-right card:
 *   1. Page context  ("This is where…")
 *   2. Primary action ("Start by…")
 *   3. Outcome       ("Handle items here to…")
 *
 * Auto-dismisses after the final step or on explicit dismiss.
 * Never re-appears once completed.
 */

import { useState } from "react";
import { X, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OnboardingStep {
  /** Short heading — what this page is */
  context: string;
  /** What the user should do */
  action: string;
}

/** Role-keyed step definitions */
export const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  member: [
    {
      context: "This is your Inbox — new issues and submissions arrive here.",
      action: "Review an item or submit a new issue to get started.",
    },
    {
      context: "Handle items here to move work forward.",
      action: "Each item you action is tracked through the system automatically.",
    },
  ],
  steward: [
    {
      context: "Priorities shows what needs your attention right now.",
      action: "Start with the top item — it's ranked by urgency and deadline.",
    },
    {
      context: "This is where decisions start. Your actions drive the workflow.",
      action: "Open the first priority to begin.",
    },
  ],
  officer: [
    {
      context: "Team priorities — your team's most urgent items are ranked here.",
      action: "Review the top item or switch to your personal priorities.",
    },
    {
      context: "Your oversight drives team execution and accountability.",
      action: "Check the team queue, then review Intelligence for deeper context.",
    },
  ],
  federation: [
    {
      context: "Federation intelligence — what's happening across your locals.",
      action: "Focus on the top signals and recommended actions.",
    },
    {
      context: "Patterns and trends surface here as activity grows across the federation.",
      action: "Review key signals, then check Knowledge for supporting references.",
    },
  ],
  clc: [
    {
      context: "This is your executive view — leadership priorities at a glance.",
      action: "Read the executive summary and review the top 3 priorities.",
    },
    {
      context: "Strategic decisions are guided by the data on this page.",
      action: "Focus on the briefing, then explore intelligence trends below.",
    },
  ],
  admin: [
    {
      context: "Platform administration — manage organizations, users, and system configuration.",
      action: "Start by reviewing the organization overview and user status.",
    },
    {
      context: "Changes here affect all tenants. Review audit logs regularly.",
      action: "Check system health, then review pending access requests.",
    },
  ],
};

/** Map granular RBAC roles to the 6 onboarding role keys */
export function toOnboardingRole(role: string): string {
  // Platform/admin roles
  const ADMIN_ROLES = [
    "app_owner", "coo", "cto", "platform_lead", "customer_success_director",
    "support_manager", "data_analytics_manager", "billing_manager",
    "integration_manager", "compliance_manager", "security_manager",
    "support_agent", "data_analyst", "billing_specialist",
    "integration_specialist", "content_manager", "training_coordinator",
    "system_admin",
  ];
  if (ADMIN_ROLES.includes(role)) return "admin";

  // CLC
  if (["clc_executive", "clc_staff", "congress_staff"].includes(role)) return "clc";

  // Federation
  if (["fed_executive", "fed_staff", "federation_staff"].includes(role)) return "federation";

  // Leadership → officer
  if (["president", "vice_president", "secretary_treasurer", "national_officer"].includes(role)) return "officer";

  // Steward-tier
  if (["steward", "chief_steward", "officer", "bargaining_committee", "health_safety_rep"].includes(role)) return "steward";

  // Default
  return "member";
}

interface OnboardingOverlayProps {
  /** Current step index (0-based) from useOnboarding */
  currentStep: number;
  /** Onboarding role key */
  onboardingRole: string;
  /** Advance to next step */
  onNext: () => void;
  /** Dismiss / complete */
  onDismiss: () => void;
}

export function OnboardingOverlay({
  currentStep,
  onboardingRole,
  onNext,
  onDismiss,
}: OnboardingOverlayProps) {
  const steps = ONBOARDING_STEPS[onboardingRole] || ONBOARDING_STEPS.member;
  const [visible, setVisible] = useState(true);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLast = currentStep >= steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      setVisible(false);
      onDismiss();
    } else {
      onNext();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-blue-200 bg-white shadow-lg overflow-hidden">
        {/* Progress dots */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-blue-600" />
            <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">
              Getting started
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i <= currentStep ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss onboarding"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-2">
          <p className="text-sm font-medium text-gray-900 leading-snug">
            {step.context}
          </p>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            {step.action}
          </p>
        </div>

        <div className="px-4 pb-3 flex justify-end">
          <Button
            size="sm"
            variant={isLast ? "default" : "ghost"}
            className="text-xs h-7"
            onClick={handleNext}
          >
            {isLast ? "Got it" : "Next"}{" "}
            {!isLast && <ArrowRight size={12} className="ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
