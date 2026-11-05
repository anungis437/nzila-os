"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Check, Search, Link as LinkIcon, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClauseResult {
  id: string;
  title: string;
  content: string;
  articleNumber: string | null;
  sectionNumber: string | null;
  similarity?: number;
}

interface ClauseSuggestionsProps {
  grievanceId: string;
  description?: string;
  /** Called after the clause is linked to the grievance. */
  onLink?: (clauseId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClauseSuggestions({
  grievanceId,
  description,
  onLink,
}: ClauseSuggestionsProps) {
  const t = useTranslations("clauseSuggestions");
  const [clauses, setClauses] = useState<ClauseResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [linked, setLinked] = useState<ReadonlySet<string>>(new Set());
  const [searchText, setSearchText] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function findClauses() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/grievances/${grievanceId}/suggest-clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: searchText.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { data?: ClauseResult[] } | null;
      if (res.ok && Array.isArray(json?.data)) {
        setClauses(json.data);
        setSearched(true);
      } else {
        setError(t("findFailed"));
      }
    } catch {
      setError(t("findFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(clauseId: string) {
    setLinking(clauseId);
    setError(null);
    try {
      const res = await fetch(`/api/grievances/${grievanceId}/suggest-clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauseId }),
      });
      if (res.ok) {
        setLinked((previous) => new Set(previous).add(clauseId));
        onLink?.(clauseId);
      } else {
        setError(t("linkFailed"));
      }
    } catch {
      setError(t("linkFailed"));
    } finally {
      setLinking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4" /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search bar */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={findClauses}
            disabled={loading || !searchText.trim()}
            className="flex items-center gap-1 rounded bg-purple-600 px-3 py-2 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            {loading ? t("searching") : t("find")}
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {!searched && !loading && (
          <p className="text-sm text-gray-400">{t("intro")}</p>
        )}

        {searched && clauses.length === 0 && !loading && (
          <p className="text-sm text-gray-500">{t("none")}</p>
        )}

        {clauses.length > 0 && (
          <ul className="space-y-3">
            {clauses.map((clause) => (
              <li
                key={clause.id}
                className="rounded border p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{clause.title}</p>
                    {(clause.articleNumber || clause.sectionNumber) && (
                      <p className="text-xs text-gray-500">
                        {clause.articleNumber && t("article", { number: clause.articleNumber })}
                        {clause.sectionNumber && ` ${t("section", { number: clause.sectionNumber })}`}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-600 line-clamp-3">
                      {clause.content}
                    </p>
                    {clause.similarity !== undefined && (
                      <p className="mt-1 text-xs text-purple-600">
                        {t("relevance", { percent: (clause.similarity * 100).toFixed(0) })}
                      </p>
                    )}
                  </div>
                  {linked.has(clause.id) ? (
                    <span className="ml-3 flex items-center gap-1 text-xs text-green-700">
                      <Check className="h-3 w-3" />
                      {t("linked")}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleLink(clause.id)}
                      disabled={linking === clause.id}
                      className="ml-3 flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                    >
                      {linking === clause.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3 w-3" />
                      )}
                      {t("link")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
