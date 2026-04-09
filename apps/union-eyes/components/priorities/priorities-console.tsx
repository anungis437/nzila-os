"use client";

/**
 * PrioritiesConsole — "What should I do next?" surface.
 *
 * Fetches overdue / upcoming items from multiple sources and ranks
 * them by urgency. Supports ?view=team for officers.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionHint } from "@/components/onboarding/action-hint";

interface PriorityItem {
  id: string;
  title: string;
  reason: string;
  urgency: "critical" | "high" | "normal";
  dueDate?: string;
  href: string;
  source: string;
}

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
};

export function PrioritiesConsole() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const isTeamView = params.get("view") === "team";
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPriorities = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch claims with approaching deadlines or overdue status
      const [claimsRes, grievancesRes] = await Promise.allSettled([
        fetch("/api/claims?sort=deadline&limit=10"),
        fetch("/api/grievances?sort=deadline&limit=10"),
      ]);

      const priorityItems: PriorityItem[] = [];

      if (claimsRes.status === "fulfilled" && claimsRes.value.ok) {
        const data = await claimsRes.value.json();
        const claims = Array.isArray(data) ? data : data.claims || [];
        for (const c of claims) {
          const isOverdue = c.deadline && new Date(c.deadline) < new Date();
          priorityItems.push({
            id: `case-${c.claimId || c.id}`,
            title: `${c.claimType || "Case"}: ${(c.description as string)?.slice(0, 50) || "Pending review"}`,
            reason: isOverdue ? "Overdue — action required" : "Approaching deadline",
            urgency: isOverdue ? "critical" : c.priority === "urgent" ? "high" : "normal",
            dueDate: c.deadline,
            href: `/${locale}/dashboard/claims/${c.claimId || c.id}`,
            source: "Cases",
          });
        }
      }

      if (grievancesRes.status === "fulfilled" && grievancesRes.value.ok) {
        const data = await grievancesRes.value.json();
        const grievances = Array.isArray(data) ? data : data.grievances || [];
        for (const g of grievances) {
          const isOverdue = g.deadline && new Date(g.deadline) < new Date();
          if (g.status !== "resolved") {
            priorityItems.push({
              id: `grv-${g.id}`,
              title: `Grievance: ${(g.subject as string)?.slice(0, 50) || g.status}`,
              reason: isOverdue ? "Deadline passed" : `Status: ${g.status}`,
              urgency: isOverdue ? "critical" : g.status === "arbitration" ? "high" : "normal",
              dueDate: g.deadline,
              href: `/${locale}/dashboard/grievances/${g.id}`,
              source: "Grievances",
            });
          }
        }
      }

      // Sort: critical first, then high, then normal
      const order = { critical: 0, high: 1, normal: 2 };
      priorityItems.sort((a, b) => order[a.urgency] - order[b.urgency]);

      setItems(priorityItems.slice(0, 10));
    } catch {
      // Silent — empty state
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { fetchPriorities(); }, [fetchPriorities]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.priorities")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTeamView
              ? "Team-level priorities — items your team should address next."
              : "What should you do next? Items ranked by urgency and deadline."}
          </p>
          <ActionHint
            hintKey={isTeamView ? "priorities-team-first" : "priorities-first"}
            text="Top priority — start here"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              isTeamView
                ? `/${locale}/dashboard/priorities`
                : `/${locale}/dashboard/priorities?view=team`
            )
          }
        >
          {isTeamView ? "My priorities" : "Team view"}
        </Button>
      </div>

      {/* Priority items */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
            <p className="text-gray-500 font-medium">Nothing urgent right now</p>
            <p className="text-gray-400 text-sm mt-1">
              All items are on track. Check <span className="text-blue-600">Inbox</span> for
              new signals or <span className="text-blue-600">Work</span> for active casework.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <Card
              key={item.id}
              className={`transition-colors hover:bg-gray-50 ${
                item.urgency === "critical" ? "border-l-4 border-l-red-500" : ""
              }`}
            >
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-gray-900 truncate">{item.title}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${URGENCY_STYLES[item.urgency]}`}>
                      {item.urgency}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0 text-gray-500 border-gray-200">
                      {item.source}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{item.reason}</p>
                  {item.dueDate && (
                    <span className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                      <Calendar size={10} />
                      {new Date(item.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 shrink-0"
                  onClick={() => router.push(item.href)}
                >
                  Handle now <ArrowRight size={12} className="ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
