/**
 * Grievance Intake Stepper
 *
 * Visual step indicator for the grievance intake wizard.
 * Shows progress through the 6-step intake submission flow with
 * completion states, active highlighting, and keyboard nav.
 *
 * @module components/grievances/grievance-intake-stepper
 */

"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface IntakeStep {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
}

export interface GrievanceIntakeStepperProps {
  steps: IntakeStep[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function GrievanceIntakeStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  className,
}: GrievanceIntakeStepperProps) {
  const t = useTranslations("grievanceIntakeStepper");
  return (
    <nav
      aria-label={t("ariaLabel")}
      className={cn("w-full", className)}
    >
      {/* Desktop horizontal stepper */}
      <ol className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isActive = index === currentStep;
          const isClickable = isCompleted || index <= currentStep;

          return (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  disabled={!isClickable}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={t("stepLabel", { n: index + 1, title: step.title }) + (isCompleted ? t("completedSuffix") : "")}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                    isCompleted && "bg-green-600 border-green-600 text-white",
                    isActive && !isCompleted && "border-blue-600 bg-blue-50",
                    !isActive && !isCompleted && "border-gray-300 bg-white",
                    isClickable && "cursor-pointer hover:shadow-md",
                    !isClickable && "cursor-not-allowed opacity-60"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )}
                    >
                      {index + 1}
                    </span>
                  )}
                </button>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium text-center max-w-[80px]",
                    isActive && "text-blue-600",
                    isCompleted && "text-green-700",
                    !isActive && !isCompleted && "text-gray-500"
                  )}
                >
                  {step.title}
                </span>
                {step.optional && (
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {t("optional")}
                  </span>
                )}
              </li>
              {index < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors rounded",
                    isCompleted ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Mobile compact stepper */}
      <div className="md:hidden flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {t("stepOf", { current: currentStep + 1, total: steps.length })}
        </span>
        <span className="text-sm text-muted-foreground">
          {steps[currentStep]?.title}
        </span>
        <div className="flex gap-1">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                completedSteps.has(index) && "bg-green-500",
                index === currentStep && !completedSteps.has(index) && "bg-blue-500",
                index !== currentStep && !completedSteps.has(index) && "bg-gray-300"
              )}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
