"use client";

/**
 * PrioritiesConsole — "What should I do next?" surface.
 *
 * Ranks what the application stores as time-bound: the overdue and upcoming claim deadlines (claim_deadlines, read through /api/deadlines/overdue
 * and /api/deadlines/upcoming) and the active grievances (by their response deadline when they have one). A claim carries no deadline of its own,
 * so claims are not a source. Each source is read on its own: one that fails is named on the screen, it is never dropped from the ranking.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { canAccessDashboardPath, getDashboardExperience, getRoleLandingPath } from "@/lib/dashboard/role-experience";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { ApiShapeError, readApiError } from "@/lib/client/api-envelope";
import { humanize } from "@/lib/client/row-fields";
import { readDeadlinePage, readGrievances, type DeadlineRow, type GrievanceRow, type Urgency } from "./priorities-readers";

interface PriorityItem {
  id: string;
  title: string;
  reason: string;
  urgency: Urgency;
  dueDate: Date | null;
  href: string;
  source: string;
}

interface SourceFailure {
  source: string;
  message: string;
}

interface Loaded {
  items: PriorityItem[];
  total: number;
  failures: SourceFailure[];
}

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
};

const URGENCY_RANK: Record<Urgency, number> = { critical: 0, high: 1, normal: 2 };
const SHOWN = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function copyFor(locale: string) {
  const fr = locale.startsWith("fr");
  return {
    subtitle: fr
      ? "Échéances en retard et à venir et griefs actifs, du plus urgent au moins urgent."
      : "Overdue and upcoming deadlines and active grievances, most urgent first.",
    loading: fr ? "Chargement des priorités" : "Loading priorities",
    allFailed: fr ? "Impossible de charger les priorités. Réessayez pour connaître leur état actuel." : "Priorities could not be loaded. Retry to see their current state.",
    someFailed: fr ? "Certaines priorités n'ont pas pu être chargées. La liste ci-dessous peut être incomplète." : "Some priorities could not be loaded. The list below may be incomplete.",
    retry: fr ? "Réessayer" : "Retry",
    open: fr ? "Ouvrir" : "Open",
    openWorkArea: fr ? "Ouvrir mon espace de travail" : "Open my work area",
    empty: fr ? "Rien d'urgent pour le moment" : "Nothing urgent right now",
    emptyHint: fr ? "Aucune échéance en retard ou à venir et aucun grief actif." : "No overdue or upcoming deadline and no active grievance.",
    showing: (shown: number, total: number) => (fr ? `Affichage des ${shown} éléments les plus urgents sur ${total}.` : `Showing the ${shown} most urgent of ${total}.`),
    sources: {
      overdue: fr ? "Échéances en retard" : "Overdue deadlines",
      upcoming: fr ? "Échéances à venir" : "Upcoming deadlines",
      grievances: fr ? "Griefs" : "Grievances",
    },
    deadlineBadge: fr ? "Échéance" : "Deadline",
    grievanceBadge: fr ? "Grief" : "Grievance",
    grievanceTitle: (title: string) => (fr ? `Grief : ${title}` : `Grievance: ${title}`),
    overdue: fr ? "En retard — action requise" : "Overdue — action required",
    dueToday: fr ? "Échéance aujourd'hui" : "Due today",
    dueTomorrow: fr ? "Échéance demain" : "Due tomorrow",
    dueInDays: (days: number) => (fr ? `Échéance dans ${days} jours` : `Due in ${days} days`),
    responsePassed: fr ? "Délai de réponse dépassé" : "Response deadline passed",
    responseDue: (date: string) => (fr ? `Réponse attendue le ${date}` : `Response due ${date}`),
    status: (status: string) => (fr ? `Statut : ${humanize(status)}` : `Status: ${humanize(status)}`),
    network: fr ? "Erreur réseau" : "Network error",
    unexpected: fr ? "Réponse inattendue du serveur" : "Unexpected response from the server",
    restricted: fr ? "Les priorités sont réservées au personnel qui traite les dossiers." : "Priorities are available to staff who handle cases.",
  };
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  return response.json();
}

function dueOrder(a: PriorityItem, b: PriorityItem): number {
  if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return 0;
}

export function PrioritiesConsole({ role }: { role?: string | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { isPilotMode } = usePilotMode();
  const experience = getDashboardExperience(role);
  const copy = useMemo(() => copyFor(locale), [locale]);
  // The deadline routes answer for the whole organization and a member has no case files to rank, so nothing is requested for one.
  const restricted = experience === "member";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(!restricted);

  const load = useCallback(async () => {
    setLoading(true);
    const now = Date.now();

    const deadlineItem = (row: DeadlineRow, overdue: boolean): PriorityItem => {
      const days = Math.floor((row.dueDate.getTime() - now) / DAY_MS);
      return {
        id: `deadline-${row.id}`,
        title: row.deadlineName,
        reason: overdue ? copy.overdue : days <= 0 ? copy.dueToday : days === 1 ? copy.dueTomorrow : copy.dueInDays(days),
        urgency: overdue ? "critical" : row.priority === "critical" || row.priority === "high" ? "high" : "normal",
        dueDate: row.dueDate,
        href: `/${locale}/dashboard/claims/${row.claimId}`,
        source: copy.deadlineBadge,
      };
    };

    const grievanceItem = (row: GrievanceRow): PriorityItem => {
      const overdue = row.responseDeadline !== null && row.responseDeadline.getTime() < now;
      return {
        id: `grievance-${row.id}`,
        title: copy.grievanceTitle(row.title ?? row.grievanceNumber),
        reason: overdue ? copy.responsePassed : row.responseDeadline ? copy.responseDue(row.responseDeadline.toLocaleDateString(locale)) : copy.status(row.status),
        urgency: overdue ? "critical" : row.priority === "urgent" || row.status === "arbitration" ? "high" : "normal",
        dueDate: row.responseDeadline,
        href: `/${locale}/dashboard/grievances/${row.id}`,
        source: copy.grievanceBadge,
      };
    };

    const sources: Array<{ source: string; read: () => Promise<{ items: PriorityItem[]; total: number }> }> = [
      {
        source: copy.sources.overdue,
        read: async () => {
          const page = readDeadlinePage(await getJson("/api/deadlines/overdue?limit=100"));
          return { items: page.rows.map((row) => deadlineItem(row, true)), total: page.total };
        },
      },
      {
        source: copy.sources.upcoming,
        read: async () => {
          const page = readDeadlinePage(await getJson("/api/deadlines/upcoming?limit=100"));
          return { items: page.rows.map((row) => deadlineItem(row, false)), total: page.total };
        },
      },
      {
        source: copy.sources.grievances,
        read: async () => {
          const rows = readGrievances(await getJson("/api/grievances?status=active"));
          return { items: rows.map(grievanceItem), total: rows.length };
        },
      },
    ];

    const settled = await Promise.allSettled(sources.map((source) => source.read()));
    const items: PriorityItem[] = [];
    const failures: SourceFailure[] = [];
    let total = 0;
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        items.push(...result.value.items);
        total += result.value.total;
        return;
      }
      const reason: unknown = result.reason;
      const message =
        reason instanceof ApiShapeError || reason instanceof SyntaxError
          ? copy.unexpected
          : reason instanceof TypeError
            ? copy.network
            : (reason as Error).message;
      failures.push({ source: sources[index].source, message });
    });

    items.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || dueOrder(a, b) || a.title.localeCompare(b.title));
    setLoaded({ items, total, failures });
    setLoading(false);
  }, [copy, locale]);

  useEffect(() => { if (!restricted) void load(); }, [restricted, load]);

  const shown = loaded ? loaded.items.slice(0, SHOWN) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.priorities")}</h1>
        <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
        <ActionHint hintKey="priorities-first" text="Top priority — start here" />
      </div>

      {restricted ? (
        <Card><CardContent className="py-6 text-sm text-gray-600" role="status">{copy.restricted}</CardContent></Card>
      ) : loading ? (
        <div role="status" aria-label={copy.loading} className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <>
          {loaded && loaded.failures.length > 0 && (
            <Card><CardContent className="space-y-4 py-6" role="alert">
              <p>{shown.length === 0 ? copy.allFailed : copy.someFailed}</p>
              <ul className="list-disc pl-5 text-sm">
                {loaded.failures.map((failure) => (
                  <li key={failure.source}>{failure.source}: {failure.message}</li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => void load()}>{copy.retry}</Button>
            </CardContent></Card>
          )}

          {loaded && loaded.failures.length === 0 && shown.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
                <p className="text-gray-500 font-medium">{copy.empty}</p>
                <p className="text-gray-400 text-sm mt-1">{copy.emptyHint}</p>
              </CardContent>
            </Card>
          )}

          {shown.length > 0 && (
            <div className="space-y-3">
              {shown.map((item, idx) => {
                const allowed = canAccessDashboardPath(item.href.replace(`/${locale}`, ""), experience, isPilotMode);
                return (
                  <Card
                    key={item.id}
                    className={`transition-colors hover:bg-gray-50 ${
                      item.urgency === "critical" ? "border-l-4 border-l-red-500" : ""
                    }`}
                  >
                    <CardContent className="py-3 px-4 flex flex-wrap items-start gap-3">
                      <div className="mt-0.5 shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-foreground break-words">{item.title}</span>
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
                            {item.dueDate.toLocaleDateString(locale)}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs min-h-11 shrink-0 max-w-full"
                        onClick={() => router.push(allowed ? item.href : `/${locale}${getRoleLandingPath(role)}`)}
                      >
                        {allowed ? copy.open : copy.openWorkArea}
                        <ArrowRight size={12} className="ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {loaded && loaded.total > shown.length && (
                <p className="text-xs text-gray-500 text-center">{copy.showing(shown.length, loaded.total)}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
