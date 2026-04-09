"use client";

/**
 * InboxConsole — unified signal feed component.
 *
 * Fetches from multiple sources (claims, messages, notifications) and
 * merges them into a single chronological feed.  Provides filter chips
 * for type and urgency, and quick-action buttons on each item.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  FileText,
  Mail,
  Bell,
  AlertTriangle,
  Filter,
  ArrowRight,
  MessageSquare,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Signal, SignalType, SignalUrgency } from "@/lib/types/signal";

// ── Type → icon mapping ─────────────────────────────────────────────────────
const TYPE_ICONS: Record<SignalType, React.ReactNode> = {
  intake: <FileText size={16} className="text-blue-600" />,
  message: <Mail size={16} className="text-indigo-600" />,
  alert: <AlertTriangle size={16} className="text-amber-600" />,
  system: <Bell size={16} className="text-gray-500" />,
};

const URGENCY_COLORS: Record<SignalUrgency, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_LABELS: Record<SignalType, string> = {
  intake: "Intake",
  message: "Message",
  alert: "Alert",
  system: "System",
};

// ── Transform API data into Signal format ────────────────────────────────────
function claimToSignal(c: Record<string, unknown>): Signal {
  return {
    id: `intake-${c.claimId || c.id}`,
    type: "intake",
    title: `${c.claimType || "Case"}: ${(c.description as string)?.slice(0, 60) || "New submission"}`,
    preview: (c.description as string)?.slice(0, 120) || "",
    status: "unread",
    urgency: c.priority === "urgent" ? "high" : c.priority === "critical" ? "critical" : "normal",
    createdAt: (c.createdAt as string) || new Date().toISOString(),
    relatedEntityId: (c.claimId || c.id) as string,
    relatedEntityType: "case",
  };
}

function notificationToSignal(n: Record<string, unknown>): Signal {
  return {
    id: `alert-${n.id}`,
    type: n.type === "message" ? "message" : "alert",
    title: (n.title as string) || "Notification",
    preview: (n.message as string)?.slice(0, 120) || "",
    status: n.read ? "read" : "unread",
    urgency: n.priority === "high" ? "high" : "normal",
    createdAt: (n.createdAt as string) || new Date().toISOString(),
    actor: n.actor as string | undefined,
  };
}

// ── Component ────────────────────────────────────────────────────────────────
export function InboxConsole() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialise filters from URL query params (?type=message&urgency=high)
  const initialType = (searchParams.get("type") as SignalType) || "all";
  const initialUrgency = (searchParams.get("urgency") as SignalUrgency) || "all";
  const [typeFilter, setTypeFilter] = useState<SignalType | "all">(
    ["intake", "message", "alert", "system"].includes(initialType) ? initialType : "all"
  );
  const [urgencyFilter, setUrgencyFilter] = useState<SignalUrgency | "all">(
    ["critical", "high", "normal", "low"].includes(initialUrgency) ? initialUrgency : "all"
  );

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from multiple sources in parallel
      const [claimsRes, notifRes] = await Promise.allSettled([
        fetch("/api/claims?status=submitted&limit=20"),
        fetch("/api/notifications?limit=30"),
      ]);

      const items: Signal[] = [];

      if (claimsRes.status === "fulfilled" && claimsRes.value.ok) {
        const claimsData = await claimsRes.value.json();
        const claimsList = Array.isArray(claimsData) ? claimsData : claimsData.claims || [];
        items.push(...claimsList.map(claimToSignal));
      }

      if (notifRes.status === "fulfilled" && notifRes.value.ok) {
        const notifData = await notifRes.value.json();
        const notifList = Array.isArray(notifData) ? notifData : notifData.notifications || [];
        items.push(...notifList.map(notificationToSignal));
      }

      // Sort by createdAt desc
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSignals(items);
    } catch {
      // Silent — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const filtered = signals.filter(s => {
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    if (urgencyFilter !== "all" && s.urgency !== urgencyFilter) return false;
    return true;
  });

  const handleAction = (signal: Signal, action: string) => {
    if (action === "review" && signal.relatedEntityId) {
      if (signal.relatedEntityType === "case") {
        router.push(`/${locale}/dashboard/claims/${signal.relatedEntityId}`);
      } else {
        router.push(`/${locale}/dashboard/inbox?type=message`);
      }
    } else if (action === "convert_to_case") {
      router.push(`/${locale}/dashboard/claims/new`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.inbox")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everything that needs your attention — intake, messages, alerts, and system signals in one place.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 text-xs text-gray-500 mr-1">
          <Filter size={12} /> Filter:
        </span>
        {(["all", "intake", "message", "alert", "system"] as const).map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === type
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {type === "all" ? "All" : TYPE_LABELS[type]}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {(["all", "critical", "high", "normal", "low"] as const).map(urg => (
          <button
            key={urg}
            onClick={() => setUrgencyFilter(urg)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              urgencyFilter === urg
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {urg === "all" ? "Any urgency" : urg.charAt(0).toUpperCase() + urg.slice(1)}
          </button>
        ))}
      </div>

      {/* Signal feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            {signals.length === 0 ? (
              <>
                <p className="text-gray-500 font-medium">No signals yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  New intake submissions, messages, and alerts will appear here automatically.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium">No items match your filters</p>
                <p className="text-gray-400 text-sm mt-1">
                  Try adjusting your type or urgency filter to see more items.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(signal => (
            <Card
              key={signal.id}
              className={`transition-colors hover:bg-gray-50 ${
                signal.status === "unread" ? "border-l-4 border-l-blue-500" : ""
              }`}
            >
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{TYPE_ICONS[signal.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-gray-900 truncate">{signal.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 text-gray-500 border-gray-200">
                      {TYPE_LABELS[signal.type]}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${URGENCY_COLORS[signal.urgency]}`}>
                      {signal.urgency}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{signal.preview}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(signal.createdAt).toLocaleDateString()}
                    </span>
                    {signal.actor && <span>from {signal.actor}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {signal.relatedEntityId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleAction(signal, "review")}
                    >
                      {signal.type === "intake" ? "Review case" : "Open"} <ArrowRight size={12} className="ml-1" />
                    </Button>
                  )}
                  {signal.type === "intake" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-blue-600"
                      onClick={() => handleAction(signal, "convert_to_case")}
                    >
                      Convert
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
