/**
 * Steward Copilot Drawer
 *
 * A slide-out panel that lets stewards query the AI copilot,
 * view AI responses, and provide accept/edit/reject feedback.
 *
 * @module components/ai/steward-copilot-drawer
 */

"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiDisclaimer } from "./ai-disclaimer";
import { AIBanner } from "@/components/ai";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageSquare,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useFeatureFlag } from "@/lib/hooks/use-feature-flags";

type ActionType =
  | "timeline_summary"
  | "suggest_action"
  | "draft_response"
  | "explain_clause"
  | "risk_brief"
  | "custom_query";

interface CopilotResult {
  available: boolean;
  data?: {
    responseText: string;
    structuredOutput: Record<string, unknown> | null;
    suggestedActions: string[];
    sources: string[];
  };
  confidence: number;
  explanation: string;
  modelVersion: string;
  auditRef: string;
}

interface StewardCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

const ACTION_LABELS: Record<ActionType, string> = {
  timeline_summary: "Summarise Timeline",
  suggest_action: "Suggest Next Action",
  draft_response: "Draft Response",
  explain_clause: "Explain Clause",
  risk_brief: "Risk Brief",
  custom_query: "Custom Query",
};

export function StewardCopilotDrawer({
  open,
  onClose,
  relatedEntityType,
  relatedEntityId,
}: StewardCopilotDrawerProps) {
  const enabled = useFeatureFlag("ai_steward_copilot");
  const [action, setAction] = useState<ActionType>("suggest_action");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [editedResponse, setEditedResponse] = useState("");

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setFeedbackSent(false);
    try {
      const res = await fetch("/api/ai/copilot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: action,
          relatedEntityType,
          relatedEntityId,
          query: action === "custom_query" ? query : undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setResult(json.data);
        setSessionId(json.data.auditRef ?? null);
        setEditedResponse(json.data.data?.responseText ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [action, query, relatedEntityType, relatedEntityId]);

  const handleFeedback = useCallback(
    async (outcome: "accepted" | "edited" | "rejected", rating?: number) => {
      if (!sessionId) return;
      await fetch(`/api/ai/copilot/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          editedResponse: outcome === "edited" ? editedResponse : undefined,
          feedbackRating: rating,
        }),
      });
      setFeedbackSent(true);
    },
    [sessionId, editedResponse],
  );

  if (!enabled || !open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-violet-600" />
          <span className="font-semibold">Steward Copilot</span>
          <Badge variant="outline" className="text-[10px]">AI</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Action selector */}
      <div className="p-4 border-b">
        <p className="text-xs text-muted-foreground mb-2">Action</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(ACTION_LABELS) as ActionType[]).map((a) => (
            <Button
              key={a}
              size="sm"
              variant={action === a ? "default" : "outline"}
              className="text-xs h-7"
              onClick={() => setAction(a)}
            >
              {ACTION_LABELS[a]}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom query input */}
      {action === "custom_query" && (
        <div className="p-4 border-b">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask the copilot anything about this case…"
            rows={3}
            className="text-sm"
          />
        </div>
      )}

      {/* Submit */}
      <div className="p-4 border-b">
        <Button onClick={handleSubmit} disabled={loading} size="sm" className="w-full">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {loading ? "Thinking…" : "Ask Copilot"}
        </Button>
      </div>

      {/* Result area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {result?.available && result.data && (
          <>
            <AIBanner variant="info" context="analysis" />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Response
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  rows={6}
                  className="text-sm"
                />

                {/* Suggested actions */}
                {result.data.suggestedActions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Next Steps</p>
                    <ul className="space-y-1">
                      {result.data.suggestedActions.map((sa, i) => (
                        <li key={i} className="flex items-start gap-1 text-xs">
                          <ChevronRight className="h-3 w-3 mt-0.5 text-violet-500" />
                          {sa}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources */}
                {result.data.sources.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Sources: {result.data.sources.join(", ")}
                  </div>
                )}

                <AiDisclaimer
                  confidence={result.confidence}
                  modelVersion={result.modelVersion}
                  auditRef={result.auditRef}
                  compact
                />
              </CardContent>
            </Card>

            {/* Feedback */}
            {!feedbackSent ? (
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleFeedback("accepted", 5)}>
                  <ThumbsUp className="h-3 w-3 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleFeedback("edited", 3)}>
                  <Star className="h-3 w-3 mr-1" /> Use Edited
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleFeedback("rejected", 1)}>
                  <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                </Button>
              </div>
            ) : (
              <p className="text-center text-xs text-green-600">Feedback recorded — thank you!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
