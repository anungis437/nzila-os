"use client";

import React from 'react';
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from 'next-intl';
import { Card, CardContent } from "@/components/ui/card";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  Scale,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  User,
  Gavel,
  TrendingUp,
  Filter,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Flag,
  FileCheck,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
} from "lucide-react";

type GrievanceStatus = "filed" | "step-1" | "step-2" | "step-3" | "arbitration" | "resolved" | "withdrawn";
type GrievancePriority = "low" | "medium" | "high" | "urgent";

interface Grievance {
  id: string;
  number: string;
  title: string;
  description: string;
  status: GrievanceStatus;
  priority: GrievancePriority;
  category: string;
  filedDate: string;
  deadline: string;
  currentStep: string;
  daysUntilDeadline: number;
  grievant: string;
  steward: string;
  management: string;
  violatedArticle: string;
  remedy: string;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  date: string;
  event: string;
  description: string;
  type: "filed" | "meeting" | "response" | "escalation" | "resolved";
}

// Map DB status values to UI status values
const mapDbStatusToUi = (dbStatus: string | undefined | null): GrievanceStatus => {
  const statusMap: Record<string, GrievanceStatus> = {
    "draft": "filed",
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
    // Pass through UI values as-is
    "step-1": "step-1",
    "step-2": "step-2",
    "step-3": "step-3",
    "resolved": "resolved",
  };
  return statusMap[dbStatus ?? ""] || "filed";
};

// Map raw API/DB row to component Grievance shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDbGrievanceToUi = (raw: any): Grievance => ({
  id: raw.id ?? raw.grievanceNumber ?? "",
  number: raw.grievanceNumber ?? raw.number ?? "",
  title: raw.title ?? "Untitled Grievance",
  description: raw.description ?? "",
  status: mapDbStatusToUi(raw.status),
  priority: ["low", "medium", "high", "urgent"].includes(raw.priority) ? raw.priority : "medium",
  category: raw.type ?? raw.category ?? "General",
  filedDate: raw.filedDate ?? raw.createdAt ?? "",
  deadline: raw.deadline ?? "",
  currentStep: raw.step ?? raw.currentStep ?? "",
  daysUntilDeadline: raw.daysUntilDeadline ?? 0,
  grievant: raw.grievantName ?? raw.grievant ?? "Unknown",
  steward: raw.steward ?? "",
  management: raw.employerName ?? raw.management ?? "",
  violatedArticle: raw.cbaArticle ?? raw.violatedArticle ?? "",
  remedy: raw.remedy ?? "",
  timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
});

type SortField = "filedDate" | "priority" | "status" | "title";
type SortOrder = "asc" | "desc";

