"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Star, MapPin, Briefcase, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StewardCandidate {
  stewardId: string;
  userId: string;
  region: string | null;
  specialization: string | null;
  currentCaseload: number;
  maxCaseload: number;
  score: number;
}

interface StewardRecommendationsProps {
  grievanceId: string;
  onAssign?: (stewardId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StewardRecommendations({
  grievanceId,
  onAssign,
}: StewardRecommendationsProps) {
  const t = useTranslations("steward.recommendations");
  const [candidates, setCandidates] = useState<StewardCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/grievances/${grievanceId}/recommend-steward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.data) {
        setCandidates(json.data);
      } else {
        setError(json.error?.message ?? t("failedToGet"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(stewardId: string) {
    setAssigning(stewardId);
    try {
      const res = await fetch(`/api/grievances/${grievanceId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stewardId }),
      });
      if (res.ok) {
        onAssign?.(stewardId);
      }
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> {t("title")}
        </CardTitle>
        <button
          onClick={fetchRecommendations}
          disabled={loading}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Star className="h-3 w-3" />
          )}
          {loading ? t("scoring") : t("findBestMatch")}
        </button>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}
        {candidates.length === 0 && !loading && (
          <p className="text-sm text-gray-400">
            {t("emptyState")}
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="space-y-3">
            {candidates.map((c, idx) => (
              <li
                key={c.stewardId}
                className="flex items-center justify-between rounded border p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Steward {c.userId.slice(0, 8)}…</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      {c.region && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.region}
                        </span>
                      )}
                      {c.specialization && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> {c.specialization}
                        </span>
                      )}
                      <span>
                        Load: {c.currentCaseload}/{c.maxCaseload}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    {c.score}
                  </span>
                  <button
                    onClick={() => handleAssign(c.stewardId)}
                    disabled={assigning === c.stewardId}
                    className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {assigning === c.stewardId ? t("assigning") : t("assignButton")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
