"use client";

/**
 * Members Directory Console (client component)
 * Rendered by the server-side page wrapper after auth check.
 *
 * Reads GET /api/members, which answers { success, data: { members, total }, timestamp } with the directory the caller may see (a steward:
 * members in their cases; chief steward and above: the organization). One request of up to 200 members is made. `total` is the number of
 * members the caller may see, so when it is more than what was loaded the screen says so: its totals, its filters and its export cover the
 * loaded members.
 *
 * A field the caller may not see, or the record does not have, is null and is shown as nothing or as a dash. No default is made up for it,
 * and a response that is not the route's is an error with a retry, never an empty directory.
 */

import { useState, type ReactElement } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { useOrganization } from "@/lib/hooks/use-organization";
import { buildMembersFetchUrl } from "@/lib/members/build-members-fetch-url";
import { generateCSV, type CSVColumn } from "@/lib/csv-export";
import { ApiShapeError, envelopeData, readApiError } from "@/lib/client/api-envelope";
import { asRecord, countOrNull, humanize, optionalString, requiredString } from "@/lib/client/row-fields";
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
  ChevronDown,
  Download,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** How many members one request asks for: the most the route gives. */
const PAGE_LIMIT = 200;

const COPY = {
  en: {
    partial: (loaded: number, total: number) => `Only the first ${loaded} of ${total} members were loaded. The totals, the filters and the export on this page cover those ${loaded} members.`,
    noMatches: "No members match your search or filters.",
    clearFilters: "Clear filters",
    exportMembers: (n: number) => `Export ${n} member${n === 1 ? "" : "s"} (CSV)`,
    viewProfile: "View profile",
    sendEmail: "Send email",
    call: "Call",
    seniority: "Seniority",
    expand: "Expand",
    collapse: "Collapse",
  },
  fr: {
    partial: (loaded: number, total: number) => `Seuls les ${loaded} premiers membres sur ${total} ont été chargés. Les totaux, les filtres et l’exportation de cette page portent sur ces ${loaded} membres.`,
    noMatches: "Aucun membre ne correspond à votre recherche ou à vos filtres.",
    clearFilters: "Effacer les filtres",
    exportMembers: (n: number) => `Exporter ${n} membre${n > 1 ? "s" : ""} (CSV)`,
    viewProfile: "Voir le profil",
    sendEmail: "Envoyer un courriel",
    call: "Appeler",
    seniority: "Ancienneté",
    expand: "Développer",
    collapse: "Réduire",
  },
} as const;

/** A member as the directory route projects it: what the caller may not see, or the record does not have, is null. */
interface DirectoryMember {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  department: string | null;
  position: string | null;
  membershipNumber: string | null;
  /** Employment facts that only an officer may see. */
  hireDate: string | null;
  unionJoinDate: string | null;
  seniority: number | null;
}

interface Directory {
  members: DirectoryMember[];
  /** How many members the caller may see, which is more than were loaded when the directory is longer than one request. */
  total: number;
  mayHaveMore: boolean;
}

function toMember(value: unknown): DirectoryMember {
  const row = asRecord(value, "member");
  return {
    id: requiredString(row, "id"),
    name: optionalString(row, "name"),
    email: optionalString(row, "email"),
    phone: optionalString(row, "phone"),
    role: requiredString(row, "role"),
    status: requiredString(row, "status"),
    department: optionalString(row, "department"),
    position: optionalString(row, "position"),
    membershipNumber: optionalString(row, "membershipNumber"),
    hireDate: optionalString(row, "hireDate"),
    unionJoinDate: optionalString(row, "unionJoinDate"),
    seniority: countOrNull(row, "seniority"),
  };
}

async function loadDirectory(organizationId: string): Promise<Directory> {
  const base = buildMembersFetchUrl(organizationId);
  const response = await fetch(`${base}${base.includes("?") ? "&" : "?"}limit=${PAGE_LIMIT}`);
  if (!response.ok) throw new Error(await readApiError(response, `The directory could not be loaded (HTTP ${response.status}).`));
  const payload = envelopeData(await response.json());
  if (!Array.isArray(payload.members)) throw new ApiShapeError("no members");
  const members = payload.members.map(toMember);
  const { total } = payload;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) throw new ApiShapeError("no total");
  return { members, total, mayHaveMore: total > members.length };
}

const titleCase = (words: string) => words.replace(/\b\w/g, (letter) => letter.toUpperCase());

/** A calendar date from a stored timestamp, in UTC: dates of employment are days, and a local time zone must not move them. */
function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { timeZone: "UTC" });
}

function initialsOf(member: DirectoryMember): string {
  const source = member.name ?? member.email ?? "";
  const letters = source.split(/\s+/).filter((part) => part !== "").slice(0, 2).map((part) => part.charAt(0));
  return letters.join("").toUpperCase();
}