export function GrievancesConsole() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<GrievanceStatus | "all">("all");
  const [selectedPriority, setSelectedPriority] = useState<GrievancePriority | "all">("all");
  const [expandedGrievance, setExpandedGrievance] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("filedDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const { organizationId } = useOrganization();

  // Grievances data from API
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const t = useTranslations();

  const fetchGrievances = useCallback(async () => {
      try {
        setLoading(true);
        setFetchError(null);
        const url = organizationId
          ? `/api/grievances?organizationId=${organizationId}`
          : '/api/grievances';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : json?.grievances ?? json?.data ?? [];
          setGrievances(items.map(mapDbGrievanceToUi));
        } else {
          const body = await res.json().catch(() => ({}));
          setFetchError(body?.error || `Failed to load grievances (${res.status})`);
        }
      } catch {
        setFetchError(t('grievances.errors.fileGrievance'));
      } finally {
        setLoading(false);
      }
  }, [organizationId, t]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  const statusConfig: Record<GrievanceStatus, { label: string; color: string; icon: React.ReactElement }> = {
    "filed": { label: t('grievances.statusFiled'), color: "text-blue-700 bg-blue-100 border-blue-200", icon: <FileText className="w-3 h-3" /> },
    "step-1": { label: t('grievances.statusStep1'), color: "text-purple-700 bg-purple-100 border-purple-200", icon: <Flag className="w-3 h-3" /> },
    "step-2": { label: t('grievances.statusStep2'), color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Flag className="w-3 h-3" /> },
    "step-3": { label: t('grievances.statusStep3'), color: "text-red-700 bg-red-100 border-red-200", icon: <Flag className="w-3 h-3" /> },
    "arbitration": { label: t('grievances.statusArbitration'), color: "text-pink-700 bg-pink-100 border-pink-200", icon: <Gavel className="w-3 h-3" /> },
    "resolved": { label: t('grievances.statusResolved'), color: "text-green-700 bg-green-100 border-green-200", icon: <CheckCircle className="w-3 h-3" /> },
    "withdrawn": { label: t('grievances.statusWithdrawn'), color: "text-gray-700 bg-gray-100 border-gray-200", icon: <XCircle className="w-3 h-3" /> },
  };

  const priorityConfig: Record<GrievancePriority, { label: string; color: string; icon: React.ReactElement }> = {
    urgent: { label: t('grievances.priorityUrgent'), color: "text-red-700 bg-red-100 border-red-200", icon: <AlertTriangle className="w-4 h-4" /> },
    high: { label: t('grievances.priorityHigh'), color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Flag className="w-4 h-4" /> },
    medium: { label: t('grievances.priorityMedium'), color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Flag className="w-4 h-4" /> },
    low: { label: t('grievances.priorityLow'), color: "text-gray-700 bg-gray-100 border-gray-200", icon: <Flag className="w-4 h-4" /> },
  };

  const timelineTypeConfig: Record<TimelineEvent["type"], { color: string; icon: React.ReactElement }> = {
    filed: { color: "bg-blue-500", icon: <FileText className="w-4 h-4 text-white" /> },
    meeting: { color: "bg-purple-500", icon: <Calendar className="w-4 h-4 text-white" /> },
    response: { color: "bg-orange-500", icon: <FileCheck className="w-4 h-4 text-white" /> },
    escalation: { color: "bg-red-500", icon: <TrendingUp className="w-4 h-4 text-white" /> },
    resolved: { color: "bg-green-500", icon: <CheckCircle className="w-4 h-4 text-white" /> },
  };

  // Filter and sort grievances
  const filteredGrievances = grievances
    .filter(grievance => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (grievance.number ?? "").toLowerCase().includes(q) ||
        (grievance.title ?? "").toLowerCase().includes(q) ||
        (grievance.grievant ?? "").toLowerCase().includes(q) ||
        (grievance.category ?? "").toLowerCase().includes(q);
      const matchesStatus = selectedStatus === "all" || grievance.status === selectedStatus;
      const matchesPriority = selectedPriority === "all" || grievance.priority === selectedPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortField === "filedDate") {
        return dir * (new Date(a.filedDate).getTime() - new Date(b.filedDate).getTime());
      }
      if (sortField === "priority") {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return dir * ((order[a.priority] ?? 2) - (order[b.priority] ?? 2));
      }
      return dir * (a[sortField] ?? "").localeCompare(b[sortField] ?? "");
    });

  // Action handlers
  const handleStatusTransition = async (grievance: Grievance, newStatus: string) => {
    setActionLoading(`status-${grievance.id}`);
    try {
      const res = await fetch(`/api/grievances/${grievance.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || `Failed to update status (${res.status})`);
        return;
      }
      await fetchGrievances();
    } catch {
      alert(t('grievances.errors.updateStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignSteward = async (grievance: Grievance) => {
    setActionLoading(`assign-${grievance.id}`);
    try {
      const res = await fetch(`/api/grievances/${grievance.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || `Failed to assign steward (${res.status})`);
        return;
      }
      await fetchGrievances();
    } catch {
      alert(t('grievances.errors.assignSteward'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddDocument = async (grievance: Grievance) => {
    const description = prompt(t('grievances.documentDescriptionPrompt'));
    if (!description) return;
    setActionLoading(`doc-${grievance.id}`);
    try {
      const res = await fetch(`/api/grievances/${grievance.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: description, type: "note", content: description }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || `Failed to add document (${res.status})`);
        return;
      }
      await fetchGrievances();
    } catch {
      alert(t('grievances.errors.addDocument'));
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
  const avgResolutionDays = (() => {
    const resolved = grievances.filter(g => g.status === "resolved" && g.filedDate);
    if (resolved.length === 0) return 0;
    const totalDays = resolved.reduce((sum, g) => {
      const filed = new Date(g.filedDate).getTime();
      const now = Date.now();
      return sum + Math.round((now - filed) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / resolved.length);
  })();

  const statusCounts = {
    all: grievances.length,
    filed: grievances.filter(g => g.status === "filed").length,
    "step-1": grievances.filter(g => g.status === "step-1").length,
    "step-2": grievances.filter(g => g.status === "step-2").length,
    "step-3": grievances.filter(g => g.status === "step-3").length,
    arbitration: grievances.filter(g => g.status === "arbitration").length,
    resolved: grievances.filter(g => g.status === "resolved").length,
    withdrawn: grievances.filter(g => g.status === "withdrawn").length,
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
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 mb-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-red-900 mb-1">{t('grievances.errorLoadingGrievances')}</h3>
            <p className="text-red-800 text-sm">{fetchError}</p>
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
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);
                      setActionLoading("new-grievance");
                      try {
                        const res = await fetch("/api/grievances", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: formData.get("title"),
                            description: formData.get("description"),
                            type: formData.get("type"),
                            priority: formData.get("priority"),
                            cbaArticle: formData.get("cbaArticle"),
                            organizationId,
                          }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          alert(body?.error || `Failed to file grievance (${res.status})`);
                          return;
                        }
                        setShowNewForm(false);
                        form.reset();
                        await fetchGrievances();
                      } catch {
                        alert(t('grievances.errors.fileGrievance'));
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.title')}</label>
                        <input name="title" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.type')}</label>
                        <select name="type" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                          <option value="contract_violation">{t('grievances.form.types.contract_violation')}</option>
                          <option value="discipline">{t('grievances.form.types.discipline')}</option>
                          <option value="discrimination">{t('grievances.form.types.discrimination')}</option>
                          <option value="safety">{t('grievances.form.types.safety')}</option>
                          <option value="wages">{t('grievances.form.types.wages')}</option>
                          <option value="benefits">{t('grievances.form.types.benefits')}</option>
                          <option value="working_conditions">{t('grievances.form.types.working_conditions')}</option>
                          <option value="other">{t('grievances.form.types.other')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('grievances.form.description')}</label>
                      <textarea name="description" required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
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
                        <input name="cbaArticle" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder={t('grievances.form.cbaArticlePlaceholder')} />
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
                        onClick={() => setShowNewForm(false)}
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
                    <p className="text-3xl font-bold text-gray-900">{avgResolutionDays}d</p>
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
                {(["all", "filed", "step-1", "step-2", "step-3", "arbitration", "resolved"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                      selectedStatus === status
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status === "all" ? t('common.all') : statusConfig[status as GrievanceStatus].label}
                    {status === "all" && ` (${statusCounts.all})`}
                    {status !== "all" && ` (${statusCounts[status as GrievanceStatus]})`}
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
                    {priority === "all" ? t('grievances.allPriorities') : priorityConfig[priority as GrievancePriority].label}
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
              filteredGrievances.map((grievance, index) => (
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
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${(statusConfig[grievance.status] ?? statusConfig.filed).color}`}>
                              {(statusConfig[grievance.status] ?? statusConfig.filed).icon}
                              {(statusConfig[grievance.status] ?? statusConfig.filed).label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${(priorityConfig[grievance.priority] ?? priorityConfig.medium).color}`}>
                              {(priorityConfig[grievance.priority] ?? priorityConfig.medium).icon}
                              {(priorityConfig[grievance.priority] ?? priorityConfig.medium).label}
                            </span>
                            {grievance.daysUntilDeadline <= 7 && grievance.daysUntilDeadline > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full border border-yellow-200">
                                {t('grievances.deadlineCountdown', { days: grievance.daysUntilDeadline })}
                              </span>
                            )}
                            {grievance.daysUntilDeadline < 0 && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full border border-red-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {t('grievances.overdue')}
                              </span>
                            )}
                          </div>
                          <p className="text-base font-medium text-gray-900 mb-1">{grievance.title}</p>
                          <p className="text-sm text-gray-600">{grievance.description}</p>
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
                          <p className="text-sm font-medium text-gray-900">{grievance.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.currentStep')}</p>
                          <p className="text-sm font-medium text-gray-900">{grievance.currentStep}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.filedDate')}</p>
                          <p className="text-sm font-medium text-gray-900">{new Date(grievance.filedDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('grievances.labels.deadline')}</p>
                          <p className="text-sm font-medium text-gray-900">{new Date(grievance.deadline).toLocaleDateString()}</p>
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
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{t('grievances.partyLabels.grievant')}</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.grievant}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{t('grievances.partyLabels.steward')}</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.steward}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">{t('grievances.partyLabels.management')}</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.management}</p>
                                </div>
                              </div>
                            </div>

                            {/* Contract Violation */}
                            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-600" />
                                {t('grievances.contractViolation')}
                              </h4>
                              <p className="text-sm text-gray-900 font-medium">{grievance.violatedArticle}</p>
                            </div>

                            {/* Remedy Sought */}
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                {t('grievances.remedySought')}
                              </h4>
                              <p className="text-sm text-gray-700">{grievance.remedy}</p>
                            </div>

                            {/* Timeline */}
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                {t('grievances.timelineTitle')}
                              </h4>
                              <div className="space-y-4">
                                {grievance.timeline.map((event, idx) => (
                                  <div key={idx} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                      <div className={`w-8 h-8 rounded-full ${(timelineTypeConfig[event.type] ?? timelineTypeConfig.filed).color} flex items-center justify-center`}>
                                        {(timelineTypeConfig[event.type] ?? timelineTypeConfig.filed).icon}
                                      </div>
                                      {idx < grievance.timeline.length - 1 && (
                                        <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                                      )}
                                    </div>
                                    <div className="flex-1 pb-6">
                                      <p className="text-sm font-semibold text-gray-900">{event.event}</p>
                                      <p className="text-xs text-gray-600 mb-1">{new Date(event.date).toLocaleDateString()}</p>
                                      <p className="text-sm text-gray-700">{event.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
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
                                onClick={() => handleAssignSteward(grievance)}
                                disabled={actionLoading === `assign-${grievance.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === `assign-${grievance.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <User className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">{t('grievances.assignSteward')}</span>
                              </button>
                              <button
                                onClick={() => handleAddDocument(grievance)}
                                disabled={actionLoading === `doc-${grievance.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === `doc-${grievance.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FileText className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium">{t('grievances.addDocumentation')}</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
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
                  <ul className="text-sm text-gray-700 space-y-1 mb-4">
                    <li>• {t('grievances.guidelines.step1')}</li>
                    <li>• {t('grievances.guidelines.step2')}</li>
                    <li>• {t('grievances.guidelines.step3')}</li>
                    <li>• {t('grievances.guidelines.arbitration')}</li>
                    <li>• {t('grievances.guidelines.deadlines')}</li>
                  </ul>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                    View Full Grievance Procedure
                  </button>
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
