/**
 * Satisfaction Survey Component — "Rate My Representative"
 *
 * Post-case-closure survey with 6 metrics:
 * Communication, Responsiveness, Knowledge, Advocacy, Professionalism, Outcome
 *
 * Features:
 * - Animated star rating (1-5)
 * - Real-time overall score
 * - Free-text feedback
 * - Would-recommend toggle
 * - Anonymous submission option
 * - Decline capability
 *
 * @module components/satisfaction/satisfaction-survey
 */

"use client";

import * as React from "react";
import {
  Star,
  Send,
  X,
  Shield,
  MessageSquare,
  Clock,
  BookOpen,
  Megaphone,
  Briefcase,
  Target,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface SatisfactionMetric {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export interface SatisfactionSurveyProps {
  surveyId: string;
  claimNumber?: string;
  lroName?: string;
  onComplete?: () => void;
  onDecline?: () => void;
}

// ── Metrics definition ──────────────────────────────────────────────────────

const METRICS: SatisfactionMetric[] = [
  {
    key: "communicationRating",
    label: "Communication",
    description: "Kept you informed throughout the process",
    icon: <MessageSquare className="h-5 w-5" />,
  },
  {
    key: "responsivenessRating",
    label: "Responsiveness",
    description: "Replied to your messages and calls in a timely manner",
    icon: <Clock className="h-5 w-5" />,
  },
  {
    key: "knowledgeRating",
    label: "Knowledge",
    description: "Understood the collective agreement and your rights",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    key: "advocacyRating",
    label: "Advocacy",
    description: "Fought effectively for your interests",
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    key: "professionalismRating",
    label: "Professionalism",
    description: "Respectful, prepared, and reliable",
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    key: "outcomeRating",
    label: "Outcome Satisfaction",
    description: "How satisfied are you with the final result",
    icon: <Target className="h-5 w-5" />,
  },
];

// ── Star Rating Sub-component ───────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = React.useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className={cn(
            "transition-all duration-150 ease-in-out",
            "hover:scale-110 active:scale-95",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} out of 5`}
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              star <= (hovered || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            )}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted-foreground self-center">
          {value}/5
        </span>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SatisfactionSurvey({
  surveyId,
  claimNumber,
  lroName,
  onComplete,
  onDecline,
}: SatisfactionSurveyProps) {
  const [ratings, setRatings] = React.useState<Record<string, number>>({});
  const [feedback, setFeedback] = React.useState("");
  const [wouldRecommend, setWouldRecommend] = React.useState<boolean | null>(null);
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const completedCount = METRICS.filter((m) => ratings[m.key] > 0).length;
  const allRated = completedCount === METRICS.length;

  const overallScore =
    allRated
      ? (
          Object.values(ratings).reduce((a, b) => a + b, 0) / METRICS.length
        ).toFixed(1)
      : null;

  async function handleSubmit() {
    if (!allRated) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/satisfaction/${surveyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...ratings,
          feedback: feedback || undefined,
          wouldRecommend: wouldRecommend ?? undefined,
          isAnonymous,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to submit survey");
      }

      setSubmitted(true);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      await fetch(`/api/satisfaction/${surveyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      onDecline?.();
    } catch {
      /* non-critical */
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success State ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto border-green-200 bg-green-50/50">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
          <h3 className="text-xl font-semibold text-green-900">
            Thank You for Your Feedback
          </h3>
          <p className="text-green-700">
            Your response helps us improve the quality of representation
            for all members.
          </p>
          {overallScore && (
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold">{overallScore}</span>
              <span className="text-muted-foreground">overall</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Survey Form ─────────────────────────────────────────────────────────

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Rate Your Union Representative</CardTitle>
            <CardDescription className="mt-1">
              {claimNumber && (
                <span className="text-muted-foreground">
                  Case #{claimNumber}
                  {lroName && <> &middot; Represented by <strong>{lroName}</strong></>}
                </span>
              )}
              {!claimNumber && lroName && (
                <span>How was your experience with <strong>{lroName}</strong>?</span>
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {completedCount}/{METRICS.length}
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(completedCount / METRICS.length) * 100}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rating Metrics */}
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border transition-colors",
              ratings[metric.key] > 0
                ? "border-primary/20 bg-primary/5"
                : "border-transparent hover:bg-muted/50"
            )}
          >
            <div className="mt-0.5 text-primary">{metric.icon}</div>
            <div className="flex-1 space-y-1.5">
              <div className="font-medium">{metric.label}</div>
              <div className="text-sm text-muted-foreground">
                {metric.description}
              </div>
              <StarRating
                value={ratings[metric.key] || 0}
                onChange={(val) =>
                  setRatings((prev) => ({ ...prev, [metric.key]: val }))
                }
                disabled={submitting}
              />
            </div>
          </div>
        ))}

        {/* Overall Score Display */}
        {overallScore && (
          <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            <div>
              <span className="text-2xl font-bold">{overallScore}</span>
              <span className="text-muted-foreground ml-1">/ 5.0 overall</span>
            </div>
          </div>
        )}

        {/* Free-text Feedback */}
        <div className="space-y-2">
          <Label htmlFor="feedback">Additional Comments (optional)</Label>
          <Textarea
            id="feedback"
            placeholder="Tell us more about your experience..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={2000}
            disabled={submitting}
            className="min-h-25"
          />
          {feedback.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/2000
            </p>
          )}
        </div>

        {/* Would Recommend */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <div className="font-medium">Would you recommend your rep?</div>
            <div className="text-sm text-muted-foreground">
              Would you choose the same representative again?
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={wouldRecommend === true ? "default" : "outline"}
              size="sm"
              onClick={() => setWouldRecommend(true)}
              disabled={submitting}
            >
              Yes
            </Button>
            <Button
              variant={wouldRecommend === false ? "destructive" : "outline"}
              size="sm"
              onClick={() => setWouldRecommend(false)}
              disabled={submitting}
            >
              No
            </Button>
          </div>
        </div>

        {/* Anonymous Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Submit anonymously</div>
              <div className="text-xs text-muted-foreground">
                Your name will not be visible to your representative
              </div>
            </div>
          </div>
          <Switch
            checked={isAnonymous}
            onCheckedChange={setIsAnonymous}
            disabled={submitting}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDecline}
            disabled={submitting}
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allRated || submitting}
            className="min-w-35"
          >
            {submitting ? (
              <span className="animate-pulse">Submitting...</span>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Rating
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
