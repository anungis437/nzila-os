"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
/**
 * Agreements Page
 * View and search collective bargaining agreements and contracts
 */

import { useState, useEffect } from "react";
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
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<AgreementType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<AgreementStatus | "all">("all");
  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgreements = async () => {
      try {
        const res = await fetch('/api/v2/agreements');
        if (res.ok) {
          const json = await res.json();
          const raw = Array.isArray(json) ? json : json?.agreements ?? json?.data ?? [];
          // Map DB shape to Agreement interface
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items: Agreement[] = raw.map((r: any) => ({
            id: r.id,
            title: r.title ?? 'Untitled Agreement',
            type: r.type ?? 'collective-bargaining',
            status: r.status === 'under_negotiation' ? 'pending'
              : r.status === 'ratified_pending' ? 'pending'
              : r.status === 'expired' ? 'expired'
              : r.status === 'archived' ? 'expired'
              : 'active',
            effectiveDate: r.effectiveDate ?? r.effective_date ?? '',
            expirationDate: r.expiryDate ?? r.expiry_date ?? r.expirationDate ?? '',
            description: r.description ?? r.bargainingUnitDescription ?? r.bargaining_unit_description ?? '',
            fileSize: r.fileSize ?? '',
            pageCount: r.pageCount ?? 0,
            lastUpdated: r.updatedAt ?? r.updated_at ?? r.lastUpdated ?? '',
            version: r.version ? String(r.version) : '1.0',
            keyTerms: Array.isArray(r.keyTerms ?? r.key_terms) ? (r.keyTerms ?? r.key_terms) : [],
            summary: r.summaryGenerated ?? r.summary_generated ?? r.summary ?? '',
          }));
          if (items.length > 0) setAgreements(items);
        }
      } catch {
        // API not available — use fallback data
      }
    };
    fetchAgreements();
  }, []);

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
    <div className="p-4 sm:p-6 lg:p-8">
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
