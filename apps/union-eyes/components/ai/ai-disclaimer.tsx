/**
 * Organizational Intelligence Disclosure Component
 *
 * Must be rendered alongside every governance-mediated intelligence output.
 * Provides clear disclosure that:
 * - Output is bounded organizational interpretation — not autonomous decision-making
 * - Human stewardship review is required before any action
 * - No actions are automatic; all outputs are advisory
 *
 * @module components/ai/ai-disclaimer
 */

"use client";

import { AlertTriangle, Bot, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AiDisclaimerProps {
  /** Confidence score 0–1 */
  confidence: number;
  /** Model version string */
  modelVersion: string;
  /** Compact mode — single line */
  compact?: boolean;
  /** Optional audit reference for traceability */
  auditRef?: string;
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-green-100 text-green-800 border-green-200";
  if (c >= 0.5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return "High confidence";
  if (c >= 0.5) return "Medium confidence";
  return "Low confidence";
}

export function AiDisclaimer({ confidence, modelVersion, compact, auditRef }: AiDisclaimerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="h-3 w-3" />
        <span>Organizational intelligence</span>
        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${confidenceColor(confidence)}`}>
          {confidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
        </Badge>
        <span>• Human review required</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              <Bot className="h-3 w-3 mr-1" />
              Organizational intelligence
            </Badge>
            <Badge variant="outline" className={`text-xs ${confidenceColor(confidence)}`}>
              {confidenceLabel(confidence)} ({(confidence * 100).toFixed(0)}%)
            </Badge>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              <ShieldCheck className="h-3 w-3 mr-1" />
              v{modelVersion}
            </Badge>
          </div>
          <p className="text-amber-800">
            This output is produced by bounded organizational intelligence. It is interpretive and advisory only — it does not constitute a binding decision, legal opinion, or operational directive.
            A human steward or administrator must review and confirm any action before it takes effect.
          </p>
          {auditRef && (
            <p className="text-[10px] text-amber-600">
              Audit ref: {auditRef}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
