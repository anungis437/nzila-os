"use client";

/**
 * ActionHint — subtle inline hint for guiding first actions.
 *
 * Renders a small, non-intrusive hint below or beside a target area.
 * Dismisses permanently (per key) after click or after the user has
 * completed onboarding + performed the action.
 */

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface ActionHintProps {
  /** Unique key for localStorage persistence */
  hintKey: string;
  /** Hint text to display */
  text: string;
  /** Optional className for positioning */
  className?: string;
}

function isHintDismissed(key: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(`ue_hint_${key}`) === "1";
}

function dismissHint(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ue_hint_${key}`, "1");
  } catch {
    // Non-fatal
  }
}

export function ActionHint({ hintKey, text, className = "" }: ActionHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isHintDismissed(hintKey)) {
      // Delay to let the content load first
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, [hintKey]);

  if (!visible) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-blue-600 animate-in fade-in duration-500 ${className}`}
      role="status"
    >
      <ArrowUp size={12} className="animate-bounce" />
      <span>{text}</span>
      <button
        onClick={() => { dismissHint(hintKey); setVisible(false); }}
        className="text-gray-400 hover:text-gray-600 ml-1 text-[10px]"
        aria-label="Dismiss hint"
      >
        ✕
      </button>
    </div>
  );
}
