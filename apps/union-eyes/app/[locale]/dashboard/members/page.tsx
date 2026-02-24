"use client";


export const dynamic = 'force-dynamic';
import React from 'react';
/**
 * Members Directory
 * View and manage union member contacts and information
 */

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from 'next-intl';
import { useUser } from "@clerk/nextjs";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import {
  Users,
  Search,
  Filter,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Calendar,
  Shield,
  Award,
  MessageSquare,
  FileText,
  ChevronDown,
  UserPlus,
  Download,
  MoreVertical,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
 
import { Card, CardContent } from "@/components/ui/card";

type MemberRole = "member" | "steward" | "officer" | "admin" | "super_admin";
type MemberStatus = "active" | "inactive" | "on-leave";
type Department = "Manufacturing" | "Logistics" | "Administration" | "Maintenance" | "Customer Service" | "IT";

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  department: Department;
  position: string;
  hireDate: string;
  seniority: number;
  location: string;
  steward?: string;
  activeCases: number;
  joinDate: string;
  membershipNumber: string;
}

export default function MembersPage() {
  const t = useTranslations();
  const { user } = useUser();
  const organizationId = useOrganizationId();
  
  // Role configuration with translated labels
  const roleConfig: Record<MemberRole, { label: string; color: string; icon: React.ReactElement }> = {
    member: { label: t('members.roleMember'), color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Users className="w-3 h-3" /> },
    steward: { label: t('members.roleSteward'), color: "text-purple-700 bg-purple-100 border-purple-200", icon: <Shield className="w-3 h-3" /> },
    officer: { label: t('members.roleOfficer'), color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Award className="w-3 h-3" /> },
    admin: { label: t('members.roleAdmin'), color: "text-red-700 bg-red-100 border-red-200", icon: <Shield className="w-3 h-3" /> },
    super_admin: { label: "Super Admin", color: "text-red-900 bg-red-200 border-red-300", icon: <Shield className="w-3 h-3" /> }
  };

  // Status configuration with translated labels
  const statusConfig: Record<MemberStatus, { label: string; color: string; dotColor: string }> = {
    active: { label: t('members.statusActive'), color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
    inactive: { label: t('members.statusInactive'), color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
    "on-leave": { label: t('members.statusOnLeave'), color: "text-yellow-700 bg-yellow-100 border-yellow-200", dotColor: "bg-yellow-500" }
  };
  
  // Fetch members from API with organization-aware cache key
  // Including organizationId in the key ensures fresh data when switching organizations
  const { data, error, isLoading, mutate: _mutate } = useSWR(
    user && organizationId ? `/api/organization/members?organization=${organizationId}` : null,
    fetcher,
    { 
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true, // Revalidate when window gains focus
      revalidateOnMount: true, // Always fetch fresh data on mount
      dedupingInterval: 2000 // Prevent duplicate requests within 2 seconds
    }
  );

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "all">("all");
  const [selectedRole, setSelectedRole] = useState<MemberRole | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<MemberStatus | "all">("all");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Extract members from API response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: Member[] = data?.success ? data.data.members.map((m: any) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone || "",
    role: m.role as MemberRole,
    status: m.status as MemberStatus,
    department: (m.department || "Administration") as Department,
    position: m.position || "Union Member",
    hireDate: m.hireDate || m.createdAt,
    seniority: m.seniority || 0,
    location: m.metadata?.location || "",
    activeCases: m.metadata?.activeCases || 0,
    joinDate: m.unionJoinDate || m.createdAt,
    membershipNumber: m.membershipNumber || "",
    steward: m.metadata?.steward,
  })) : [];

  const memberCount = data?.data?.stats?.total || 0;
  const activeMemberCount = data?.data?.stats?.active || 0;

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.membershipNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = selectedDepartment === "all" || member.department === selectedDepartment;
    const matchesRole = selectedRole === "all" || member.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || member.status === selectedStatus;
    
    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  // Calculate stats using hook-provided values and filtered data
  const totalMembers = memberCount;
  const activeMembers = activeMemberCount;
  const stewardsCount = members.filter(m => m.role === "steward").length;
  const avgSeniority = members.length > 0 
    ? Math.round(members.reduce((sum, m) => sum + m.seniority, 0) / members.length)
    : 0;

  // Get unique departments
  const departments = Array.from(new Set(members.map(m => m.department))).sort();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">{t('members.loadingMembers')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('members.errorLoadingMembers')}</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-10 h-10 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900">
                {t('members.directory')}
              </h1>
            </div>
            <p className="text-lg text-gray-600">
              {t('members.directoryDescription')}
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <button
              onClick={() => window.location.href = '/dashboard/members/new'}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <UserPlus className="w-5 h-5" />
              {t('members.addMember')}
            </button>
          </motion.div>
        </div>

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
                    <p className="text-sm text-gray-600 mb-1">{t('members.totalMembers')}</p>
                    <p className="text-3xl font-bold text-blue-600">{totalMembers}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
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
                    <p className="text-sm text-gray-600 mb-1">{t('members.activeMembers')}</p>
                    <p className="text-3xl font-bold text-green-600">{activeMembers}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
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
                    <p className="text-sm text-gray-600 mb-1">{t('members.stewards')}</p>
                    <p className="text-3xl font-bold text-purple-600">{stewardsCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-purple-600" />
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
                    <p className="text-sm text-gray-600 mb-1">{t('members.avgSeniority')}</p>
                    <p className="text-3xl font-bold text-orange-600">{avgSeniority}y</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Award className="w-6 h-6 text-orange-600" />
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
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-8">
            <CardContent className="p-6">
              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('members.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Department Filter */}
                <div>
                  <label htmlFor="department-filter" className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    {t('members.department')}
                  </label>
                  <select
                    id="department-filter"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value as Department | "all")}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('members.allDepartments')}</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Role Filter */}
                <div>
                  <label htmlFor="role-filter" className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    {t('members.role')}
                  </label>
                  <select
                    id="role-filter"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as MemberRole | "all")}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('members.allRoles')}</option>
                    <option value="member">{t('members.members')}</option>
                    <option value="steward">{t('members.stewards')}</option>
                    <option value="officer">{t('members.officers')}</option>
                    <option value="admin">{t('members.admins')}</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {t('members.status')}
                  </label>
                  <select
                    id="status-filter"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as MemberStatus | "all")}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('members.allStatus')}</option>
                    <option value="active">{t('members.active')}</option>
                    <option value="on-leave">{t('members.onLeave')}</option>
                    <option value="inactive">{t('members.inactive')}</option>
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <UserPlus className="w-4 h-4" />
                  {t('members.addMember')}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <Download className="w-4 h-4" />
                  {t('members.exportDirectory')}
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <FileText className="w-4 h-4" />
                  {t('members.printDirectory')}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Members List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {t('members.showingResults', { filtered: filteredMembers.length, total: totalMembers })}
            </p>
          </div>

          <AnimatePresence>
            {filteredMembers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No Members Found
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Try adjusting your search or filters to find members.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDepartment("all");
                        setSelectedRole("all");
                        setSelectedStatus("all");
                      }}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredMembers.map((member, index) => {
                const isExpanded = expandedMember === member.id;
                const roleInfo = roleConfig[member.role];
                const statusInfo = statusConfig[member.status];

                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                      <CardContent className="p-6">
                        {/* Member Header */}
                        <div 
                          className="cursor-pointer"
                          onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              {/* Avatar */}
                              <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </div>

                              {/* Member Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {member.name}
                                  </h3>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusInfo.color}`}>
                                    <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`}></span>
                                    {statusInfo.label}
                                  </span>
                                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${roleInfo.color}`}>
                                    {roleInfo.icon}
                                    {roleInfo.label}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Briefcase className="w-4 h-4 text-gray-400" />
                                    <span>{member.position}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span>{member.department}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>{member.seniority} years seniority</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                                      {member.email}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-700">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline">
                                      {member.phone}
                                    </a>
                                  </div>
                                  {member.activeCases > 0 && (
                                    <div className="flex items-center gap-2 text-orange-600">
                                      <FileText className="w-4 h-4" />
                                      <span className="font-medium">{member.activeCases} active case{member.activeCases !== 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              className="ml-4 text-blue-600 hover:text-blue-700"
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
                              className="border-t border-gray-200 pt-6 mt-6"
                            >
                              {/* Detailed Information */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Member Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Membership Number:</span>
                                      <span className="font-medium text-gray-900">{member.membershipNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Join Date:</span>
                                      <span className="font-medium text-gray-900">
                                        {new Date(member.joinDate).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Hire Date:</span>
                                      <span className="font-medium text-gray-900">
                                        {new Date(member.hireDate).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Location:</span>
                                      <span className="font-medium text-gray-900">{member.location}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Union Details</h4>
                                  <div className="space-y-2 text-sm">
                                    {member.steward && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Assigned Steward:</span>
                                        <span className="font-medium text-blue-600">{member.steward}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Active Cases:</span>
                                      <span className="font-medium text-gray-900">{member.activeCases}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Member Status:</span>
                                      <span className={`font-medium ${member.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                                        {statusInfo.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-3">
                                <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                  <Mail className="w-5 h-5" />
                                  Send Email
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                  <Phone className="w-5 h-5" />
                                  Call Member
                                </button>
                                <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                  <MessageSquare className="w-5 h-5" />
                                  Send Message
                                </button>
                                {member.activeCases > 0 && (
                                  <button className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                                    <FileText className="w-5 h-5" />
                                    View Cases
                                  </button>
                                )}
                                <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                  <MoreVertical className="w-5 h-5" />
                                  More Options
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
          <Card className="bg-linear-to-r from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Member Directory Guidelines
                  </h3>
                  <ul className="text-gray-600 space-y-1 text-sm mb-4">
                    <li>• Contact information is for union business only</li>
                    <li>• Respect member privacy and confidentiality</li>
                    <li>• Update member records when information changes</li>
                    <li>• Report any outdated or incorrect information</li>
                  </ul>
                  <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Privacy Policy
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
