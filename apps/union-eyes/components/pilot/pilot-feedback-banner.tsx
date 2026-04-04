"use client";

/**
 * Pilot Feedback Banner — positive reinforcement after key actions.
 *
 * Shows a brief success/neutral message at the top of the page
 * that auto-dismisses after 5 seconds. Used after case submission,
 * profile updates, etc. to give users confidence.
 *
 * Only visible when pilot mode is active.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { usePilotMode } from "@/contexts/pilot-mode-context";

interface PilotFeedbackBannerProps {
  message: string;
  variant?: "positive" | "neutral";
  /** Auto-dismiss after this many ms (0 = never). Default 5000. */
  duration?: number;
  onDismiss?: () => void;
}

export function PilotFeedbackBanner({
  message,
  variant = "positive",
  duration = 5000,
  onDismiss,
}: PilotFeedbackBannerProps) {
  const { isPilotMode } = usePilotMode();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isPilotMode || !visible) return null;

  const bgColor = variant === "positive" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200";
  const textColor = variant === "positive" ? "text-green-700" : "text-blue-700";
  const iconColor = variant === "positive" ? "text-green-600" : "text-blue-600";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`mb-4 px-4 py-3 rounded-lg border ${bgColor} flex items-center gap-3`}
        >
          <CheckCircle2 size={18} className={iconColor} />
          <p className={`text-sm font-medium flex-1 ${textColor}`}>{message}</p>
          <button
            type="button"
            onClick={() => { setVisible(false); onDismiss?.(); }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
