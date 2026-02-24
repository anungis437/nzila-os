"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
/**
 * Agreements Page
 * View and search collective bargaining agreements and contracts
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from 'next-intl';
import { 
  BookOpen, 
  Calendar, 
  Download, 
  FileText, 
  Search, 
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Filter,
  Eye,
  TrendingUp
} from "lucide-react";
 
import { Card, CardContent } from "@/components/ui/card";

type AgreementStatus = "active" | "expired" | "pending";
type AgreementType = "collective-bargaining" | "side-letter" | "mou" | "policy" | "amendment";

interface Agreement {
  id: string;
  title: string;
  type: AgreementType;
  status: AgreementStatus;
  effectiveDate: string;
  expirationDate: string;
  description: string;
  fileSize: string;
  pageCount: number;
  lastUpdated: string;
  version: string;
  keyTerms: string[];
  summary: string;
}

const mockAgreements: Agreement[] = [
  {
    id: "CBA-2025",
    title: "2025-2028 Collective Bargaining Agreement",
    type: "collective-bargaining",
    status: "active",
    effectiveDate: "2025-01-01",
    expirationDate: "2028-12-31",
    description: "Primary collective bargaining agreement covering wages, benefits, working conditions, and grievance procedures for all union members.",
    fileSize: "2.4 MB",
    pageCount: 156,
    lastUpdated: "2025-01-15",
    version: "1.0",
    keyTerms: ["Wage Increases", "Healthcare", "Vacation", "Seniority", "Grievance Procedure"],
    summary: "Includes 3% annual wage increases, expanded healthcare coverage, additional vacation days for senior members, and updated safety protocols."
  },
  {
    id: "SL-2025-001",
    title: "Remote Work Side Letter Agreement",
    type: "side-letter",
    status: "active",
    effectiveDate: "2025-03-01",
    expirationDate: "2026-02-28",
    description: "Supplemental agreement establishing remote work policies, equipment provisions, and performance expectations.",
    fileSize: "485 KB",
    pageCount: 12,
    lastUpdated: "2025-03-01",
    version: "1.0",
    keyTerms: ["Remote Work", "Equipment", "Scheduling", "Communication"],
    summary: "Allows eligible members to work remotely up to 3 days per week with company-provided equipment and internet stipend."
  },
  {
    id: "MOU-2024-003",
    title: "Safety Protocol Memorandum of Understanding",
    type: "mou",
    status: "active",
    effectiveDate: "2024-06-15",
    expirationDate: "2026-06-14",
    description: "Agreement on workplace safety procedures, protective equipment requirements, and incident reporting protocols.",
    fileSize: "892 KB",
    pageCount: 28,
    lastUpdated: "2024-06-15",
    version: "2.1",
    keyTerms: ["Safety Equipment", "Training", "Incident Reporting", "OSHA Compliance"],
    summary: "Updated safety standards including mandatory quarterly training, enhanced PPE requirements, and streamlined incident reporting."
  },
  {
    id: "CBA-2022",
    title: "2022-2024 Collective Bargaining Agreement",
    type: "collective-bargaining",
    status: "expired",
    effectiveDate: "2022-01-01",
    expirationDate: "2024-12-31",
    description: "Previous collective bargaining agreement (superseded by 2025-2028 CBA).",
    fileSize: "2.1 MB",
    pageCount: 142,
    lastUpdated: "2024-12-31",
    version: "3.2",
    keyTerms: ["Historical Reference"],
    summary: "Previous agreement maintained for reference purposes. Members should refer to the current 2025-2028 CBA for active terms."
  },
  {
    id: "POLICY-2025-001",
    title: "Paid Family Leave Policy",
    type: "policy",
    status: "active",
    effectiveDate: "2025-01-01",
    expirationDate: "2025-12-31",
    description: "Policy outlining paid family leave benefits, eligibility requirements, and application procedures.",
    fileSize: "320 KB",
    pageCount: 8,
    lastUpdated: "2025-01-01",
    version: "1.0",
    keyTerms: ["Family Leave", "Parental Leave", "Benefits", "Eligibility"],
    summary: "Provides up to 12 weeks of paid family leave for birth, adoption, or care of a family member with serious health condition."
  },
  {
    id: "AMD-2025-001",
    title: "Wage Scale Amendment 2025",
    type: "amendment",
    status: "pending",
    effectiveDate: "2025-07-01",
    expirationDate: "2028-12-31",
    description: "Proposed amendment to adjust wage scales based on cost of living increases and market analysis.",
    fileSize: "156 KB",
    pageCount: 4,
    lastUpdated: "2025-05-10",
    version: "0.9 (Draft)",
    keyTerms: ["Wage Adjustment", "COLA", "Market Rate"],
    summary: "Proposes additional 2% wage adjustment for all classifications effective July 1, 2025. Pending membership ratification."
  }
];

const typeConfig: Record<AgreementType, { label: string; color: string; icon: React.ReactElement }> = {
  "collective-bargaining": { 
    label: "Collective Bargaining Agreement", 
    color: "text-blue-700 bg-blue-100 border-blue-200",
    icon: <BookOpen className="w-4 h-4" />
  },
  "side-letter": { 
    label: "Side Letter", 
    color: "text-purple-700 bg-purple-100 border-purple-200",
    icon: <FileText className="w-4 h-4" />
  },
  "mou": { 
    label: "Memorandum of Understanding", 
    color: "text-green-700 bg-green-100 border-green-200",
    icon: <FileText className="w-4 h-4" />
  },
  "policy": { 
    label: "Policy", 
    color: "text-amber-700 bg-amber-100 border-amber-200",
    icon: <Tag className="w-4 h-4" />
  },
  "amendment": { 
    label: "Amendment", 
    color: "text-cyan-700 bg-cyan-100 border-cyan-200",
    icon: <FileText className="w-4 h-4" />
  }
};

const statusConfig: Record<AgreementStatus, { label: string; icon: React.ReactElement; color: string }> = {
  active: { 
    label: "Active", 
    icon: <CheckCircle className="w-4 h-4" />, 
    color: "text-green-700 bg-green-100 border-green-200" 
  },
  expired: { 
    label: "Expired", 
    icon: <Clock className="w-4 h-4" />, 
    color: "text-gray-700 bg-gray-100 border-gray-200" 
  },
  pending: { 
    label: "Pending Ratification", 
    icon: <AlertCircle className="w-4 h-4" />, 
    color: "text-yellow-700 bg-yellow-100 border-yellow-200" 
  }
};

export default function AgreementsPage() {
  const t = useTranslations();
  const { user: _user } = useUser();
  const [agreements] = useState<Agreement[]>(mockAgreements);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<AgreementType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<AgreementStatus | "all">("all");
  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null);

  // Filter agreements
  const filteredAgreements = agreements.filter(agreement => {
    const matchesSearch = 
      agreement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agreement.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agreement.keyTerms.some(term => term.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = selectedType === "all" || agreement.type === selectedType;
    const matchesStatus = selectedStatus === "all" || agreement.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate stats
  const activeCount = agreements.filter(a => a.status === "active").length;
  const pendingCount = agreements.filter(a => a.status === "pending").length;
  const totalDocs = agreements.reduce((sum, a) => sum + a.pageCount, 0);

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-purple-50 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('agreements.title')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('agreements.subtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('agreements.activeAgreements')}</p>
                    <p className="text-3xl font-bold text-green-600">{activeCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
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
                    <p className="text-sm text-gray-600 mb-1">{t('agreements.pendingReview')}</p>
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
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('agreements.totalPages')}</p>
                    <p className="text-3xl font-bold text-purple-600">{totalDocs}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-purple-600" />
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
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-8">
            <CardContent className="p-6">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search agreements by title, description, or key terms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Filter Buttons */}
              <div className="space-y-4">
                {/* Type Filters */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Document Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedType("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedType === "all"
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All Types ({agreements.length})
                    </button>
                    {Object.entries(typeConfig).map(([type, config]) => {
                      const count = agreements.filter(a => a.type === type).length;
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedType(type as AgreementType)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            selectedType === type
                              ? "bg-purple-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {config.icon}
                          {config.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Filters */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedStatus("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedStatus === "all"
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All Status
                    </button>
                    {Object.entries(statusConfig).map(([status, config]) => {
                      const count = agreements.filter(a => a.status === status).length;
                      return (
                        <button
                          key={status}
                          onClick={() => setSelectedStatus(status as AgreementStatus)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            selectedStatus === status
                              ? "bg-purple-600 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {config.icon}
                          {config.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Agreements List */}
        <div className="space-y-6">
          <AnimatePresence>
            {filteredAgreements.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {t('agreements.noAgreementsFound')}
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {t('agreements.adjustFilters')}
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedType("all");
                        setSelectedStatus("all");
                      }}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {t('agreements.clearAllFilters')}
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredAgreements.map((agreement, index) => {
                const isExpanded = expandedAgreement === agreement.id;
                const typeInfo = typeConfig[agreement.type];
                const statusInfo = statusConfig[agreement.status];

                return (
                  <motion.div
                    key={agreement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                      <CardContent className="p-6">
                        {/* Agreement Header */}
                        <div 
                          className="cursor-pointer"
                          onClick={() => setExpandedAgreement(isExpanded ? null : agreement.id)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusInfo.color}`}>
                                  {statusInfo.icon}
                                  {statusInfo.label}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${typeInfo.color}`}>
                                  {typeInfo.icon}
                                  {typeInfo.label}
                                </span>
                              </div>
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {agreement.title}
                              </h3>
                              <p className="text-gray-600 mb-3">
                                {agreement.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Effective: {new Date(agreement.effectiveDate).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Expires: {new Date(agreement.expirationDate).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <FileText className="w-4 h-4" />
                                  {agreement.pageCount} pages
                                </div>
                                <div className="flex items-center gap-1">
                                  <Download className="w-4 h-4" />
                                  {agreement.fileSize}
                                </div>
                              </div>
                            </div>
                            <button
                              className="ml-4 text-purple-600 hover:text-purple-700"
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <AlertCircle className="w-6 h-6" />
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
                              {/* Summary */}
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">Summary</h4>
                                <p className="text-gray-600 bg-blue-50 p-4 rounded-lg">
                                  {agreement.summary}
                                </p>
                              </div>

                              {/* Key Terms */}
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Terms Covered</h4>
                                <div className="flex flex-wrap gap-2">
                                  {agreement.keyTerms.map((term, idx) => (
                                    <span
                                      key={idx}
                                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                                    >
                                      {term}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Document Info */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <p className="text-sm text-gray-600 mb-1">Version</p>
                                  <p className="text-lg font-semibold text-gray-900">{agreement.version}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {new Date(agreement.lastUpdated).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-3">
                                <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                  <Download className="w-5 h-5" />
                                  Download PDF
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                  <Eye className="w-5 h-5" />
                                  View Online
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                  <ExternalLink className="w-5 h-5" />
                                  Share Link
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
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Card className="bg-linear-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Need Help Understanding an Agreement?
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Your steward or union representative can help explain any terms or provisions in these agreements.
                  </p>
                  <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    Contact Your Steward
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
