"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
/**
 * Case Queue (LRO Workbench)
 * For union representatives to manage and review member cases
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from 'next-intl';
import Link from "next/link";
import {
  Clipboard,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Flag,
  Filter,
  Search,
  ArrowUpDown,
  MessageSquare,
  FileText,
  Send,
  Phone,
  Mail,
  ChevronDown,
  Eye,
  Edit,
  UserCheck,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type CaseStatus = "pending" | "in-review" | "approved" | "rejected" | "resolved";
type CasePriority = "low" | "medium" | "high" | "urgent";
type SortField = "submittedDate" | "priority" | "status" | "title";
type SortOrder = "asc" | "desc";

// Database claim type from API
interface DbClaim {
  claimId: string;
  claimNumber: string;
  organizationId: string;
  memberId: string;
  isAnonymous: boolean;
  claimType: string;
  status: string;
  priority: string;
  incidentDate: Date;
  location: string;
  description: string;
  desiredOutcome: string;
  witnessesPresent: boolean;
  witnessDetails: string | null;
  previouslyReported: boolean;
  previousReportDetails: string | null;
  assignedTo: string | null;
  assignedAt: Date | null;
  resolutionNotes: string | null;
  resolutionDate: Date | null;
  attachments: string[];
  voiceTranscriptions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

interface Case {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  category: string;
  submittedDate: string;
  lastUpdate: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  assignedTo: string | null;
  notes: string[];
  daysOpen: number;
}

// Map database claim types to UI-friendly labels
const claimTypeLabels: Record<string, string> = {
  "grievance_discipline": "Discipline",
  "grievance_pay": "Wage & Hour",
  "grievance_schedule": "Scheduling",
  "grievance_benefits": "Benefits",
  "grievance_leave": "Leave",
  "discrimination_race": "Discrimination",
  "discrimination_gender": "Discrimination",
  "discrimination_age": "Discrimination",
  "discrimination_disability": "Discrimination",
  "harassment_sexual": "Harassment",
  "harassment_workplace": "Harassment",
  "workplace_safety": "Safety",
  "contract_violation": "Contract Violation",
};

// Map database status to UI status
const mapDbStatusToUi = (dbStatus: string): CaseStatus => {
  const statusMap: Record<string, CaseStatus> = {
    "submitted": "pending",
    "under_review": "in-review",
    "assigned": "in-review",
    "investigation": "in-review",
    "pending_documentation": "in-review",
    "resolved": "resolved",
    "rejected": "rejected",
    "closed": "resolved",
  };
  return statusMap[dbStatus] || "pending";
};

// Map database priority to UI priority
const mapDbPriorityToUi = (dbPriority: string): CasePriority => {
  const priorityMap: Record<string, CasePriority> = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "critical": "urgent",
  };
  return priorityMap[dbPriority] || "medium";
};

// Calculate days open
const calculateDaysOpen = (createdAt: Date): number => {
  const created = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Convert database claim to UI case (now with member details from API)
const mapDbClaimToCase = (claim: DbClaim & { memberName?: string; memberEmail?: string; memberPhone?: string }): Case => ({
  id: claim.claimNumber,
  title: claimTypeLabels[claim.claimType] || claim.claimType,
  description: claim.description,
  status: mapDbStatusToUi(claim.status),
  priority: mapDbPriorityToUi(claim.priority),
  category: claimTypeLabels[claim.claimType] || claim.claimType,
  submittedDate: new Date(claim.createdAt).toISOString().split('T')[0],
  lastUpdate: new Date(claim.updatedAt).toISOString().split('T')[0],
  memberName: claim.memberName || (claim.isAnonymous ? "Anonymous Member" : "Unknown Member"),
  memberEmail: claim.memberEmail || (claim.isAnonymous ? "" : ""),
  memberPhone: claim.memberPhone || (claim.isAnonymous ? "" : ""),
  assignedTo: claim.assignedTo || null,
  notes: claim.resolutionNotes ? [claim.resolutionNotes] : [],
  daysOpen: calculateDaysOpen(claim.createdAt),
});

const _mockCases: Case[] = [
  {
    id: "CASE-004",
    title: "Denied Vacation Request",
    description: "Manager denied my pre-approved vacation request for December 2025 without explanation. I submitted the request 3 months in advance as required by policy.",
    status: "pending",
    priority: "high",
    category: "Scheduling",
    submittedDate: "2025-11-12",
    lastUpdate: "2025-11-12",
    memberName: "Robert Martinez",
    memberEmail: "r.martinez@unionmember.com",
    memberPhone: "(555) 234-5678",
    assignedTo: null,
    notes: [],
    daysOpen: 1
  },
  {
    id: "CASE-005",
    title: "Unsafe Working Conditions - Loading Dock",
    description: "Loading dock has damaged flooring with trip hazards. Multiple near-miss incidents reported. Management has been notified but no action taken in 2 weeks.",
    status: "pending",
    priority: "urgent",
    category: "Safety",
    submittedDate: "2025-11-11",
    lastUpdate: "2025-11-11",
    memberName: "Jennifer Lee",
    memberEmail: "j.lee@unionmember.com",
    memberPhone: "(555) 345-6789",
    assignedTo: null,
    notes: [],
    daysOpen: 2
  },
  {
    id: "CASE-006",
    title: "Unpaid Training Hours",
    description: "Required to attend mandatory safety training on my day off but was not compensated for the 4 hours. Training certificate attached.",
    status: "in-review",
    priority: "medium",
    category: "Wage & Hour",
    submittedDate: "2025-11-09",
    lastUpdate: "2025-11-12",
    memberName: "David Chen",
    memberEmail: "d.chen@unionmember.com",
    memberPhone: "(555) 456-7890",
    assignedTo: "Sarah Johnson",
    notes: [
      "Reviewed training records - confirmed member attended 4-hour session",
      "Contacted HR for payroll records",
      "Awaiting response from supervisor"
    ],
    daysOpen: 4
  },
  {
    id: "CASE-007",
    title: "Discriminatory Shift Assignment",
    description: "Consistently assigned to late night shifts while colleagues with less seniority get preferred day shifts. This pattern has continued for 6 weeks.",
    status: "in-review",
    priority: "high",
    category: "Discrimination",
    submittedDate: "2025-11-08",
    lastUpdate: "2025-11-11",
    memberName: "Maria Rodriguez",
    memberEmail: "m.rodriguez@unionmember.com",
    memberPhone: "(555) 567-8901",
    assignedTo: "Sarah Johnson",
    notes: [
      "Pulled 8 weeks of shift assignments for department",
      "Confirmed pattern exists - member has 90% night shifts vs dept avg of 30%",
      "Scheduled meeting with supervisor for Friday"
    ],
    daysOpen: 5
  },
  {
    id: "CASE-008",
    title: "Benefits Enrollment Issue",
    description: "Unable to enroll in health insurance during open enrollment period due to system error. HR has not resolved after 3 follow-ups.",
    status: "pending",
    priority: "medium",
    category: "Benefits",
    submittedDate: "2025-11-10",
    lastUpdate: "2025-11-10",
    memberName: "James Wilson",
    memberEmail: "j.wilson@unionmember.com",
    memberPhone: "(555) 678-9012",
    assignedTo: null,
    notes: [],
    daysOpen: 3
  },
  {
    id: "CASE-009",
    title: "Harassment by Supervisor",
    description: "Supervisor makes inappropriate comments about my appearance and personal life. Creates hostile work environment. Multiple witnesses available.",
    status: "in-review",
    priority: "urgent",
    category: "Harassment",
    submittedDate: "2025-11-07",
    lastUpdate: "2025-11-12",
    memberName: "Lisa Thompson",
    memberEmail: "l.thompson@unionmember.com",
    memberPhone: "(555) 789-0123",
    assignedTo: "Mike Chen",
    notes: [
      "Conducted initial interview with member",
      "Identified 3 witnesses willing to provide statements",
      "Coordinated with HR compliance team",
      "Formal investigation opened"
    ],
    daysOpen: 6
  },
  {
    id: "CASE-010",
    title: "Incorrect Overtime Calculation",
    description: "Last 2 paychecks show incorrect overtime rate. Should be 1.5x but being paid at regular rate. Affects approximately 12 hours.",
    status: "pending",
    priority: "high",
    category: "Wage & Hour",
    submittedDate: "2025-11-11",
    lastUpdate: "2025-11-11",
    memberName: "Kevin Brown",
    memberEmail: "k.brown@unionmember.com",
    memberPhone: "(555) 890-1234",
    assignedTo: null,
    notes: [],
    daysOpen: 2
  },
  {
    id: "CASE-011",
    title: "Equipment Failure - Ergonomic Issue",
    description: "My adjustable desk has been broken for 3 weeks. Causing back pain. Multiple work orders submitted with no resolution.",
    status: "pending",
    priority: "low",
    category: "Working Conditions",
    submittedDate: "2025-11-12",
    lastUpdate: "2025-11-12",
    memberName: "Amanda Taylor",
    memberEmail: "a.taylor@unionmember.com",
    memberPhone: "(555) 901-2345",
    assignedTo: null,
    notes: [],
    daysOpen: 1
  }
];

const statusConfig: Record<CaseStatus, { label: string; icon: React.ReactElement; color: string; dotColor: string }> = {
  pending: { 
    label: "Pending Assignment", 
    icon: <Clock className="w-4 h-4" />, 
    color: "text-yellow-700 bg-yellow-100 border-yellow-200",
    dotColor: "bg-yellow-500"
  },
  "in-review": { 
    label: "Under Review", 
    icon: <AlertCircle className="w-4 h-4" />, 
    color: "text-blue-700 bg-blue-100 border-blue-200",
    dotColor: "bg-blue-500"
  },
  approved: { 
    label: "Approved", 
    icon: <CheckCircle className="w-4 h-4" />, 
    color: "text-green-700 bg-green-100 border-green-200",
    dotColor: "bg-green-500"
  },
  rejected: { 
    label: "Rejected", 
    icon: <XCircle className="w-4 h-4" />, 
    color: "text-red-700 bg-red-100 border-red-200",
    dotColor: "bg-red-500"
  },
  resolved: { 
    label: "Resolved", 
    icon: <CheckCircle className="w-4 h-4" />, 
    color: "text-gray-700 bg-gray-100 border-gray-200",
    dotColor: "bg-gray-500"
  }
};

export default function WorkbenchPage() {
  const t = useTranslations();
  const { user } = useUser();
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | "all">("all");
  const [selectedPriority, setSelectedPriority] = useState<CasePriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("submittedDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [newNote, setNewNote] = useState<Record<string, string>>({});

  const priorityConfig: Record<CasePriority, { label: string; color: string; icon: React.ReactElement }> = {
    low: { label: t('workbench.priorities.low'), color: "text-gray-600 bg-gray-100", icon: <Flag className="w-3 h-3" /> },
    medium: { label: t('workbench.priorities.medium'), color: "text-blue-600 bg-blue-100", icon: <Flag className="w-3 h-3" /> },
    high: { label: t('workbench.priorities.high'), color: "text-orange-600 bg-orange-100", icon: <Flag className="w-3 h-3" /> },
    urgent: { label: t('workbench.priorities.urgent'), color: "text-red-600 bg-red-100", icon: <AlertTriangle className="w-3 h-3" /> }
  };

  // Fetch assigned claims from database
  useEffect(() => {
    const fetchAssignedClaims = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/workbench/assigned');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch assigned claims: ${response.statusText}`);
        }

        const data = await response.json();
        const mappedCases = data.claims.map(mapDbClaimToCase);
        setCases(mappedCases);
      } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load assigned claims');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedClaims();
  }, []);

  // Filter and sort cases
  const filteredAndSortedCases = cases
    .filter(c => {
      const matchesStatus = selectedStatus === "all" || c.status === selectedStatus;
      const matchesPriority = selectedPriority === "all" || c.priority === selectedPriority;
      const matchesSearch = 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesPriority && matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "submittedDate":
          comparison = new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime();
          break;
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Calculate stats
  const pendingCount = cases.filter(c => c.status === "pending").length;
  const inReviewCount = cases.filter(c => c.status === "in-review").length;
  const urgentCount = cases.filter(c => c.priority === "urgent").length;
  const avgDaysOpen = Math.round(cases.reduce((sum, c) => sum + c.daysOpen, 0) / cases.length);

  const handleAssignToMe = (caseId: string) => {
    setCases(cases.map(c => 
      c.id === caseId 
        ? { ...c, status: "in-review", assignedTo: user?.firstName || "You", lastUpdate: new Date().toISOString().split('T')[0] }
        : c
    ));
  };

  const handleAddNote = (caseId: string) => {
    const note = newNote[caseId];
    if (!note || !note.trim()) return;

    setCases(cases.map(c => 
      c.id === caseId 
        ? { ...c, notes: [...c.notes, note], lastUpdate: new Date().toISOString().split('T')[0] }
        : c
    ));
    setNewNote({ ...newNote, [caseId]: "" });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-orange-50 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Clipboard className="w-10 h-10 text-orange-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              {t('workbench.title')}
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            {t('workbench.subtitle')}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center items-center py-20"
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading assigned cases...</p>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6"
          >
            <div className="flex items-center gap-3">
              <XCircle className="text-red-600" size={24} />
              <div>
                <h3 className="font-semibold text-red-900">Error Loading Cases</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && !error && cases.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Clipboard size={64} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Cases Assigned</h3>
            <p className="text-gray-600 mb-6">You don&apos;t have any cases assigned to you yet.</p>
            <p className="text-sm text-gray-500">Cases will appear here when they are assigned to you by administrators or when you take ownership of pending cases.</p>
          </motion.div>
        )}

        {/* Content - only show when not loading and no error and has cases */}
        {!isLoading && !error && cases.length > 0 && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Pending Assignment</p>
                    <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600" />
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
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('workbench.underReview')}</p>
                    <p className="text-3xl font-bold text-blue-600">{inReviewCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
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
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('workbench.urgentCases')}</p>
                    <p className="text-3xl font-bold text-red-600">{urgentCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
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
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('workbench.avgDaysOpen')}</p>
                    <p className="text-3xl font-bold text-orange-600">{avgDaysOpen}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-8">
            <CardContent className="p-6">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by case ID, member name, title, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedStatus("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedStatus === "all"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All ({cases.length})
                    </button>
                    <button
                      onClick={() => setSelectedStatus("pending")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedStatus === "pending"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t('workbench.pending')} ({pendingCount})
                    </button>
                    <button
                      onClick={() => setSelectedStatus("in-review")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedStatus === "in-review"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t('workbench.inReview')} ({inReviewCount})
                    </button>
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Flag className="w-4 h-4 mr-2" />
                    {t('workbench.priority')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedPriority("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedPriority === "all"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t('workbench.all')}
                    </button>
                    {(["urgent", "high", "medium", "low"] as CasePriority[]).map(priority => {
                      const count = cases.filter(c => c.priority === priority).length;
                      return (
                        <button
                          key={priority}
                          onClick={() => setSelectedPriority(priority)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedPriority === priority
                              ? "bg-orange-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {priorityConfig[priority].label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sort Controls */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Sort By
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { field: "submittedDate" as SortField, label: "Date Submitted" },
                    { field: "priority" as SortField, label: "Priority" },
                    { field: "status" as SortField, label: "Status" },
                    { field: "title" as SortField, label: "Title" }
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => handleSort(field)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        sortField === field
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                      {sortField === field && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "â†‘" : "â†“"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cases List */}
        <div className="space-y-6">
          <AnimatePresence>
            {filteredAndSortedCases.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <Clipboard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {t('workbench.noCasesFound')}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {searchQuery || selectedStatus !== "all" || selectedPriority !== "all"
                        ? t('workbench.adjustFilters')
                        : t('workbench.allProcessed')}
                    </p>
                    {(searchQuery || selectedStatus !== "all" || selectedPriority !== "all") && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedStatus("all");
                          setSelectedPriority("all");
                        }}
                        className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredAndSortedCases.map((caseItem, index) => {
                const isExpanded = expandedCase === caseItem.id;
                const statusInfo = statusConfig[caseItem.status];
                const priorityInfo = priorityConfig[caseItem.priority];

                return (
                  <motion.div
                    key={caseItem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                      <CardContent className="p-6">
                        {/* Case Header */}
                        <div 
                          className="cursor-pointer"
                          onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-sm font-mono text-gray-500">
                                  {caseItem.id}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusInfo.color}`}>
                                  <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor} ${caseItem.status === "pending" ? "animate-pulse" : ""}`}></span>
                                  {statusInfo.label}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 ${priorityInfo.color}`}>
                                  {priorityInfo.icon}
                                  {priorityInfo.label}
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                  {caseItem.category}
                                </span>
                                {caseItem.daysOpen > 5 && (
                                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {caseItem.daysOpen} days open
                                  </span>
                                )}
                              </div>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {caseItem.title}
                              </h3>
                              <p className="text-gray-600 mb-3">
                                {caseItem.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-700">
                                  <User className="w-4 h-4" />
                                  <span className="font-medium">{caseItem.memberName}</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Calendar className="w-4 h-4" />
                                  Submitted: {new Date(caseItem.submittedDate).toLocaleDateString()}
                                </div>
                                {caseItem.assignedTo && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <UserCheck className="w-4 h-4" />
                                    Assigned to: {caseItem.assignedTo}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              className="ml-4 text-orange-600 hover:text-orange-700"
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <ChevronDown className="w-6 h-6" />
                              </motion.div>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-gray-200 pt-6 mt-4"
                            >
                              {/* Member Contact Info */}
                              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Member Contact Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <User className="w-4 h-4" />
                                    <span>{caseItem.memberName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Mail className="w-4 h-4" />
                                    <a href={`mailto:${caseItem.memberEmail}`} className="text-blue-600 hover:underline">
                                      {caseItem.memberEmail}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Phone className="w-4 h-4" />
                                    <a href={`tel:${caseItem.memberPhone}`} className="text-blue-600 hover:underline">
                                      {caseItem.memberPhone}
                                    </a>
                                  </div>
                                </div>
                              </div>

                              {/* Case Notes */}
                              {caseItem.notes.length > 0 && (
                                <div className="mb-6">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Case Notes ({caseItem.notes.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {caseItem.notes.map((note, idx) => (
                                      <div key={idx} className="bg-green-50 p-3 rounded-lg text-sm text-gray-700">
                                        <div className="flex items-start gap-2">
                                          <FileText className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                          <p>{note}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Add Note */}
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4" />
                                  Add Case Note
                                </h4>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Enter your note or update..."
                                    value={newNote[caseItem.id] || ""}
                                    onChange={(e) => setNewNote({ ...newNote, [caseItem.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleAddNote(caseItem.id);
                                      }
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() => handleAddNote(caseItem.id)}
                                    disabled={!newNote[caseItem.id]?.trim()}
                                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    <Send className="w-4 h-4" />
                                    Add Note
                                  </button>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-3">
                                {!caseItem.assignedTo && (
                                  <button
                                    onClick={() => handleAssignToMe(caseItem.id)}
                                    className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                  >
                                    <UserCheck className="w-5 h-5" />
                                    Assign to Me
                                  </button>
                                )}
                                <Link href={`/dashboard/claims/${caseItem.id}`} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                  <Eye className="w-5 h-5" />
                                  View Full Details
                                </Link>
                                <button className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                  <Phone className="w-5 h-5" />
                                  Contact Member
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                  <Edit className="w-5 h-5" />
                                  Update Status
                                </button>
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

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Card className="bg-linear-to-r from-orange-50 to-yellow-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center shrink-0">
                  <Clipboard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    LRO Best Practices
                  </h3>
                  <ul className="text-gray-600 space-y-1 text-sm mb-4">
                    <li>â€¢ Review and assign pending cases within 24 hours</li>
                    <li>â€¢ Update case notes regularly to track progress</li>
                    <li>â€¢ Prioritize urgent and high-priority cases first</li>
                    <li>â€¢ Contact members promptly to gather additional information</li>
                    <li>â€¢ Coordinate with HR and management as needed</li>
                  </ul>
                  <button className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                    View LRO Guidelines
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </>
        )}
      </motion.div>
    </div>
  );
}
