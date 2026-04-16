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
 * Non-intrusive: dismissible, appears as a bottom-right card.
 */

import { useMemo, useState } from "react";
import { useUser } from '@nzila/platform-auth/entra/client';
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Star } from "lucide-react";

const FEEDBACK_GIVEN_KEY = "ue-pilot-feedback-given";
const CASE_COUNT_KEY = "ue-pilot-case-count";

const CATEGORIES = [
  { id: "confusing", label: "Confusing" },
  { id: "slow", label: "Too slow" },
  { id: "unnecessary_steps", label: "Extra steps" },
  { id: "missing_feature", label: "Missing feature" },
] as const;

type FeedbackCategory = (typeof CATEGORIES)[number]["id"];

interface PilotFeedbackWidgetProps {
  /** Override: force the widget to show (for testing) */
  forceShow?: boolean;
}

export default function PilotFeedbackWidget({ forceShow }: PilotFeedbackWidgetProps) {
  const { user } = useUser();
  const organizationId = useOrganizationId();
  const { isPilotMode } = usePilotMode();

  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [comment, setComment] = useState("");
  const promptState = useMemo(() => {
    if (forceShow) {
      return { visible: true, trigger: 'first_case' as const };
    }

    if (!isPilotMode) {
      return { visible: false, trigger: 'first_case' as const };
    }

    try {
      const alreadyGiven = localStorage.getItem(FEEDBACK_GIVEN_KEY);
      if (alreadyGiven) {
        return { visible: false, trigger: 'first_case' as const };
      }

      const caseCount = parseInt(localStorage.getItem(CASE_COUNT_KEY) ?? '0', 10);
      if (caseCount === 1) {
        return { visible: true, trigger: 'first_case' as const };
      }
      if (caseCount >= 3 && caseCount <= 5) {
        return { visible: true, trigger: 'milestone_usage' as const };
      }
    } catch {
      return { visible: false, trigger: 'first_case' as const };
    }

    return { visible: false, trigger: 'first_case' as const };
  }, [forceShow, isPilotMode]);

  const visible = submitted || (!dismissed && promptState.visible);
  const trigger = promptState.trigger;

  const dismiss = () => {
    setDismissed(true);
  };

  const submit = async () => {
    if (!user?.id || !organizationId || rating === 0) return;

    try {
      await fetch("/api/pilot/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          organizationId,
          easeRating: rating,
          category,
          comment: comment.trim() || null,
          trigger,
        }),
      });

      localStorage.setItem(FEEDBACK_GIVEN_KEY, "true");
      setSubmitted(true);
      window.setTimeout(() => {
        setSubmitted(false);
        setDismissed(true);
      }, 2000);
    } catch {
      // fail silently
    }
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
                <p className="text-sm font-medium text-gray-900">Thank you!</p>
                <p className="text-xs text-gray-500 mt-1">Your feedback helps us improve.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">
                      Quick feedback
                    </span>
                  </div>
                  <button
                    onClick={dismiss}
                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                    aria-label="Dismiss feedback"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>

                {/* Question */}
                <p className="text-sm text-gray-700 mb-3">
                  Was this easy to use?
                </p>

                {/* Star rating */}
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                      aria-label={`Rate ${star} out of 5`}
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

                {/* Categories (optional, shown after rating) */}
                {rating > 0 && rating <= 3 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(category === cat.id ? null : cat.id)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          category === cat.id
                            ? "bg-blue-100 border-blue-300 text-blue-700"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input (optional) */}
                {rating > 0 && (
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Any details? (optional)"
                    className="text-xs mb-3 resize-none"
                    rows={2}
                    maxLength={500}
                  />
                )}

                {/* Submit */}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs">
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={submit}
                    disabled={rating === 0}
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    Send
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
    // ignore
  }
}
