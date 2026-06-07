"use client";

/**
 * Pilot Onboarding Wizard
 *
 * A minimal 4-step first-login experience for pilot users:
 *   1. Welcome — what UnionEyes is
 *   2. Your Info — department, shift, location (optional, skippable)
 *   3. What You Can Do — three key features
 *   4. All Set — go to dashboard
 *
 * Stores completion in localStorage via PilotModeContext.
 * The entire wizard is skippable at every step.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Clock,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { usePilotMode } from "@/contexts/pilot-mode-context";

interface PilotOnboardingWizardProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 4;

export default function PilotOnboardingWizard({ onComplete }: PilotOnboardingWizardProps) {
  const t = useTranslations("pilot.onboarding");
  const { completeOnboarding } = usePilotMode();
  const [step, setStep] = useState(1);
  const [department, setDepartment] = useState("");
  const [shift, setShift] = useState("");
  const [location, setLocation] = useState("");

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const finish = () => {
    completeOnboarding();
    onComplete();
  };

  const skip = () => {
    completeOnboarding();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg shadow-2xl border-0">
        <CardContent className="p-0">
          {/* Progress bar */}
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">
                {t("stepOf", { current: step, total: TOTAL_STEPS })}
              </span>
              <button
                type="button"
                onClick={skip}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {t("skipLabel")}
              </button>
            </div>
            <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
          </div>

          {/* Step content */}
          <div className="px-6 py-6 min-h-80 flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="flex-1"
              >
                {step === 1 && <StepWelcome t={t} />}
                {step === 2 && (
                  <StepInfo
                    t={t}
                    department={department}
                    setDepartment={setDepartment}
                    shift={shift}
                    setShift={setShift}
                    location={location}
                    setLocation={setLocation}
                  />
                )}
                {step === 3 && <StepFeatures t={t} />}
                {step === 4 && <StepDone t={t} />}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8">
              {step > 1 ? (
                <Button variant="ghost" size="sm" onClick={prev}>
                  <ArrowLeft size={16} className="mr-1" />
                  {t("prevStep")}
                </Button>
              ) : (
                <div />
              )}

              {step < TOTAL_STEPS ? (
                <Button onClick={next} size="sm">
                  {t("nextStep")}
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              ) : (
                <Button onClick={finish} size="sm" className="bg-green-600 hover:bg-green-700">
                  {t("getStarted")}
                  <ArrowRight size={16} className="ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Step sub-components ─────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepWelcome({ t }: { t: unknown }) {
  return (
    <div className="text-center">
      <div className="inline-flex p-4 rounded-2xl bg-blue-100 mb-4">
        <Sparkles size={32} className="text-blue-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("welcomeTitle")}</h2>
      <p className="text-gray-500 mb-4">{t("welcomeSubtitle")}</p>
      <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
        {t("step1Description")}
      </p>
    </div>
  );
}

function StepInfo({
  t,
  department,
  setDepartment,
  shift,
  setShift,
  location,
  setLocation,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: unknown;
  department: string;
  setDepartment: (v: string) => void;
  shift: string;
  setShift: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{t("step2Title")}</h2>
      <p className="text-sm text-gray-500 mb-6">{t("step2Description")}</p>
      <div className="space-y-4">
        <div>
          <Label htmlFor="department" className="text-sm">{t("departmentLabel")}</Label>
          <Input
            id="department"
            placeholder={t("departmentPlaceholder")}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="shift" className="text-sm">{t("shiftLabel")}</Label>
          <Input
            id="shift"
            placeholder={t("shiftPlaceholder")}
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="location" className="text-sm">{t("locationLabel")}</Label>
          <Input
            id="location"
            placeholder={t("locationPlaceholder")}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepFeatures({ t }: { t: unknown }) {
  const features = [
    { icon: <FileText size={20} className="text-blue-600" />, text: t("step3Feature1") },
    { icon: <Clock size={20} className="text-green-600" />, text: t("step3Feature2") },
    { icon: <MessageSquare size={20} className="text-purple-600" />, text: t("step3Feature3") },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{t("step3Title")}</h2>
      <p className="text-sm text-gray-500 mb-6">{t("step3Description")}</p>
      <div className="space-y-4">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
          >
            <div className="p-2 rounded-lg bg-white shadow-sm">{f.icon}</div>
            <p className="text-sm text-gray-700 pt-1.5">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StepDone({ t }: { t: unknown }) {
  return (
    <div className="text-center">
      <div className="inline-flex p-4 rounded-2xl bg-green-100 mb-4">
        <CheckCircle2 size={32} className="text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("step4Title")}</h2>
      <p className="text-sm text-gray-600 max-w-sm mx-auto">{t("step4Description")}</p>
    </div>
  );
}
