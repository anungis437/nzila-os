"use client";

/**
 * The grievances workbench: list, filter, file, advance, assign.
 *
 * Reads GET /api/grievances, which answers { success, data: rows } with the stored grievance rows (and, for an unassigned intake the
 * caller may only triage, a handful of columns without the narrative). Nothing is filled in for a column a row does not carry: a missing
 * value is shown as missing, and a response that is not that shape is an error with a retry, not an empty list.
 *
 * Documents are not added from this list: POST /api/grievances/:id/documents takes the metadata of an uploaded file, which only the case
 * page collects, so the action here opens the case.
 */

import React from 'react';
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from "@/components/ui/card";
import { StewardRecommendations } from "@/components/steward-recommendations";
import { ApiShapeError, isRecord, readApiError } from "@/lib/client/api-envelope";
import type { grievanceTypeEnum } from "@/db/schema/domains/claims/grievances";
import {
  Scale,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  User,
  Gavel,
  Filter,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Flag,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
} from "lucide-react";

type GrievanceStatus = "intake" | "filed" | "step-1" | "step-2" | "step-3" | "arbitration" | "resolved" | "withdrawn" | "other";
type GrievancePriority = "low" | "medium" | "high" | "urgent";
type GrievanceType = (typeof grievanceTypeEnum.enumValues)[number];

interface Grievance {
  id: string;
  number: string;
  /** Null on an intake the caller may only triage: it carries no narrative. */
  title: string | null;
  description: string | null;
  status: GrievanceStatus;
  /** The status as stored; the label of a status this screen has no group for. */
  rawStatus: string;
  priority: GrievancePriority | null;
  category: string;
  /** Null until the grievance is filed. */
  filedDate: string | null;
  createdDate: string | null;
  resolvedDate: string | null;
  deadline: string | null;
  daysUntilDeadline: number | null;
  currentStep: string | null;
  grievant: string | null;
  management: string | null;
  violatedArticle: string | null;
  remedy: string | null;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  date: string;
  event: string;
  description: string | null;
}

// Group the stored statuses into the ones this screen filters by. A draft is a member's intake that nobody has converted: it is not filed.
const STATUS_GROUP: Record<string, GrievanceStatus> = {
  "draft": "intake",
  "new": "filed",
  "filed": "filed",
  "acknowledged": "step-1",
  "investigating": "step-1",
  "response_due": "step-2",
  "response_received": "step-2",
  "escalated": "step-3",
  "mediation": "step-3",
  "arbitration": "arbitration",
  "settled": "resolved",
  "closed": "resolved",
  "closed_no_case": "resolved",
  "converted": "resolved",
  "denied": "withdrawn",
  "withdrawn": "withdrawn",
};

const PRIORITIES: readonly GrievancePriority[] = ["low", "medium", "high", "urgent"];

const COPY = {
  en: {
    intake: "Intake (not filed)",
    restricted: "Intake awaiting triage (details are not shown to you)",
    none: "—",
    noTimeline: "No timeline entries are recorded for this grievance.",
    retry: "Retry",
    dismiss: "Dismiss",
    statusFailed: "The status could not be changed",
    fileFailed: "The grievance could not be filed",
  },
  fr: {
    intake: "Demande (non déposée)",
    restricted: "Demande en attente de triage (les détails ne vous sont pas affichés)",
    none: "—",
    noTimeline: "Aucune entrée de chronologie n’est enregistrée pour ce grief.",
    retry: "Réessayer",
    dismiss: "Fermer",
    statusFailed: "Le statut n’a pas pu être modifié",
    fileFailed: "Le grief n’a pas pu être déposé",
  },
} as const;

// Keyed by the database enum, so a type added there cannot be left without a label.
const TYPE_LABELS: Record<GrievanceType, { en: string; fr: string }> = {
  individual: { en: "Individual grievance", fr: "Grief individuel" },
  group: { en: "Group grievance", fr: "Grief collectif" },
  policy: { en: "Policy grievance", fr: "Grief de principe" },
  contract: { en: "Collective agreement", fr: "Convention collective" },
  harassment: { en: "Harassment", fr: "Harcèlement" },
  discrimination: { en: "Discrimination", fr: "Discrimination" },
  safety: { en: "Health and safety", fr: "Santé et sécurité" },
  seniority: { en: "Seniority", fr: "Ancienneté" },
  discipline: { en: "Discipline", fr: "Mesure disciplinaire" },
  termination: { en: "Termination", fr: "Congédiement" },
  other: { en: "Other", fr: "Autre" },
};

