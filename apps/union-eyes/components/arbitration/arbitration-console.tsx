"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Scale,
  Clock,
  Calendar,
  Gavel,
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  MapPin,
  DollarSign,
  Users,
  ExternalLink,
  Filter,
} from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";

type ArbitrationStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "adjourned"
  | "reserved"
  | "award_rendered"
  | "settled"
  | "withdrawn";

interface ArbitrationCase {
  id: string;
  arbitrationNumber: string;
  grievanceId: string;
  boardName: string;
  boardType: string;
  status: ArbitrationStatus;
  scheduledDate: string | null;
  location: string | null;
  virtualMeetingUrl: string | null;
  submissionDeadline: string | null;
  evidenceDeadline: string | null;
  replyDeadline: string | null;
  hearingDates: string[] | null;
  adjournedTo: string | null;
  awardDeadline: string | null;
  awardDate: string | null;
  awardSummary: string | null;
  arbitratorNames: string[] | null;
  unionAppointee: string | null;
  employerAppointee: string | null;
  chairAppointee: string | null;
  unionCostShare: number | null;
  employerCostShare: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  createdAt: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactElement }> = {
  pending: { color: "text-yellow-700 bg-yellow-100 border-yellow-200", icon: <Clock className="w-3 h-3" /> },
  scheduled: { color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Calendar className="w-3 h-3" /> },
  in_progress: { color: "text-purple-700 bg-purple-100 border-purple-200", icon: <Gavel className="w-3 h-3" /> },
  adjourned: { color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Clock className="w-3 h-3" /> },
  reserved: { color: "text-indigo-700 bg-indigo-100 border-indigo-200", icon: <Scale className="w-3 h-3" /> },
  award_rendered: { color: "text-green-700 bg-green-100 border-green-200", icon: <CheckCircle className="w-3 h-3" /> },
  settled: { color: "text-teal-700 bg-teal-100 border-teal-200", icon: <CheckCircle className="w-3 h-3" /> },
  withdrawn: { color: "text-gray-700 bg-gray-100 border-gray-200", icon: <FileText className="w-3 h-3" /> },
};

