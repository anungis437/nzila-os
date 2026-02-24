"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from 'next-intl';
import { Card, CardContent } from "@/components/ui/card";
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
  Mail,
  Eye,
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

export default function GrievancesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<GrievanceStatus | "all">("all");
  const [selectedPriority, setSelectedPriority] = useState<GrievancePriority | "all">("all");
  const [expandedGrievance, setExpandedGrievance] = useState<string | null>(null);

  // Mock grievances data
  const [grievances] = useState<Grievance[]>([
    {
      id: "grv-001",
      number: "GRV-2025-001",
      title: "Unjust Termination - Safety Complaint Retaliation",
      description: "Member terminated 3 days after filing safety complaint regarding damaged equipment. Clear violation of whistleblower protections and just cause provisions.",
      status: "step-2",
      priority: "urgent",
      category: "Discipline & Discharge",
      filedDate: "2025-01-08",
      deadline: "2025-01-22",
      currentStep: "Step 2 - Division Manager Review",
      daysUntilDeadline: 9,
      grievant: "Robert Martinez",
      steward: "Sarah Johnson",
      management: "Division Manager - Operations",
      violatedArticle: "Article 7 (Just Cause), Article 22 (Safety)",
      remedy: "Full reinstatement with back pay and benefits, expungement of termination from record, formal apology",
      timeline: [
        { date: "2025-01-08", event: "Grievance Filed", description: "Formal grievance submitted at Step 1", type: "filed" },
        { date: "2025-01-10", event: "Step 1 Meeting", description: "Meeting with immediate supervisor - denied", type: "meeting" },
        { date: "2025-01-12", event: "Escalated to Step 2", description: "Advanced to Division Manager level", type: "escalation" },
        { date: "2025-01-15", event: "Step 2 Meeting Scheduled", description: "Meeting set for January 20, 2025", type: "meeting" },
      ],
    },
    {
      id: "grv-002",
      number: "GRV-2025-002",
      title: "Denial of Overtime - Discriminatory Assignment",
      description: "Systematic pattern of denying overtime opportunities to senior employees while assigning to less senior staff. Violates seniority provisions.",
      status: "step-1",
      priority: "high",
      category: "Seniority & Bidding",
      filedDate: "2025-01-10",
      deadline: "2025-01-24",
      currentStep: "Step 1 - Supervisor Review",
      daysUntilDeadline: 11,
      grievant: "Jennifer Lee",
      steward: "Mike Chen",
      management: "Warehouse Supervisor",
      violatedArticle: "Article 9 (Seniority), Article 12 (Overtime)",
      remedy: "Back pay for denied overtime hours (estimated 32 hours), priority consideration for future OT",
      timeline: [
        { date: "2025-01-10", event: "Grievance Filed", description: "Formal grievance submitted at Step 1", type: "filed" },
        { date: "2025-01-12", event: "Documentation Submitted", description: "Provided 8 weeks of OT assignment records", type: "response" },
        { date: "2025-01-17", event: "Step 1 Meeting", description: "Meeting scheduled with supervisor", type: "meeting" },
      ],
    },
    {
      id: "grv-003",
      number: "GRV-2024-089",
      title: "Suspension Without Pay - Excessive Discipline",
      description: "3-day suspension for attendance issue without prior progressive discipline. First offense, violates disciplinary procedure.",
      status: "arbitration",
      priority: "high",
      category: "Discipline & Discharge",
      filedDate: "2024-11-15",
      deadline: "2025-02-15",
      currentStep: "Arbitration - Hearing Scheduled",
      daysUntilDeadline: 33,
      grievant: "David Chen",
      steward: "Sarah Johnson",
      management: "HR Director",
      violatedArticle: "Article 7 (Just Cause), Article 8 (Progressive Discipline)",
      remedy: "Removal of suspension from record, back pay for 3 days, disciplinary action reduced to verbal warning",
      timeline: [
        { date: "2024-11-15", event: "Grievance Filed", description: "Step 1 filed", type: "filed" },
        { date: "2024-11-20", event: "Step 1 Denied", description: "Supervisor denied grievance", type: "response" },
        { date: "2024-11-25", event: "Step 2 Denied", description: "Division Manager upheld decision", type: "response" },
        { date: "2024-12-01", event: "Step 3 Denied", description: "Plant Manager final denial", type: "response" },
        { date: "2024-12-10", event: "Arbitration Requested", description: "Union requested binding arbitration", type: "escalation" },
        { date: "2025-01-05", event: "Arbitrator Selected", description: "Mutual agreement on arbitrator", type: "meeting" },
      ],
    },
    {
      id: "grv-004",
      number: "GRV-2025-003",
      title: "Unsafe Working Conditions - Ventilation System",
      description: "Inadequate ventilation in paint booth area causing health issues. Management aware but failed to address for 6 months.",
      status: "step-1",
      priority: "urgent",
      category: "Health & Safety",
      filedDate: "2025-01-11",
      deadline: "2025-01-25",
      currentStep: "Step 1 - Supervisor Review",
      daysUntilDeadline: 12,
      grievant: "Maria Rodriguez",
      steward: "Sarah Johnson",
      management: "Production Supervisor",
      violatedArticle: "Article 22 (Health and Safety), Article 23 (Working Conditions)",
      remedy: "Immediate repair/upgrade of ventilation system, medical evaluation for affected workers, hazard pay for period",
      timeline: [
        { date: "2025-01-11", event: "Grievance Filed", description: "Emergency grievance filed", type: "filed" },
        { date: "2025-01-12", event: "OSHA Notified", description: "Union filed complaint with OSHA", type: "response" },
        { date: "2025-01-14", event: "Work Stoppage", description: "Section 7-12 employees refused unsafe work", type: "meeting" },
      ],
    },
    {
      id: "grv-005",
      number: "GRV-2024-087",
      title: "Wage Calculation Error - Shift Differential",
      description: "Incorrect calculation of shift differential for night crew (10pm-6am). Affects 15 members, 6-month period.",
      status: "resolved",
      priority: "medium",
      category: "Wages & Benefits",
      filedDate: "2024-12-01",
      deadline: "2025-01-15",
      currentStep: "Resolved - Settlement Reached",
      daysUntilDeadline: 2,
      grievant: "Class Action (15 members)",
      steward: "Mike Chen",
      management: "HR Manager",
      violatedArticle: "Article 11 (Wages), Article 13 (Shift Differential)",
      remedy: "Back pay for all affected members (approved), corrected payroll system going forward",
      timeline: [
        { date: "2024-12-01", event: "Grievance Filed", description: "Class action grievance submitted", type: "filed" },
        { date: "2024-12-05", event: "Payroll Audit", description: "Union conducted independent audit", type: "response" },
        { date: "2024-12-10", event: "Step 1 Meeting", description: "Presented audit findings", type: "meeting" },
        { date: "2024-12-15", event: "Management Agreement", description: "Company acknowledged error", type: "response" },
        { date: "2025-01-10", event: "Settlement Finalized", description: "Back pay processed, system corrected", type: "resolved" },
      ],
    },
  ]);

  const t = useTranslations();
  
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

  // Filter grievances
  const filteredGrievances = grievances.filter(grievance => {
    const matchesSearch = 
      grievance.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grievance.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grievance.grievant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grievance.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || grievance.status === selectedStatus;
    const matchesPriority = selectedPriority === "all" || grievance.priority === selectedPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate stats
  const totalGrievances = grievances.length;
  const activeGrievances = grievances.filter(g => g.status !== "resolved" && g.status !== "withdrawn").length;
  const arbitrationCases = grievances.filter(g => g.status === "arbitration").length;
  const avgResolutionDays = 45; // Mock data

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
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-red-50">
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
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
                <button className="flex items-center gap-2 px-6 py-2 bg-linear-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-all shadow-md">
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

        {/* Results Counter */}
        <div className="mb-4 text-sm text-gray-600">
          {t('grievances.showingResults', { filtered: filteredGrievances.length, total: totalGrievances })}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[grievance.status].color}`}>
                              {statusConfig[grievance.status].icon}
                              {statusConfig[grievance.status].label}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig[grievance.priority].color}`}>
                              {priorityConfig[grievance.priority].icon}
                              {priorityConfig[grievance.priority].label}
                            </span>
                            {grievance.daysUntilDeadline <= 7 && grievance.daysUntilDeadline > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full border border-yellow-200">
                                {grievance.daysUntilDeadline} days until deadline
                              </span>
                            )}
                            {grievance.daysUntilDeadline < 0 && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full border border-red-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
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
                          <p className="text-xs text-gray-600 mb-1">Category</p>
                          <p className="text-sm font-medium text-gray-900">{grievance.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Current Step</p>
                          <p className="text-sm font-medium text-gray-900">{grievance.currentStep}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Filed Date</p>
                          <p className="text-sm font-medium text-gray-900">{new Date(grievance.filedDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Deadline</p>
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
                                Parties Involved
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Grievant</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.grievant}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Union Steward</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.steward}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Management</p>
                                  <p className="text-sm font-medium text-gray-900">{grievance.management}</p>
                                </div>
                              </div>
                            </div>

                            {/* Contract Violation */}
                            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-600" />
                                Contract Violation
                              </h4>
                              <p className="text-sm text-gray-900 font-medium">{grievance.violatedArticle}</p>
                            </div>

                            {/* Remedy Sought */}
                            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                Remedy Sought
                              </h4>
                              <p className="text-sm text-gray-700">{grievance.remedy}</p>
                            </div>

                            {/* Timeline */}
                            <div className="mb-6">
                              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                Timeline
                              </h4>
                              <div className="space-y-4">
                                {grievance.timeline.map((event, idx) => (
                                  <div key={idx} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                      <div className={`w-8 h-8 rounded-full ${timelineTypeConfig[event.type].color} flex items-center justify-center`}>
                                        {timelineTypeConfig[event.type].icon}
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
                              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Eye className="w-4 h-4" />
                                <span className="text-sm font-medium">View Full Details</span>
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                <Mail className="w-4 h-4" />
                                <span className="text-sm font-medium">Contact Steward</span>
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm font-medium">Schedule Meeting</span>
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                                <FileText className="w-4 h-4" />
                                <span className="text-sm font-medium">Add Documentation</span>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Grievance Process Guidelines</h3>
                  <ul className="text-sm text-gray-700 space-y-1 mb-4">
                    <li>• Step 1: Must be filed within 10 days of incident</li>
                    <li>• Step 2: Advanced within 14 days if Step 1 denied</li>
                    <li>• Step 3: Final internal review before arbitration</li>
                    <li>• Arbitration: Binding decision by neutral arbitrator</li>
                    <li>• All deadlines are contractual and must be strictly observed</li>
                  </ul>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                    View Full Grievance Procedure
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