function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const EXPORT_COLUMNS: CSVColumn<DirectoryMember>[] = [
  { header: "Name", accessor: (m) => m.name },
  { header: "Email", accessor: (m) => m.email },
  { header: "Phone", accessor: (m) => m.phone },
  { header: "Role", accessor: (m) => m.role },
  { header: "Status", accessor: (m) => m.status },
  { header: "Department", accessor: (m) => m.department },
  { header: "Position", accessor: (m) => m.position },
  { header: "Membership number", accessor: (m) => m.membershipNumber },
  { header: "Union join date", accessor: (m) => m.unionJoinDate?.slice(0, 10) },
  { header: "Hire date", accessor: (m) => m.hireDate?.slice(0, 10) },
  { header: "Seniority", accessor: (m) => m.seniority },
];

const ROLE_ORDER = ["member", "steward", "officer", "admin", "super_admin"];

const ROLE_STYLE: Record<string, { color: string; icon: ReactElement }> = {
  member: { color: "text-blue-700 bg-blue-100 border-blue-200", icon: <Users className="w-3 h-3" /> },
  steward: { color: "text-purple-700 bg-purple-100 border-purple-200", icon: <Shield className="w-3 h-3" /> },
  officer: { color: "text-orange-700 bg-orange-100 border-orange-200", icon: <Award className="w-3 h-3" /> },
  admin: { color: "text-red-700 bg-red-100 border-red-200", icon: <Shield className="w-3 h-3" /> },
  super_admin: { color: "text-red-900 bg-red-200 border-red-300", icon: <Shield className="w-3 h-3" /> },
};
const UNKNOWN_ROLE_STYLE = { color: "text-gray-700 bg-gray-100 border-gray-200", icon: <Users className="w-3 h-3" /> };