const defaultStatus = statusConfig.pending;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiToCase(raw: any): ArbitrationCase {
  return {
    id: raw.id ?? "",
    arbitrationNumber: raw.arbitrationNumber ?? raw.arbitration_number ?? "",
    grievanceId: raw.grievanceId ?? raw.grievance_id ?? "",
    boardName: raw.boardName ?? raw.board_name ?? "",
    boardType: raw.boardType ?? raw.board_type ?? "",
    status: raw.status ?? "pending",
    scheduledDate: raw.scheduledDate ?? raw.scheduled_date ?? null,
    location: raw.location ?? null,
    virtualMeetingUrl: raw.virtualMeetingUrl ?? raw.virtual_meeting_url ?? null,
    submissionDeadline: raw.submissionDeadline ?? raw.submission_deadline ?? null,
    evidenceDeadline: raw.evidenceDeadline ?? raw.evidence_deadline ?? null,
    replyDeadline: raw.replyDeadline ?? raw.reply_deadline ?? null,
    hearingDates: raw.hearingDates ?? raw.hearing_dates ?? null,
    adjournedTo: raw.adjournedTo ?? raw.adjourned_to ?? null,
    awardDeadline: raw.awardDeadline ?? raw.award_deadline ?? null,
    awardDate: raw.awardDate ?? raw.award_date ?? null,
    awardSummary: raw.awardSummary ?? raw.award_summary ?? null,
    arbitratorNames: raw.arbitratorNames ?? raw.arbitrator_names ?? null,
    unionAppointee: raw.unionAppointee ?? raw.union_appointee ?? null,
    employerAppointee: raw.employerAppointee ?? raw.employer_appointee ?? null,
    chairAppointee: raw.chairAppointee ?? raw.chair_appointee ?? null,
    unionCostShare: raw.unionCostShare ?? raw.union_cost_share ?? null,
    employerCostShare: raw.employerCostShare ?? raw.employer_cost_share ?? null,
    estimatedCost: raw.estimatedCost ?? raw.estimated_cost ?? null,
    actualCost: raw.actualCost ?? raw.actual_cost ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount);
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ArbitrationConsole() {
  const t = useTranslations("arbitrationConsole");
  const { organizationId } = useOrganization();
  const [cases, setCases] = useState<ArbitrationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ArbitrationStatus | "all">("all");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  useEffect(() => {
    const fetchArbitrations = async () => {
      try {
        setLoading(true);
        setError(null);
        const url = organizationId
          ? `/api/arbitrations?organizationId=${organizationId}`
          : "/api/arbitrations";
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          // withApi wraps in { success, data: { data: rows, pagination } }
          const items = json?.data?.data ?? json?.data ?? json ?? [];
          setCases(Array.isArray(items) ? items.map(mapApiToCase) : []);
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? t("errors.loadFailedStatus", { status: res.status }));
        }
      } catch {
        setError(t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    fetchArbitrations();
  }, [organizationId, t]);

  // Filter
  const filteredCases = cases.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (c.arbitrationNumber ?? "").toLowerCase().includes(q) ||
      (c.boardName ?? "").toLowerCase().includes(q) ||
      (c.chairAppointee ?? "").toLowerCase().includes(q);
    const matchesStatus = selectedStatus === "all" || c.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const activeCount = cases.filter((c) => !["award_rendered", "settled", "withdrawn"].includes(c.status)).length;
  const scheduledCount = cases.filter((c) => c.status === "scheduled").length;
  const completedCount = cases.filter((c) => ["award_rendered", "settled"].includes(c.status)).length;

  // Upcoming deadlines
  const upcomingDeadlines = cases
    .flatMap((c) => {
      const deadlines: { label: string; date: string; caseNum: string; daysLeft: number }[] = [];
      for (const [key, label] of [
        ["submissionDeadline", "Submission"],
        ["evidenceDeadline", "Evidence"],
        ["replyDeadline", "Reply"],
        ["awardDeadline", "Award"],
      ] as const) {
        const d = c[key];
        if (d) {
          const days = daysUntil(d);
          if (days != null && days >= 0 && days <= 30) {
            deadlines.push({ label, date: d, caseNum: c.arbitrationNumber, daysLeft: days });
          }
        }
      }
      return deadlines;
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto text-red-400 mb-2" size={24} />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <Scale size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="font-medium text-gray-700 mb-1">{t("empty.noCasesTitle")}</p>
        <p className="text-sm text-gray-400">
          {t("empty.noCasesBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-gray-500">{t("stats.activeCases")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduledCount}</p>
              <p className="text-xs text-gray-500">{t("stats.scheduledHearings")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-xs text-gray-500">{t("stats.completedSettled")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> {t("upcomingDeadlines")}
            </h3>
            <div className="space-y-1">
              {upcomingDeadlines.slice(0, 5).map((dl, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium">{dl.caseNum}</span> — {t("deadlineSuffix", { label: t(`deadlineLabels.${dl.label}`) })}
                  </span>
                  <span className={`font-medium ${dl.daysLeft <= 3 ? "text-red-600" : dl.daysLeft <= 7 ? "text-orange-600" : "text-gray-600"}`}>
                    {dl.daysLeft === 0 ? t("today") : t("daysShort", { days: dl.daysLeft })} · {formatDate(dl.date)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ArbitrationStatus | "all")}
            className="pl-10 pr-8 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none"
          >
            <option value="all">{t("statusOptions.all")}</option>
            <option value="pending">{t("statuses.pending")}</option>
            <option value="scheduled">{t("statuses.scheduled")}</option>
            <option value="in_progress">{t("statuses.in_progress")}</option>
            <option value="adjourned">{t("statuses.adjourned")}</option>
            <option value="reserved">{t("statusOptions.reserved")}</option>
            <option value="award_rendered">{t("statuses.award_rendered")}</option>
            <option value="settled">{t("statuses.settled")}</option>
            <option value="withdrawn">{t("statuses.withdrawn")}</option>
          </select>
        </div>
      </div>

      {/* Cases list */}
      <AnimatePresence mode="popLayout">
        {filteredCases.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-sm text-gray-400"
          >
            {t("empty.noMatches")}
          </motion.div>
        ) : (
          filteredCases.map((arb, index) => {
            const isExpanded = expandedCase === arb.id;
            const si = statusConfig[arb.status] ?? defaultStatus;

            return (
              <motion.div
                key={arb.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedCase(isExpanded ? null : arb.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {arb.arbitrationNumber}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${si.color}`}>
                              {si.icon} {t(`statuses.${arb.status}`)}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              {arb.boardType}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{arb.boardName}</p>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>

                      {/* Quick info row */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        {arb.scheduledDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(arb.scheduledDate)}
                          </span>
                        )}
                        {arb.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {arb.location}
                          </span>
                        )}
                        {arb.chairAppointee && (
                          <span className="flex items-center gap-1">
                            <Gavel className="w-3 h-3" />
                            {t("chairPrefix", { name: arb.chairAppointee })}
                          </span>
                        )}
                        {arb.estimatedCost != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(arb.estimatedCost)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t space-y-4">
                            {/* Panel */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Users className="w-4 h-4" /> {t("panel.title")}
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-400 text-xs">{t("panel.unionAppointee")}</p>
                                  <p className="text-gray-700">{arb.unionAppointee || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs">{t("panel.employerAppointee")}</p>
                                  <p className="text-gray-700">{arb.employerAppointee || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-gray-400 text-xs">{t("panel.chair")}</p>
                                  <p className="text-gray-700">{arb.chairAppointee || "—"}</p>
                                </div>
                              </div>
                              {arb.arbitratorNames && arb.arbitratorNames.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {t("panel.panelList", { names: arb.arbitratorNames.join(", ") })}
                                </p>
                              )}
                            </div>

                            {/* Deadlines */}
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {t("deadlines.title")}
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                {(
                                  [
                                    ["Submission", arb.submissionDeadline],
                                    ["Evidence", arb.evidenceDeadline],
                                    ["Reply", arb.replyDeadline],
                                    ["Award", arb.awardDeadline],
                                  ] as const
                                ).map(([label, date]) => {
                                  const days = daysUntil(date);
                                  return (
                                    <div key={label}>
                                      <p className="text-gray-400 text-xs">{t(`deadlineLabels.${label}`)}</p>
                                      <p className="text-gray-700">{formatDate(date)}</p>
                                      {days != null && days >= 0 && (
                                        <p className={`text-xs ${days <= 3 ? "text-red-600 font-medium" : days <= 7 ? "text-orange-600" : "text-gray-500"}`}>
                                          {days === 0 ? t("dueToday") : t("daysLeft", { days })}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Hearing dates */}
                            {arb.hearingDates && arb.hearingDates.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                  <Calendar className="w-4 h-4" /> {t("hearingDates.title")}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {arb.hearingDates.map((d, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                                    >
                                      {formatDate(d)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Costs */}
                            {(arb.estimatedCost != null || arb.actualCost != null) && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                  <DollarSign className="w-4 h-4" /> {t("costs.title")}
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <p className="text-gray-400 text-xs">{t("costs.estimated")}</p>
                                    <p className="text-gray-700">{formatCurrency(arb.estimatedCost)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 text-xs">{t("costs.actual")}</p>
                                    <p className="text-gray-700">{formatCurrency(arb.actualCost)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 text-xs">{t("costs.unionShare")}</p>
                                    <p className="text-gray-700">{arb.unionCostShare != null ? `${arb.unionCostShare}%` : "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 text-xs">{t("costs.employerShare")}</p>
                                    <p className="text-gray-700">{arb.employerCostShare != null ? `${arb.employerCostShare}%` : "—"}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Award summary */}
                            {arb.awardSummary && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                  <Gavel className="w-4 h-4" /> {t("award.title")}
                                </h4>
                                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                                  {arb.awardSummary}
                                </p>
                                {arb.awardDate && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    {t("award.rendered", { date: formatDate(arb.awardDate) })}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Virtual link */}
                            {arb.virtualMeetingUrl && (
                              <a
                                href={arb.virtualMeetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" /> {t("joinVirtual")}
                              </a>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </div>
  );
}