/** The types POST /api/grievances accepts, which are the grievance_type enum. */
export const GRIEVANCE_TYPE_ORDER: readonly GrievanceType[] = [
  "individual", "group", "policy", "contract", "harassment", "discrimination", "safety", "seniority", "discipline", "termination", "other",
];

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const DAY_MS = 86_400_000;

function toTimeline(value: unknown): TimelineEvent[] {
  if (!Array.isArray(value)) return [];
  // The column is free-form JSON: an entry that is not { date, action } cannot be shown as an event, and is left out of the list.
  return value.flatMap((entry): TimelineEvent[] =>
    isRecord(entry) && typeof entry.date === "string" && typeof entry.action === "string"
      ? [{ date: entry.date, event: entry.action, description: text(entry.notes) }]
      : [],
  );
}

/** One row of GET /api/grievances. Columns the row does not carry stay null. */
function toGrievance(raw: unknown): Grievance {
  if (!isRecord(raw)) throw new ApiShapeError("a grievance that is not a record");
  const id = text(raw.id);
  const number = text(raw.grievanceNumber);
  if (!id || !number) throw new ApiShapeError("a grievance without an id or number");
  const rawStatus = text(raw.status) ?? "";
  const deadline = text(raw.responseDeadline);
  const priority = PRIORITIES.find((candidate) => candidate === raw.priority) ?? null;
  return {
    id,
    number,
    title: text(raw.title),
    description: text(raw.description),
    status: STATUS_GROUP[rawStatus] ?? "other",
    rawStatus,
    priority,
    category: text(raw.type) ?? "",
    filedDate: text(raw.filedDate),
    createdDate: text(raw.createdAt),
    resolvedDate: text(raw.resolvedAt),
    deadline,
    daysUntilDeadline: deadline ? Math.ceil((Date.parse(deadline) - Date.now()) / DAY_MS) : null,
    currentStep: text(raw.step),
    grievant: text(raw.grievantName),
    management: text(raw.employerName),
    violatedArticle: text(raw.cbaArticle),
    remedy: text(raw.desiredOutcome),
    timeline: toTimeline(raw.timeline),
  };
}

type SortField = "filedDate" | "priority" | "status" | "title";
type SortOrder = "asc" | "desc";

const STATUS_FILTERS = ["all", "intake", "filed", "step-1", "step-2", "step-3", "arbitration", "resolved", "withdrawn"] as const;

