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
import { ActionHint } from "@/components/onboarding/action-hint";
import { ApiShapeError, envelopeData, envelopeRows, isRecord, readApiError } from "@/lib/client/api-envelope";
import { asRecord, optionalString, requiredString } from "@/lib/client/row-fields";

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

const TYPE_LABEL_KEYS: Record<SignalType, string> = {
  intake: "intake",
  message: "message",
  alert: "alert",
  system: "system",
};

// ── Transform API data into Signal format ────────────────────────────────────
/** A failure the server explained: its words are shown as they came. */
class ServerMessage extends Error {}

const humanize = (code: string) => code.replace(/_/g, " ");

// A row of GET /api/claims (the crud factory's list): claimId, claimType, description, priority, status, createdAt.
function claimToSignal(value: unknown, defaults: { newSubmission: string; defaultType: string }): Signal | null {
  const c = asRecord(value, "claim");
  // The route does not filter by status; a claim that is not a new submission is not an intake signal.
  if (c.status !== "submitted") return null;
  const claimId = requiredString(c, "claimId");
  const claimType = optionalString(c, "claimType");
  const description = optionalString(c, "description");
  return {
    id: `intake-${claimId}`,
    type: "intake",
    title: `${claimType ? humanize(claimType) : defaults.defaultType}: ${description?.slice(0, 60) ?? defaults.newSubmission}`,
    preview: description?.slice(0, 120) ?? "",
    status: "unread",
    urgency: c.priority === "critical" ? "critical" : c.priority === "high" ? "high" : "normal",
    createdAt: requiredString(c, "createdAt"),
    relatedEntityId: claimId,
    relatedEntityType: "case",
  };
}

// A row of GET /api/notifications (in_app_notifications): the table has no priority and no sender column, so the notice's own type is its urgency.
function notificationToSignal(value: unknown, defaults: { defaultNotification: string }): Signal {
  const n = asRecord(value, "notification");
  // A secure-conversation notice (assignment, waiting in the queue, new message) opens the staff conversation workspace.
  const data = isRecord(n.data) ? n.data : {};
  const threadId = typeof data.threadId === "string" && String(data.event ?? "").startsWith("thread_") ? data.threadId : undefined;
  return {
    id: `alert-${requiredString(n, "id")}`,
    type: threadId ? "message" : "alert",
    title: optionalString(n, "title") ?? defaults.defaultNotification,
    preview: optionalString(n, "message")?.slice(0, 120) ?? "",
    status: n.read === true ? "read" : "unread",
    urgency: n.type === "error" ? "high" : "normal",
    createdAt: requiredString(n, "createdAt"),
    ...(threadId ? { relatedEntityId: data.event === "thread_triage_waiting" ? "queue" : threadId, relatedEntityType: "message" as const } : {}),
  };
}

async function readSource<T>(response: PromiseSettledResult<Response>, rowsOf: (body: unknown) => unknown[], map: (row: unknown) => T | null): Promise<T[]> {
  if (response.status === "rejected") throw response.reason;
  if (!response.value.ok) throw new ServerMessage(await readApiError(response.value, ""));
  return rowsOf(await response.value.json()).flatMap((row) => {
    const item = map(row);
    return item === null ? [] : [item];
  });
}

/** The notifications the inbox route answers: { notifications, unreadCount, pagination } inside the withApi body. */
function notificationRows(body: unknown): unknown[] {
  const { notifications } = envelopeData(body);
  if (!Array.isArray(notifications)) throw new ApiShapeError("no notifications");
  return notifications;
}

// ── Component ────────────────────────────────────────────────────────────────
export function InboxConsole() {
  const t = useTranslations();
  const tInbox = useTranslations("inboxConsole");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    // Fetch from multiple sources in parallel
    const [claimsRes, notifRes] = await Promise.allSettled([
      fetch("/api/claims?status=submitted&limit=100"),
      fetch("/api/notifications?limit=30"),
    ]);

    const claimDefaults = {
      newSubmission: tInbox("signalTitleNew"),
      defaultType: tInbox("signalDefaultType"),
    };
    const notificationDefaults = { defaultNotification: tInbox("signalNotificationDefault") };
    const results = await Promise.allSettled([
      readSource(claimsRes, envelopeRows, (row) => claimToSignal(row, claimDefaults)),
      readSource(notifRes, notificationRows, (row) => notificationToSignal(row, notificationDefaults)),
    ]);

    const items: Signal[] = [];
    const failures: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") items.push(...result.value);
      else failures.push(result.reason instanceof ServerMessage && result.reason.message !== "" ? result.reason.message : t("errors.loadingError"));
    }

    // Sort by createdAt desc
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setSignals(items);
    // A source that could not be read is said so: what is listed is not the whole inbox, and an empty list is not "no signals".
    setError(failures.length > 0 ? [...new Set(failures)].join(" ") : null);
    setLoading(false);
  }, [t, tInbox]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const filtered = signals.filter(s => {
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    if (urgencyFilter !== "all" && s.urgency !== urgencyFilter) return false;
    return true;
  });

  const handleAction = (signal: Signal) => {
    if (signal.relatedEntityId) {
      if (signal.relatedEntityType === "case") {
        router.push(`/${locale}/dashboard/claims/${signal.relatedEntityId}`);
      } else if (signal.relatedEntityType === "message") {
        // A conversation still waiting for assignment is metadata in the queue; it has no page of its own yet.
        router.push(
          signal.relatedEntityId === "queue"
            ? `/${locale}/dashboard/messages/staff`
            : `/${locale}/dashboard/messages/staff?thread=${encodeURIComponent(signal.relatedEntityId)}`,
        );
      } else {
        router.push(`/${locale}/dashboard/inbox?type=message`);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.inbox")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tInbox("subtitle")}
        </p>
        <ActionHint hintKey="inbox-first" text={tInbox("actionHint")} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1 text-xs text-gray-500 mr-1">
          <Filter size={12} /> {tInbox("filterLabel")}
        </span>
        {((["all", "intake", "message", "alert", "system"]) as const).map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === type
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {type === "all" ? tInbox("all") : tInbox(`types.${TYPE_LABEL_KEYS[type]}`)}
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {((["all", "critical", "high", "normal", "low"]) as const).map(urg => (
          <button
            key={urg}
            onClick={() => setUrgencyFilter(urg)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              urgencyFilter === urg
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {urg === "all" ? tInbox("anyUrgency") : tInbox(`urgency.${urg}`)}
          </button>
        ))}
      </div>

      {/* Signal feed */}
      {error !== null && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchSignals()}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        error !== null && signals.length === 0 ? null : (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            {signals.length === 0 ? (
              <>
                <p className="text-gray-500 font-medium">{tInbox("empty.noSignalsTitle")}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {tInbox("empty.noSignalsBody")}
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium">{tInbox("empty.noMatchesTitle")}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {tInbox("empty.noMatchesBody")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        )
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
                      {tInbox(`types.${TYPE_LABEL_KEYS[signal.type]}`)}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${URGENCY_COLORS[signal.urgency]}`}>
                      {tInbox(`urgency.${signal.urgency}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{signal.preview}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(signal.createdAt).toLocaleDateString()}
                    </span>
                    {signal.actor && <span>{tInbox("from", { actor: signal.actor })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {signal.relatedEntityId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleAction(signal)}
                    >
                      {signal.type === "intake" ? tInbox("actions.reviewCase") : tInbox("actions.open")} <ArrowRight size={12} className="ml-1" />
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
