"use client";

/**
 * Pilot Feedback Widget
 *
 * Lightweight in-app feedback prompt triggered:
 *  - After first case created
 *  - After 3–5 uses (milestone)
 *
 * UI: "Was this easy to use?" + optional text input.
 * Categories: confusing, slow, unnecessary_steps, missing_feature.
 *
 * Non-intrusive: dismissible, appears as a bottom-right card, and a dismissed prompt does not come back for the same trigger.
 * Mounted once, in the dashboard shell (components/dashboard/operational-shell.tsx). Who is giving the feedback and for which organization is read by the server
 * from the session (POST /api/pilot/feedback), never sent from here.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Star } from "lucide-react";

const FEEDBACK_GIVEN_KEY = "ue-pilot-feedback-given";
const FEEDBACK_DISMISSED_KEY = "ue-pilot-feedback-dismissed";
const CASE_COUNT_KEY = "ue-pilot-case-count";
/** Raised in this tab when the case count changes: the browser's own `storage` event only reaches other tabs. */
const CASE_COUNT_EVENT = "ue-pilot-case-count";

const CATEGORIES = ["confusing", "slow", "unnecessary_steps", "missing_feature"] as const;

type FeedbackCategory = (typeof CATEGORIES)[number];
type FeedbackTrigger = "first_case" | "milestone_usage";

interface PilotFeedbackWidgetProps {
  /** Override: force the widget to show (for testing) */
  forceShow?: boolean;
}

const dismissedTriggers = (): string[] => {
  try {
    return (localStorage.getItem(FEEDBACK_DISMISSED_KEY) ?? "").split(",").filter(Boolean);
  } catch {
    return [];
  }
};

export default function PilotFeedbackWidget({ forceShow }: PilotFeedbackWidgetProps) {
  const t = useTranslations("pilotFeedbackWidget");
  const { isPilotMode } = usePilotMode();

  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [comment, setComment] = useState("");
  const [failed, setFailed] = useState(false);
  // Counts the changes of the stored case count, so the prompt is worked out again when a case is created in this very tab.
  const [counted, setCounted] = useState(0);

  useEffect(() => {
    const changed = () => setCounted((value) => value + 1);
    window.addEventListener(CASE_COUNT_EVENT, changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(CASE_COUNT_EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, []);

  const promptState = useMemo((): { visible: boolean; trigger: FeedbackTrigger } => {
    if (forceShow) return { visible: true, trigger: "first_case" };
    if (!isPilotMode) return { visible: false, trigger: "first_case" };

    try {
      if (localStorage.getItem(FEEDBACK_GIVEN_KEY)) return { visible: false, trigger: "first_case" };

      const caseCount = parseInt(localStorage.getItem(CASE_COUNT_KEY) ?? "0", 10);
      const trigger: FeedbackTrigger | null = caseCount === 1 ? "first_case" : caseCount >= 3 && caseCount <= 5 ? "milestone_usage" : null;
      if (trigger && !dismissedTriggers().includes(trigger)) return { visible: true, trigger };
    } catch {
      // Storage is unavailable (private mode): without a case count there is nothing to trigger on.
    }
    return { visible: false, trigger: "first_case" };
    // `counted` is the reason to read the stored case count again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShow, isPilotMode, counted]);

  const visible = submitted || (!dismissed && promptState.visible);
  const trigger = promptState.trigger;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(FEEDBACK_DISMISSED_KEY, [...new Set([...dismissedTriggers(), trigger])].join(","));
    } catch {
      // Storage is unavailable (private mode): the prompt may come back on a later visit.
    }
  };

  const chooseRating = (star: number) => {
    setRating(star);
    // The reasons are asked only about a low rating; one picked before the rating was raised does not describe it.
    if (star > 3) setCategory(null);
  };

  const submit = async () => {
    if (rating === 0) return;

    setFailed(false);
    try {
      const response = await fetch("/api/pilot/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          easeRating: rating,
          category,
          comment: comment.trim() || null,
          trigger,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setFailed(true);
      return;
    }

    try {
      localStorage.setItem(FEEDBACK_GIVEN_KEY, "true");
    } catch {
      // Storage is unavailable (private mode): the feedback was received, and the prompt may appear again on a later visit.
    }
    setSubmitted(true);
    window.setTimeout(() => {
      setSubmitted(false);
      setDismissed(true);
    }, 2000);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-80"
      >
        <Card className="shadow-xl border-blue-200 bg-white">
          <CardContent className="p-4">
            {submitted ? (
              <div className="text-center py-4">
                <div className="inline-flex p-2 rounded-full bg-green-100 mb-2">
                  <MessageSquare size={20} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">{t("thanks")}</p>
                <p className="text-xs text-gray-500 mt-1">{t("thanksDetail")}</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">{t("heading")}</span>
                  </div>
                  <button
                    onClick={dismiss}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    aria-label={t("dismissLabel")}
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>

                {/* Question */}
                <p className="text-sm text-gray-700 mb-3">{t("question")}</p>

                {/* Star rating */}
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => chooseRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={t("rateLabel", { star })}
                    >
                      <Star
                        size={20}
                        className={
                          star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }
                      />
                    </button>
                  ))}
                </div>

                {/* Categories (optional, shown after a low rating) */}
                {rating > 0 && rating <= 3 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {CATEGORIES.map((id) => (
                      <button
                        key={id}
                        onClick={() => setCategory(category === id ? null : id)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          category === id
                            ? "bg-blue-100 border-blue-300 text-blue-700"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {t(`category.${id}`)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input (optional) */}
                {rating > 0 && (
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("detailsPlaceholder")}
                    className="text-xs mb-3 resize-none"
                    rows={2}
                    maxLength={500}
                  />
                )}

                {/* Submit */}
                {failed && (
                  <p role="alert" className="mb-2 text-xs text-red-600">
                    {t("sendFailed")}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs">
                    {t("skip")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={rating === 0}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    {t("send")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Increment the local case counter (call after a case is created).
 * This drives the feedback widget trigger logic.
 */
export function incrementPilotCaseCount(): void {
  try {
    const current = parseInt(localStorage.getItem(CASE_COUNT_KEY) ?? "0", 10);
    localStorage.setItem(CASE_COUNT_KEY, String(current + 1));
  } catch {
    // Storage is unavailable (private mode): the count only decides when the feedback prompt appears, so the prompt is simply not triggered.
    return;
  }
  window.dispatchEvent(new Event(CASE_COUNT_EVENT));
}
