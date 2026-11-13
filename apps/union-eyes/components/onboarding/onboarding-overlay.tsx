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
import { useTranslations } from "next-intl";
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
      context: "steps.member.0.context",
      action: "steps.member.0.action",
    },
    {
      context: "steps.member.1.context",
      action: "steps.member.1.action",
    },
  ],
  steward: [
    {
      context: "steps.steward.0.context",
      action: "steps.steward.0.action",
    },
    {
      context: "steps.steward.1.context",
      action: "steps.steward.1.action",
    },
  ],
  officer: [
    {
      context: "steps.officer.0.context",
      action: "steps.officer.0.action",
    },
    {
      context: "steps.officer.1.context",
      action: "steps.officer.1.action",
    },
  ],
  federation: [
    {
      context: "steps.federation.0.context",
      action: "steps.federation.0.action",
    },
    {
      context: "steps.federation.1.context",
      action: "steps.federation.1.action",
    },
  ],
  clc: [
    {
      context: "steps.clc.0.context",
      action: "steps.clc.0.action",
    },
    {
      context: "steps.clc.1.context",
      action: "steps.clc.1.action",
    },
  ],
  admin: [
    {
      context: "steps.admin.0.context",
      action: "steps.admin.0.action",
    },
    {
      context: "steps.admin.1.context",
      action: "steps.admin.1.action",
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
  const t = useTranslations("onboardingTour");
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
    <div className="ue-contextual-guidance">
      <div className="rounded-xl border border-blue-200 bg-white shadow-lg overflow-hidden">
        {/* Progress dots */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-blue-600" />
            <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">
              {t("title")}
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
              aria-label={t("dismiss")}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-2">
          <p className="text-sm font-medium text-gray-900 leading-snug">
            {t(step.context)}
          </p>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            {t(step.action)}
          </p>
        </div>

        <div className="px-4 pb-3 flex justify-end">
          <Button
            size="sm"
            variant={isLast ? "default" : "ghost"}
            className="text-xs h-7"
            onClick={handleNext}
          >
            {isLast ? t("done") : t("next")}{" "}
            {!isLast && <ArrowRight size={12} className="ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
