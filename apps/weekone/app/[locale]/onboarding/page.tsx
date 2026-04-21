"use client";

import { useState } from "react";
import { Step1 } from "./step-1";
import { Step2 } from "./step-2";
import { Step3 } from "./step-3";
import { Step4 } from "./step-4";
import { Step5 } from "./step-5";

export type OnboardingData = {
  companyType: string;
  revenueStage: string;
  teamSize: string;
  mainPain: string;
};

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    companyType: "",
    revenueStage: "",
    teamSize: "",
    mainPain: "",
  });

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));
  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...patch }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold">
            Week<span className="text-electric">One</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your founder operating system
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? "bg-electric" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {step === 1 && (
            <Step1
              value={data.companyType}
              onChange={(v) => update({ companyType: v })}
              onNext={next}
            />
          )}
          {step === 2 && (
            <Step2
              value={data.revenueStage}
              onChange={(v) => update({ revenueStage: v })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <Step3
              value={data.teamSize}
              onChange={(v) => update({ teamSize: v })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 4 && (
            <Step4
              value={data.mainPain}
              onChange={(v) => update({ mainPain: v })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 5 && <Step5 data={data} onBack={back} />}
        </div>
      </div>
    </div>
  );
}