export function GrievancesConsole() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<GrievanceStatus | "all">("all");
  const [selectedPriority, setSelectedPriority] = useState<GrievancePriority | "all">("all");
  const [expandedGrievance, setExpandedGrievance] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("filedDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // The grievance whose steward recommendations are open; the assignment itself is made from that list.
  const [assigningGrievanceId, setAssigningGrievanceId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Grievances data from API
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const t = useTranslations();
  const locale = useLocale();
  const language = locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  const copy = COPY[language];

  const formatDate = (value: string | null): string => {
    if (!value) return copy.none;
    const time = Date.parse(value);
    return Number.isNaN(time) ? copy.none : new Date(time).toLocaleDateString(locale);
  };
  const categoryLabel = (category: string): string => {
    const labels: Partial<Record<string, { en: string; fr: string }>> = TYPE_LABELS;
    return labels[category]?.[language] ?? category;
  };

  const fetchGrievances = useCallback(async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch('/api/grievances');
        if (!res.ok) throw new Error(await readApiError(res, `HTTP ${res.status}`));
        const body: unknown = await res.json();
        if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError("no grievances");
        setGrievances(body.data.map(toGrievance));
      } catch (error) {
        setFetchError(error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const statusConfig: Record<GrievanceStatus, { label: string; color: string; icon: React.ReactElement }> = {
    "intake": { label: copy.intake, color: "text-gray-700 bg-gray-100 border-gray-200", icon: <FileText className="w-3 h-3" /> },
    "filed": { label: t('grievances.statusFiled'), color: "text-blue-700 bg-blue-100 border-blue-200", icon: <FileText className="w-3 h-3" /> },
    "step-1": { label: t('grievances.statusStep1'), color: "text-purple-700 bg-purple-100 border-purple-200", icon: <Flag className="w-3 h-3" /> },
    "step-2": { label: t('grievances.statusStep2'), color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Flag className="w-3 h-3" /> },
    "step-3": { label: t('grievances.statusStep3'), color: "text-red-700 bg-red-100 border-red-200", icon: <Flag className="w-3 h-3" /> },
    "arbitration": { label: t('grievances.statusArbitration'), color: "text-pink-700 bg-pink-100 border-pink-200", icon: <Gavel className="w-3 h-3" /> },
    "resolved": { label: t('grievances.statusResolved'), color: "text-green-700 bg-green-100 border-green-200", icon: <CheckCircle className="w-3 h-3" /> },
    "withdrawn": { label: t('grievances.statusWithdrawn'), color: "text-gray-700 bg-gray-100 border-gray-200", icon: <XCircle className="w-3 h-3" /> },
    "other": { label: "", color: "text-gray-700 bg-gray-100 border-gray-200", icon: <Flag className="w-3 h-3" /> },
  };
  const statusLabel = (grievance: Grievance): string =>
    grievance.status === "other" ? grievance.rawStatus : statusConfig[grievance.status].label;

  const priorityConfig: Record<GrievancePriority, { label: string; color: string; icon: React.ReactElement }> = {
    urgent: { label: t('grievances.priorityUrgent'), color: "text-red-700 bg-red-100 border-red-200", icon: <AlertTriangle className="w-4 h-4" /> },
    high: { label: t('grievances.priorityHigh'), color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Flag className="w-4 h-4" /> },
    medium: { label: t('grievances.priorityMedium'), color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Flag className="w-4 h-4" /> },
    low: { label: t('grievances.priorityLow'), color: "text-gray-700 bg-gray-100 border-gray-200", icon: <Flag className="w-4 h-4" /> },
  };

  // Filter and sort grievances
  const filteredGrievances = grievances
    .filter(grievance => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        grievance.number.toLowerCase().includes(q) ||
        (grievance.title ?? "").toLowerCase().includes(q) ||
        (grievance.grievant ?? "").toLowerCase().includes(q) ||
        categoryLabel(grievance.category).toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || grievance.status === selectedStatus;
      const matchesPriority = selectedPriority === "all" || grievance.priority === selectedPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortField === "filedDate") {
        const time = (g: Grievance) => Date.parse(g.filedDate ?? g.createdDate ?? "") || 0;
        return dir * (time(a) - time(b));
      }
      if (sortField === "priority") {
        // A grievance with no priority sorts after every one that has one.
        const rank = (g: Grievance) => (g.priority === null ? PRIORITIES.length : PRIORITIES.length - 1 - PRIORITIES.indexOf(g.priority));
        return dir * (rank(a) - rank(b));
      }
      if (sortField === "status") return dir * a.rawStatus.localeCompare(b.rawStatus);
      return dir * (a.title ?? "").localeCompare(b.title ?? "");
    });

  // Action handlers
  const handleStatusTransition = async (grievance: Grievance, newStatus: string) => {
    setActionLoading(`status-${grievance.id}`);
    setActionError(null);
    try {
      const res = await fetch(`/api/grievances/${grievance.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setActionError(await readApiError(res, `${copy.statusFailed} (HTTP ${res.status})`));
        return;
      }
      await fetchGrievances();
    } catch {
      setActionError(t('grievances.errors.updateStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileGrievance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const cbaArticle = String(formData.get("cbaArticle") ?? "").trim();
    setActionLoading("new-grievance");
    setFormError(null);
    try {
      // Everyone who can open this list is staff, so this opens an official case; the organization is the caller's, never sent.
      const res = await fetch("/api/grievances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.get("type"),
          title: formData.get("title"),
          description: formData.get("description"),
          priority: formData.get("priority"),
          ...(cbaArticle && { cbaArticle }),
          createOfficialCase: true,
        }),
      });
      if (!res.ok) {
        setFormError(await readApiError(res, `${copy.fileFailed} (HTTP ${res.status})`));
        return;
      }
      setShowNewForm(false);
      form.reset();
      await fetchGrievances();
    } catch {
      setFormError(t('grievances.errors.fileGrievance'));
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Calculate stats
  const totalGrievances = grievances.length;
  const activeGrievances = grievances.filter(g => g.status !== "resolved" && g.status !== "withdrawn").length;
  const arbitrationCases = grievances.filter(g => g.status === "arbitration").length;
  // From the day a grievance was filed to the day it was resolved, over the resolved ones that record both. None: no figure.
  const avgResolutionDays = (() => {
    const durations = grievances
      .filter(g => g.status === "resolved" && g.filedDate && g.resolvedDate)
      .map(g => Date.parse(g.resolvedDate as string) - Date.parse(g.filedDate as string))
      .filter(duration => Number.isFinite(duration) && duration >= 0);
    if (durations.length === 0) return null;
    return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length / DAY_MS);
  })();

  const statusCounts: Record<GrievanceStatus | "all", number> = {
    all: grievances.length,
    intake: grievances.filter(g => g.status === "intake").length,
    filed: grievances.filter(g => g.status === "filed").length,
    "step-1": grievances.filter(g => g.status === "step-1").length,
    "step-2": grievances.filter(g => g.status === "step-2").length,
    "step-3": grievances.filter(g => g.status === "step-3").length,
    arbitration: grievances.filter(g => g.status === "arbitration").length,
    resolved: grievances.filter(g => g.status === "resolved").length,
    withdrawn: grievances.filter(g => g.status === "withdrawn").length,
    other: grievances.filter(g => g.status === "other").length,
  };

  return (
    <div>
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center text-muted-foreground">{t('grievances.loadingGrievances')}</div>
          </div>
        )}
        {fetchError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 mb-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-red-900 mb-1">{t('grievances.errorLoadingGrievances')}</h3>
            <p className="text-red-800 text-sm">{fetchError}</p>
            <button
              onClick={() => void fetchGrievances()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {copy.retry}
            </button>
          </div>
        )}
        {!loading && !fetchError && (
        <>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-linear-to-br from-red-500 to-orange-600 rounded-lg">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{t('grievances.title')}</h1>
          </div>
          <p className="text-gray-600">{t('grievances.description')}</p>
        </motion.div>

        {actionError && (
          <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="font-medium underline">
              {copy.dismiss}
            </button>
          </div>
        )}

        {/* File New Grievance Form */}
        <AnimatePresence>
          {showNewForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="bg-white border-red-200 shadow-lg">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('grievances.fileNewGrievance')}</h3>
                  <form onSubmit={handleFileGrievance} className="space-y-4">
                    {formError && (
                      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        {formError}
                      </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.title')}</label>
                        <input name="title" required minLength={5} maxLength={500} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.type')}</label>
                        <select name="type" required defaultValue="individual" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                          {GRIEVANCE_TYPE_ORDER.map((type) => (
                            <option key={type} value={type}>{TYPE_LABELS[type][language]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.description')}</label>
                      <textarea name="description" required minLength={10} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.priority')}</label>
                        <select name="priority" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                          <option value="medium">{t('grievances.priorityMedium')}</option>
                          <option value="low">{t('grievances.priorityLow')}</option>
                          <option value="high">{t('grievances.priorityHigh')}</option>
                          <option value="urgent">{t('grievances.priorityUrgent')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.cbaArticleOptional')}</label>
                        <input name="cbaArticle" maxLength={100} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder={t('grievances.form.cbaArticlePlaceholder')} />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={actionLoading === "new-grievance"}
                        className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === "new-grievance" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {t('grievances.form.submit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewForm(false);
                          setFormError(null);
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        {t('grievances.form.cancel')}
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('grievances.totalGrievances')}</p>
                    <p className="text-3xl font-bold text-gray-900">{totalGrievances}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('grievances.activeCases')}</p>
                    <p className="text-3xl font-bold text-gray-900">{activeGrievances}</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('grievances.inArbitration')}</p>
                    <p className="text-3xl font-bold text-gray-900">{arbitrationCases}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Gavel className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('grievances.avgResolution')}</p>
                    <p className="text-3xl font-bold text-gray-900">{avgResolutionDays === null ? copy.none : `${avgResolutionDays}d`}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Clock className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="mb-6 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('grievances.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* File New Button */}
                <button
                  onClick={() => setShowNewForm(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-linear-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-all shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">{t('grievances.fileNew')}</span>
                </button>
              </div>

              {/* Status Filters */}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {t('grievances.filterStatus')}:
                </span>
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                      selectedStatus === status
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status === "all" ? t('common.all') : statusConfig[status].label}
                    {` (${statusCounts[status]})`}
                  </button>
                ))}
              </div>

              {/* Priority Filters */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  {t('grievances.filterPriority')}:
                </span>
                {(["all", "urgent", "high", "medium", "low"] as const).map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setSelectedPriority(priority)}
                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                      selectedPriority === priority
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {priority === "all" ? t('grievances.allPriorities') : priorityConfig[priority].label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Counter & Sort Controls */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {t('grievances.showingResults', { filtered: filteredGrievances.length, total: totalGrievances })}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('grievances.sortLabel')}</span>
            {((["filedDate", "priority", "status", "title"] as const)).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  sortField === field
                    ? "bg-red-100 text-red-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t(`grievances.sortFields.${field}`)}
                {sortField === field && (
                  <ArrowUpDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Grievances List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredGrievances.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                      <Scale className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('grievances.noGrievancesFound')}</h3>
                    <p className="text-gray-600 mb-4">{t('grievances.noGrievancesMatch')}</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedStatus("all");
                        setSelectedPriority("all");
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      {t('common.clearFilters')}
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredGrievances.map((grievance, index) => {
                const status = statusConfig[grievance.status];
                const priority = grievance.priority ? priorityConfig[grievance.priority] : null;
                const open = grievance.status !== "resolved" && grievance.status !== "withdrawn";
                return (
                <motion.div
                  key={grievance.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{grievance.number}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                              {status.icon}
                              {statusLabel(grievance)}
                            </span>
                            {priority && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priority.color}`}>
                                {priority.icon}
                                {priority.label}
                              </span>
                            )}
                            {open && grievance.daysUntilDeadline !== null && grievance.daysUntilDeadline <= 7 && grievance.daysUntilDeadline >= 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full border border-yellow-200">
                                {t('grievances.deadlineCountdown', { days: grievance.daysUntilDeadline })}
                              </span>
                            )}
                            {open && grievance.daysUntilDeadline !== null && grievance.daysUntilDeadline < 0 && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full border border-red-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {t('grievances.overdue')}
                              </span>
                            )}
                          </div>
                          <p className="text-base font-medium text-gray-900 mb-1">{grievance.title ?? copy.restricted}</p>
                          {grievance.description && <p className="text-sm text-gray-600">{grievance.description}</p>}
                        </div>
                        <button
                          onClick={() => setExpandedGrievance(expandedGrievance === grievance.id ? null : grievance.id)}
                          className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {expandedGrievance === grievance.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                      </div>

                      {/* Summary Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.category')}</p>
                          <p className="text-sm font-medium text-gray-900">{categoryLabel(grievance.category)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.currentStep')}</p>
                          <p className="text-sm font-medium text-gray-900">{grievance.currentStep ? grievance.currentStep.replace(/_/g, " ") : copy.none}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.filedDate')}</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(grievance.filedDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.deadline')}</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(grievance.deadline)}</p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedGrievance === grievance.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Parties Involved */}
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-600" />
                                {t('grievances.partiesInvolved')}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{t('grievances.partyLabels.grievant')}</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.grievant ?? copy.none}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{t('grievances.partyLabels.management')}</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.management ?? copy.none}</p>
                                </div>
                              </div>
                            </div>

                            {/* Contract Violation */}
                            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-600" />
                                {t('grievances.contractViolation')}
                              </h4>
                              <p className="text-sm text-gray-900 font-medium">{grievance.violatedArticle ?? copy.none}</p>
                            </div>

                            {/* Remedy Sought */}
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                {t('grievances.remedySought')}
                              </h4>
                              <p className="text-sm text-gray-700">{grievance.remedy ?? copy.none}</p>
                            </div>

                            {/* Timeline */}
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                {t('grievances.timelineTitle')}
                              </h4>
                              {grievance.timeline.length === 0 ? (
                                <p className="text-sm text-gray-500">{copy.noTimeline}</p>
                              ) : (
                                <div className="space-y-4">
                                  {grievance.timeline.map((event, idx) => (
                                    <div key={idx} className="flex gap-4">
                                      <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                                          <Calendar className="w-4 h-4 text-white" />
                                        </div>
                                        {idx < grievance.timeline.length - 1 && (
                                          <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                                        )}
                                      </div>
                                      <div className="flex-1 pb-6">
                                        <p className="text-sm font-semibold text-gray-900">{event.event}</p>
                                        <p className="text-xs text-gray-600 mb-1">{formatDate(event.date)}</p>
                                        {event.description && <p className="text-sm text-gray-700">{event.description}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                              {/* Status transition dropdown */}
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={actionLoading === `status-${grievance.id}`}
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleStatusTransition(grievance, e.target.value);
                                      e.target.value = "";
                                    }
                                  }}
                                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white disabled:opacity-50"
                                >
                                  <option value="" disabled>{t('grievances.advanceStatus')}</option>
                                  <option value="filed">{t('grievances.advanceOptions.filed')}</option>
                                  <option value="acknowledged">{t('grievances.advanceOptions.acknowledged')}</option>
                                  <option value="investigating">{t('grievances.advanceOptions.investigating')}</option>
                                  <option value="response_due">{t('grievances.advanceOptions.response_due')}</option>
                                  <option value="response_received">{t('grievances.advanceOptions.response_received')}</option>
                                  <option value="escalated">{t('grievances.advanceOptions.escalated')}</option>
                                  <option value="mediation">{t('grievances.advanceOptions.mediation')}</option>
                                  <option value="arbitration">{t('grievances.advanceOptions.arbitration')}</option>
                                  <option value="settled">{t('grievances.advanceOptions.settled')}</option>
                                  <option value="withdrawn">{t('grievances.advanceOptions.withdrawn')}</option>
                                  <option value="closed">{t('grievances.advanceOptions.closed')}</option>
                                </select>
                                {actionLoading === `status-${grievance.id}` && (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  setAssigningGrievanceId((current) => (current === grievance.id ? null : grievance.id))
                                }
                                aria-expanded={assigningGrievanceId === grievance.id}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                <User className="w-4 h-4" />
                                <span className="text-sm font-medium">{t('grievances.assignSteward')}</span>
                              </button>
                              <Link
                                href={`/${locale}/dashboard/grievances/${grievance.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                <span className="text-sm font-medium">{t('grievances.addDocumentation')}</span>
                              </Link>
                            </div>

                            {/* The recommendations are ranked by the server; the assignment is its own request (PATCH /api/grievances/:id/assign). */}
                            {assigningGrievanceId === grievance.id && (
                              <div className="mt-4">
                                <StewardRecommendations
                                  grievanceId={grievance.id}
                                  onAssign={() => {
                                    setAssigningGrievanceId(null);
                                    void fetchGrievances();
                                  }}
                                />
                              </div>
                            )}
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

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Card className="bg-linear-to-br from-red-50 to-orange-50 border-red-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Scale className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('grievances.guidelines.title')}</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• {t('grievances.guidelines.step1')}</li>
                    <li>• {t('grievances.guidelines.step2')}</li>
                    <li>• {t('grievances.guidelines.step3')}</li>
                    <li>• {t('grievances.guidelines.arbitration')}</li>
                    <li>• {t('grievances.guidelines.deadlines')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </>
        )}
      </div>
    </div>
  );
}