const STATUS_STYLE: Record<string, { color: string; dotColor: string }> = {
  active: { color: "text-green-700 bg-green-100 border-green-200", dotColor: "bg-green-500" },
  inactive: { color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" },
  "on-leave": { color: "text-yellow-700 bg-yellow-100 border-yellow-200", dotColor: "bg-yellow-500" },
};
const UNKNOWN_STATUS_STYLE = { color: "text-gray-700 bg-gray-100 border-gray-200", dotColor: "bg-gray-500" };

export default function MembersConsole({ organizationId: orgIdProp }: { organizationId?: string } = {}) {
  const t = useTranslations();
  const { organizationId, userOrganizations, isLoading: orgLoading } = useOrganization();
  const effectiveOrganizationId = orgIdProp ?? organizationId ?? userOrganizations[0]?.id ?? null;
  const locale = useLocale();
  const copy = locale.toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;

  const roleLabel = (role: string): string => {
    switch (role) {
      case "member": return t("members.roleMember");
      case "steward": return t("members.roleSteward");
      case "officer": return t("members.roleOfficer");
      case "admin": return t("members.roleAdmin");
      default: return titleCase(humanize(role));
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case "active": return t("members.statusActive");
      case "inactive": return t("members.statusInactive");
      case "on-leave": return t("members.statusOnLeave");
      default: return titleCase(humanize(status));
    }
  };

  // Fetch members from the single authoritative endpoint. `/api/members`
  // resolves the caller's own organization from the authenticated session
  // when no `organizationId` query param is supplied (see
  // app/api/members/route.ts) — there is no need to guess across candidate
  // organizations client-side, and a failed request must surface as a real
  // error rather than silently falling back to a different endpoint or an
  // empty "no members" result.
  const { data, error, isLoading, mutate } = useSWR(
    (orgIdProp || !orgLoading) ? ['members', effectiveOrganizationId ?? 'auto'] as const : null,
    ([, orgId]) => loadDirectory(orgId),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnMount: true,
      dedupingInterval: 2000,
    }
  );

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Loading state
  if (orgLoading || isLoading || (!data && !error)) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">{t('members.loadingMembers')}</p>
        </div>
      </div>
    );
  }

  // Error state: a directory that could not be had is not an empty directory.
  if (error || !data) {
    return (
      <div role="alert" className="flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('members.errorLoadingMembers')}</h2>
          <p className="text-gray-600 mb-4">{error instanceof Error ? error.message : ""}</p>
          <button
            type="button"
            onClick={() => { void mutate(); }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { members, total, mayHaveMore } = data;

  // Filter members
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredMembers = members.filter(member => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      [member.name, member.email, member.position, member.membershipNumber].some((field) => field?.toLowerCase().includes(normalizedSearch));

    const matchesDepartment = selectedDepartment === "all" || member.department === selectedDepartment;
    const matchesRole = selectedRole === "all" || member.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || member.status === selectedStatus;

    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  // The options are what the loaded members have, not a fixed list of departments and statuses that no member may have.
  const departments = Array.from(new Set(members.flatMap((m) => (m.department === null ? [] : [m.department])))).sort();
  const roles = Array.from(new Set(members.map((m) => m.role))).sort((a, b) => {
    const rank = (role: string) => (ROLE_ORDER.includes(role) ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const statuses = Array.from(new Set(members.map((m) => m.status))).sort();

  // Calculate stats over the loaded members
  const totalLabel = `${members.length}${mayHaveMore ? "+" : ""}`;
  const activeMembers = members.filter(m => m.status === "active").length;
  const stewardsCount = members.filter(m => m.role === "steward").length;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedDepartment("all");
    setSelectedRole("all");
    setSelectedStatus("all");
  };

  const exportDirectory = () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(generateCSV(filteredMembers, EXPORT_COLUMNS), `members-directory-${day}.csv`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
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
        </div>

        {mayHaveMore && (
          <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{copy.partial(members.length, total)}</p>
          </div>
        )}

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
                    <p className="text-sm text-gray-600 mb-1">{t('members.totalMembers')}</p>
                    <p className="text-3xl font-bold text-blue-600">{totalLabel}</p>
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
                    onChange={(e) => setSelectedDepartment(e.target.value)}
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
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('members.allRoles')}</option>
                    {roles.map(role => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
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
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">{t('members.allStatus')}</option>
                    {statuses.map(status => (
                      <option key={status} value={status}>{statusLabel(status)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions: the export is of the members listed below, as filtered */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={exportDirectory}
                  disabled={filteredMembers.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {copy.exportMembers(filteredMembers.length)}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Members List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {t('members.showingResults', { filtered: filteredMembers.length, total: totalLabel })}
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
                      {members.length === 0 ? t('members.noMembers') : copy.noMatches}
                    </h3>
                    {members.length > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {copy.clearFilters}
                      </button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredMembers.map((member, index) => {
                const isExpanded = expandedMember === member.id;
                const roleStyle = ROLE_STYLE[member.role] ?? UNKNOWN_ROLE_STYLE;
                const statusStyle = STATUS_STYLE[member.status] ?? UNKNOWN_STATUS_STYLE;
                const toggle = () => setExpandedMember(isExpanded ? null : member.id);

                const details: Array<[string, string]> = [];
                if (member.membershipNumber !== null) details.push([t('members.memberNumber'), member.membershipNumber]);
                if (member.unionJoinDate !== null) details.push([t('members.joinDate'), formatDate(member.unionJoinDate, locale)]);
                if (member.hireDate !== null) details.push([t('members.hireDate'), formatDate(member.hireDate, locale)]);
                if (member.seniority !== null) details.push([copy.seniority, String(member.seniority)]);
                details.push([t('members.status'), statusLabel(member.status)], [t('members.role'), roleLabel(member.role)]);

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
                          onClick={toggle}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                              {/* Avatar */}
                              <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
                                {initialsOf(member)}
                              </div>

                              {/* Member Info */}
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {member.name ?? member.email ?? "—"}
                                  </h3>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${statusStyle.color}`}>
                                    <span className={`w-2 h-2 rounded-full ${statusStyle.dotColor}`}></span>
                                    {statusLabel(member.status)}
                                  </span>
                                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${roleStyle.color}`}>
                                    {roleStyle.icon}
                                    {roleLabel(member.role)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                  {member.position !== null && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                      <Briefcase className="w-4 h-4 text-gray-400" />
                                      <span>{member.position}</span>
                                    </div>
                                  )}
                                  {member.department !== null && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      <span>{member.department}</span>
                                    </div>
                                  )}
                                  {member.seniority !== null && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                      <Calendar className="w-4 h-4 text-gray-400" />
                                      <span>{copy.seniority}: {member.seniority}</span>
                                    </div>
                                  )}
                                  {member.email !== null && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                      <Mail className="w-4 h-4 text-gray-400" />
                                      <a href={`mailto:${member.email}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">
                                        {member.email}
                                      </a>
                                    </div>
                                  )}
                                  {member.phone !== null && (
                                    <div className="flex items-center gap-2 text-gray-700">
                                      <Phone className="w-4 h-4 text-gray-400" />
                                      <a href={`tel:${member.phone}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">
                                        {member.phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="ml-4 text-blue-600 hover:text-blue-700"
                              aria-label={isExpanded ? copy.collapse : copy.expand}
                              aria-expanded={isExpanded}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle();
                              }}
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
                              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
                                {details.map(([label, value]) => (
                                  <div key={label} className="flex justify-between">
                                    <dt className="text-gray-600">{label}:</dt>
                                    <dd className="font-medium text-gray-900">{value}</dd>
                                  </div>
                                ))}
                              </dl>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap gap-3">
                                <Link
                                  href={`/${locale}/dashboard/members/${member.id}`}
                                  className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                  <Users className="w-5 h-5" />
                                  {copy.viewProfile}
                                </Link>
                                {member.email !== null && (
                                  <a
                                    href={`mailto:${member.email}`}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    <Mail className="w-5 h-5" />
                                    {copy.sendEmail}
                                  </a>
                                )}
                                {member.phone !== null && (
                                  <a
                                    href={`tel:${member.phone}`}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                  >
                                    <Phone className="w-5 h-5" />
                                    {copy.call}
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
      </motion.div>
    </div>
  );
}
