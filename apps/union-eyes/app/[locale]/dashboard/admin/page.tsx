"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Users,
  Settings,
  Shield,
  BarChart3,
  Database,
  Building2,
  FileText,
  Search,
  Plus,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  Activity,
  Download,
  RefreshCw,
  Info,
  Sparkles,
  Loader2,
} from "lucide-react";

type AdminSection =
  | "overview"
  | "users"
  | "locals"
  | "system"
  | "security"
  | "reports"
  | "database"
  | "ai-testing";

interface LocalSection {
  id: string;
  number: string;
  name: string;
  region: string;
  memberCount: number;
  activeCount: number;
  president: string;
  contact: string;
  status: "active" | "inactive";
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "lro" | "steward" | "member";
  organizationId: string;
  organizationName: string;
  local?: string;
  status: "active" | "inactive";
  lastLogin: string | null;
  joinedAt?: string | null;
}

export default function AdminPage() {
  const t = useTranslations();
  const [activeSection, setActiveSection] =
    useState<AdminSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [systemStats, setSystemStats] = useState<any>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [organizations, setOrganizations] = useState<LocalSection[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activity, setActivity] = useState<any[]>([]);

  // Load data from API
  useEffect(() => {
    if (activeSection === "overview") {
      loadSystemStats();
      loadRecentActivity();
    } else if (activeSection === "users") {
      loadUsers();
    } else if (activeSection === "locals") {
      loadOrganizations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeSection === "users" && searchQuery) {
        loadUsers();
      } else if (activeSection === "locals" && searchQuery) {
        loadOrganizations();
      }
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadSystemStats = async () => {
    try {
      const response = await fetch("/api/admin/stats/overview");
      const data = await response.json();
      if (data.success) {
        setSystemStats(data.data);
      }
    } catch (_error) {
}
  };

  const loadRecentActivity = async () => {
    try {
      const response = await fetch("/api/admin/stats/activity?limit=10");
      const data = await response.json();
      if (data.success) {
        setActivity(data.data);
      }
    } catch (_error) {
}
  };

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/users${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`
      );
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (_error) {
toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/organizations${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ""}`
      );
      const data = await response.json();
      if (data.success) {
        // Map to LocalSection format
        setOrganizations(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.data.map((org: any) => ({
            id: org.id,
            number: org.slug,
            name: org.name,
            region: org.status,
            memberCount: org.totalUsers,
            activeCount: org.activeUsers,
            president: org.contactEmail || "N/A",
            contact: org.phone || "N/A",
            status: org.status === "active" ? "active" : "inactive",
          }))
        );
      }
    } catch (_error) {
toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleDeleteUser = async (userId: string, organizationId: string) => {
    if (!confirm("Are you sure you want to remove this user?")) return;

    try {
      const response = await fetch(
        `/api/admin/users/${userId}?organizationId=${organizationId}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (data.success) {
        toast.success("User removed successfully");
        loadUsers();
      } else {
        toast.error(data.error || "Failed to remove user");
      }
    } catch (_error) {
toast.error("Failed to remove user");
    }
  };

  const handleToggleUserStatus = async (userId: string, organizationId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action: "toggleStatus" }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("User status updated");
        loadUsers();
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (_error) {
toast.error("Failed to update user");
    }
  };

  const handleClearCache = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/system/cache", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Cache cleared successfully");
      } else {
        toast.error(data.error || "Failed to clear cache");
      }
    } catch (_error) {
toast.error("Failed to clear cache");
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/database/optimize", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Database optimization completed");
      } else {
        toast.error(data.error || "Failed to optimize database");
      }
    } catch (_error) {
toast.error("Failed to optimize database");
    } finally {
      setLoading(false);
    }
  };

  const adminSections = [
    {
      id: "overview",
      label: t('admin.sections.overview'),
      icon: <BarChart3 className="w-5 h-5" />,
      color: "bg-blue-100 text-blue-700",
    },
    {
      id: "users",
      label: t('admin.sections.userManagement'),
      icon: <Users className="w-5 h-5" />,
      color: "bg-purple-100 text-purple-700",
    },
    {
      id: "locals",
      label: t('admin.sections.localSections'),
      icon: <Building2 className="w-5 h-5" />,
      color: "bg-green-100 text-green-700",
    },
    {
      id: "system",
      label: t('admin.sections.systemSettings'),
      icon: <Settings className="w-5 h-5" />,
      color: "bg-orange-100 text-orange-700",
    },
    {
      id: "security",
      label: t('admin.sections.security'),
      icon: <Shield className="w-5 h-5" />,
      color: "bg-red-100 text-red-700",
    },
    {
      id: "reports",
      label: t('admin.sections.reports'),
      icon: <FileText className="w-5 h-5" />,
      color: "bg-indigo-100 text-indigo-700",
    },
    {
      id: "database",
      label: t('admin.sections.database'),
      icon: <Database className="w-5 h-5" />,
      color: "bg-pink-100 text-pink-700",
    },
    {
      id: "ai-testing",
      label: t('admin.sections.aiTesting'),
      icon: <Sparkles className="w-5 h-5" />,
      color: "bg-purple-100 text-purple-700",
    },
  ];

  const roleConfig = {
    admin: { label: t('admin.roles.admin'), color: "bg-red-100 text-red-700" },
    lro: { label: t('admin.roles.lro'), color: "bg-blue-100 text-blue-700" },
    steward: { label: t('admin.roles.steward'), color: "bg-green-100 text-green-700" },
    member: { label: t('admin.roles.member'), color: "bg-gray-100 text-gray-700" },
  };

  const filteredLocals = organizations.filter(
    (local) =>
      local.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      local.number.includes(searchQuery) ||
      local.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-gray-50 to-zinc-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('admin.title')}
          </h1>
          <p className="text-gray-600">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {adminSections.map((section) => (
            <motion.button
              key={section.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveSection(section.id as AdminSection)}
              className={`p-4 rounded-lg transition-all ${
                activeSection === section.id
                  ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:shadow-md border border-gray-200"
              }`}
            >
              <div
                className={`flex items-center justify-center mb-2 ${
                  activeSection === section.id ? "" : section.color
                }`}
              >
                {section.icon}
              </div>
              <p className="text-xs font-medium text-center">
                {section.label}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* System Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('admin.overview.totalMembers')}</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {systemStats ? systemStats.totalMembers.toLocaleString() : "..."}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-green-600 font-medium">
                  {systemStats && `${systemStats.activeToday} active today`}
                </p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {t('admin.overview.localSections')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {systemStats ? (systemStats.activeOrganizations ?? systemStats.activeTenants) : "..."}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  {systemStats && `${systemStats.totalOrganizations ?? systemStats.totalTenants} total organizations`}
                </p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Storage Used</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {systemStats ? `${systemStats.totalStorage.toFixed(1)} GB` : "..."}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Database className="w-7 h-7 text-orange-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  Across all organizations
                </p>
              </Card>

              <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {t('admin.overview.systemHealth')}
                    </p>
                    <p className="text-3xl font-bold text-green-600">98.7%</p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-lg flex items-center justify-center">
                    <Activity className="w-7 h-7 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-green-600 font-medium">
                  {t('admin.overview.allOperational')}
                </p>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {t('admin.overview.recentActivity')}
              </h2>
              <div className="space-y-3">
                {activity.length > 0 ? (
                  activity.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.action}
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.user} - {item.organization ?? item.organizationName ?? 'Organization'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : "N/A"}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Loading activity...</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* User Management Section */}
        {activeSection === "users" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('admin.users.title')}
                </h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">
                  <Plus className="w-4 h-4" />
                  {t('admin.users.addUser')}
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.users.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">Loading users...</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.name')}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.email')}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.role')}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Organization
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.lastLogin')}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.status')}
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          {t('admin.users.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr
                          key={`${user.id}-${user.organizationId}`}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {user.name}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.email}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                roleConfig[user.role]?.color || "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {roleConfig[user.role]?.label || user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.organizationName}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleUserStatus(user.id, user.organizationId)}
                              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${
                                user.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {user.status}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button 
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded" 
                                aria-label="Edit user"
                                onClick={() => window.location.href = `/dashboard/admin/users/${user.id}/edit`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-1 text-red-600 hover:bg-red-50 rounded" 
                                aria-label="Delete user"
                                onClick={() => handleDeleteUser(user.id, user.organizationId)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Local Sections Management */}
        {activeSection === "locals" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('admin.locals.title')}
                </h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all">
                  <Plus className="w-4 h-4" />
                  {t('admin.locals.addLocal')}
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.locals.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Locals Grid */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  <span className="ml-3 text-gray-600">Loading organizations...</span>
                </div>
              ) : organizations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No organizations found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLocals.map((local) => (
                  <Card
                    key={local.id}
                    className="p-5 bg-linear-to-br from-white to-gray-50 border-gray-200 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {t('admin.locals.localPrefix')} {local.number}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              local.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {local.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700">
                          {local.name}
                        </p>
                        <p className="text-xs text-gray-600">{local.region}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded" aria-label="Edit local">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-50 rounded" aria-label="Local settings">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t('admin.locals.totalMembers')}:</span>
                        <span className="font-semibold text-gray-900">
                          {local.memberCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{t('admin.locals.activeMembers')}:</span>
                        <span className="font-semibold text-green-600">
                          {local.activeCount.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${(local.activeCount / local.memberCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-gray-600 mb-1">{t('admin.locals.president')}:</p>
                          <p className="font-medium text-gray-900">
                            {local.president}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-600 mb-1">{t('admin.locals.contact')}:</p>
                          <p className="font-medium text-blue-600">
                            {local.contact}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* System Settings */}
        {activeSection === "system" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t('admin.system.title')}
              </h2>

              <div className="space-y-6">
                {/* General Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('admin.system.general')}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('admin.system.maintenanceMode')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('admin.system.maintenanceModeDesc')}
                        </p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200" aria-label="Toggle maintenance mode">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('admin.system.emailNotifications')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('admin.system.emailNotificationsDesc')}
                        </p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600" aria-label="Toggle email notifications">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('admin.system.automaticBackups')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('admin.system.automaticBackupsDesc')}
                        </p>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600" aria-label="Toggle automatic backups">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Application Cache</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {systemStats ? `${systemStats.totalStorage.toFixed(1)} GB` : "..."}
                      </p>
                      <button 
                        onClick={handleClearCache}
                        disabled={loading}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Clear Cache
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">
                        Database
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {systemStats ? `${systemStats.totalStorage.toFixed(1)} GB` : "..."}
                      </p>
                      <button 
                        onClick={handleOptimizeDatabase}
                        disabled={loading}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Optimize
                      </button>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">
                        Active Users Today
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {systemStats ? systemStats.activeToday : "..."}
                      </p>
                      <button 
                        onClick={() => setActiveSection("overview")}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* AI Testing Section */}
        {activeSection === "ai-testing" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">AI Endpoints Testing</h2>
                  <p className="text-sm text-gray-600">Test AI features with your authentication</p>
                </div>
              </div>

              {/* Test Feedback POST */}
              <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">1. Submit Feedback</h3>
                <p className="text-sm text-gray-600 mb-4">POST /api/ai/feedback</p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="feedback-query-id" className="block text-sm font-medium text-gray-700 mb-2">Query ID</label>
                    <input
                      type="text"
                      id="feedback-query-id"
                      defaultValue="7ba567db-5c19-4f61-b492-385ca10d8ba0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="feedback-rating" className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                    <select
                      id="feedback-rating"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="good">Good</option>
                      <option value="bad">Bad</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
                    <input
                      type="text"
                      id="feedback-comment"
                      defaultValue="Testing from admin panel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <button
                    onClick={async () => {
                      const queryId = (document.getElementById('feedback-query-id') as HTMLInputElement).value;
                      const rating = (document.getElementById('feedback-rating') as HTMLSelectElement).value;
                      const comment = (document.getElementById('feedback-comment') as HTMLInputElement).value;
                      const responseDiv = document.getElementById('feedback-response');
                      
                      if (responseDiv) {
                        responseDiv.style.display = 'block';
                        responseDiv.className = 'mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64';
                        responseDiv.textContent = 'Submitting...';
                      }
                      
                      try {
                        const response = await fetch('/api/ai/feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ query_id: queryId, rating, comment: comment || undefined })
                        });
                        const data = await response.json();
                        
                        if (responseDiv) {
                          if (response.ok) {
                            responseDiv.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âœ… SUCCESS (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          } else {
                            responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âŒ ERROR (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          }
                        }
                      } catch (error) {
                        if (responseDiv) {
                          responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                          responseDiv.textContent = `âŒ NETWORK ERROR\n\n${error instanceof Error ? error.message : String(error)}`;
                        }
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Submit Feedback
                  </button>
                  
                  <div id="feedback-response" className="hidden mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64"></div>
                </div>
              </div>

              {/* Test Feedback GET */}
              <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">2. Get Feedback</h3>
                <p className="text-sm text-gray-600 mb-4">GET /api/ai/feedback?query_id=...</p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="get-feedback-query-id" className="block text-sm font-medium text-gray-700 mb-2">Query ID</label>
                    <input
                      type="text"
                      id="get-feedback-query-id"
                      defaultValue="7ba567db-5c19-4f61-b492-385ca10d8ba0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <button
                    onClick={async () => {
                      const queryId = (document.getElementById('get-feedback-query-id') as HTMLInputElement).value;
                      const responseDiv = document.getElementById('get-feedback-response');
                      
                      if (responseDiv) {
                        responseDiv.style.display = 'block';
                        responseDiv.className = 'mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64';
                        responseDiv.textContent = 'Loading...';
                      }
                      
                      try {
                        const response = await fetch(`/api/ai/feedback?query_id=${queryId}`, {
                          method: 'GET',
                          credentials: 'include'
                        });
                        const data = await response.json();
                        
                        if (responseDiv) {
                          if (response.ok) {
                            responseDiv.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âœ… SUCCESS (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          } else {
                            responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âŒ ERROR (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          }
                        }
                      } catch (error) {
                        if (responseDiv) {
                          responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                          responseDiv.textContent = `âŒ NETWORK ERROR\n\n${error instanceof Error ? error.message : String(error)}`;
                        }
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Get Feedback
                  </button>
                  
                  <div id="get-feedback-response" className="hidden mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64"></div>
                </div>
              </div>

              {/* Test Search */}
              <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Search Documents</h3>
                <p className="text-sm text-gray-600 mb-4">POST /api/ai/search (uses OpenAI)</p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 mb-2">Search Query</label>
                    <input
                      type="text"
                      id="search-query"
                      defaultValue="What are employee rights regarding union activities?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="search-max-results" className="block text-sm font-medium text-gray-700 mb-2">Max Results</label>
                    <input
                      type="number"
                      id="search-max-results"
                      defaultValue="5"
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <button
                    onClick={async () => {
                      const query = (document.getElementById('search-query') as HTMLInputElement).value;
                      const maxResults = parseInt((document.getElementById('search-max-results') as HTMLInputElement).value);
                      const responseDiv = document.getElementById('search-response');
                      
                      if (responseDiv) {
                        responseDiv.style.display = 'block';
                        responseDiv.className = 'mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64';
                        responseDiv.textContent = 'Searching... (This may take a few seconds with OpenAI)';
                      }
                      
                      try {
                        const response = await fetch('/api/ai/search', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ query, max_results: maxResults })
                        });
                        const data = await response.json();
                        
                        if (responseDiv) {
                          if (response.ok) {
                            responseDiv.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âœ… SUCCESS (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          } else {
                            responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                            responseDiv.textContent = `âŒ ERROR (${response.status})\n\n${JSON.stringify(data, null, 2)}`;
                          }
                        }
                      } catch (error) {
                        if (responseDiv) {
                          responseDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-lg font-mono text-xs overflow-auto max-h-64';
                          responseDiv.textContent = `âŒ NETWORK ERROR\n\n${error instanceof Error ? error.message : String(error)}`;
                        }
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Search Documents
                  </button>
                  
                  <div id="search-response" className="hidden mt-4 p-4 bg-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-64"></div>
                </div>
              </div>

              {/* Test Data Info */}
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">ðŸ“Š Test Data Reference</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Query ID:</strong> <code className="bg-white px-2 py-1 rounded">7ba567db-5c19-4f61-b492-385ca10d8ba0</code></p>
                  <p><strong>Organization ID:</strong> <code className="bg-white px-2 py-1 rounded">test-org-001</code></p>
                  <p><strong>Documents:</strong> 3 legal documents (NLRA, Unfair Labor Practice, CBA)</p>
                  <p><strong>Chunks:</strong> 5 searchable text chunks</p>
                  <p><strong>Existing Feedback:</strong> 2 records with rating=&apos;good&apos;</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Security Section */}
        {activeSection === "security" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Security & Audit Logs
              </h2>

              {/* Security Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Security Status</p>
                      <p className="text-xl font-bold text-green-600">Secure</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">All systems operational</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active Sessions</p>
                      <p className="text-xl font-bold text-blue-600">
                        {systemStats?.activeToday || "..."}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Users online today</p>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Security Events</p>
                      <p className="text-xl font-bold text-orange-600">0</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Last 24 hours</p>
                </div>
              </div>

              {/* Audit Log Features */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">User Login</p>
                          <p className="text-xs text-gray-600">admin@union.ca â€¢ {new Date().toLocaleString()}</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Success</span>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                          <Settings className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Configuration Updated</p>
                          <p className="text-xs text-gray-600">System settings modified</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Success</span>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">New User Added</p>
                          <p className="text-xs text-gray-600">Toronto Central - Member role</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Success</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-gray-900">Admin Role Required</p>
                      </div>
                      <p className="text-sm text-gray-600">All admin endpoints validate role</p>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-gray-900">Organization Isolation</p>
                      </div>
                      <p className="text-sm text-gray-600">Data filtered by organization</p>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-gray-900">Audit Logging</p>
                      </div>
                      <p className="text-sm text-gray-600">All actions tracked with correlation IDs</p>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-gray-900">Soft Deletes</p>
                      </div>
                      <p className="text-sm text-gray-600">Data marked deleted, not removed</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Schemas</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <Database className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>audit_logs</strong> - Comprehensive activity tracking with old/new values
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Database className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>security_events</strong> - Security-specific events with risk scores
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Database className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>failed_login_attempts</strong> - Brute force detection and monitoring
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Database className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div>
                          <strong>rate_limit_events</strong> - API rate limiting tracking
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Reports Section */}
        {activeSection === "reports" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                System Reports & Analytics
              </h2>

              {/* Report Categories */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button className="p-6 border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all text-left bg-linear-to-br from-blue-50 to-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Member Reports</h3>
                  </div>
                  <p className="text-sm text-gray-600">Track membership statistics, demographics, and engagement</p>
                </button>

                <button className="p-6 border-2 border-green-200 rounded-lg hover:border-green-400 transition-all text-left bg-linear-to-br from-green-50 to-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Activity Reports</h3>
                  </div>
                  <p className="text-sm text-gray-600">User activity, system usage, and peak time analysis</p>
                </button>

                <button className="p-6 border-2 border-purple-200 rounded-lg hover:border-purple-400 transition-all text-left bg-linear-to-br from-purple-50 to-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Compliance Reports</h3>
                  </div>
                  <p className="text-sm text-gray-600">Audit trails, security events, and data access logs</p>
                </button>
              </div>

              {/* Available Reports */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Active Users by Organization</p>
                        <p className="text-sm text-gray-600">Last 30 days activity by organization</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium">
                      <Download className="w-4 h-4" />
                      Generate
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">Storage Usage Trend</p>
                        <p className="text-sm text-gray-600">12-month storage growth analysis</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium">
                      <Download className="w-4 h-4" />
                      Generate
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">User Role Distribution</p>
                        <p className="text-sm text-gray-600">Breakdown of admins, stewards, officers, and members</p>
                      </div>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium">
                      <Download className="w-4 h-4" />
                      Generate
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Features */}
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Builder Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Visual Query Builder</p>
                      <p className="text-sm text-gray-600">Drag-and-drop interface for report creation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Multiple Export Formats</p>
                      <p className="text-sm text-gray-600">CSV, PDF, and Excel output support</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Scheduled Reports</p>
                      <p className="text-sm text-gray-600">Automatic generation and email delivery</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Custom Filters</p>
                      <p className="text-sm text-gray-600">Filter by date range, organization, role, and more</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Documentation */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report API Endpoints</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 font-mono text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium text-xs">GET</span>
                      <code>/api/reports</code>
                      <span className="text-gray-600">- List all reports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium text-xs">POST</span>
                      <code>/api/reports</code>
                      <span className="text-gray-600">- Create new report</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium text-xs">POST</span>
                      <code>/api/reports/execute</code>
                      <span className="text-gray-600">- Execute report</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium text-xs">GET</span>
                      <code>/api/reports/templates</code>
                      <span className="text-gray-600">- Get report templates</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Database Section */}
        {activeSection === "database" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6 bg-white/80 backdrop-blur-sm border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Database Management
              </h2>

              {/* Database Health */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Database className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Database Size</p>
                      <p className="text-xl font-bold text-gray-900">
                        {systemStats ? `${systemStats.totalStorage.toFixed(1)} GB` : "..."}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Azure PostgreSQL Flexible</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Connections</p>
                      <p className="text-xl font-bold text-blue-600">12 / 100</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Active / Max</p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Query Performance</p>
                      <p className="text-xl font-bold text-purple-600">Fast</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Avg response: 45ms</p>
                </div>
              </div>

              {/* Database Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Optimization</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Run ANALYZE to update query planner statistics and improve performance
                  </p>
                  <button 
                    onClick={handleOptimizeDatabase}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Optimize Database
                  </button>
                </div>

                <div className="p-6 border border-gray-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Health Check</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Get detailed database metrics including connection stats and table sizes
                  </p>
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/admin/database/health");
                        const data = await response.json();
                        if (data.success) {
                          toast.success("Database health check complete");
}
                      } catch (_error) {
                        toast.error("Failed to fetch database health");
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                  >
                    <Activity className="w-4 h-4" />
                    Run Health Check
                  </button>
                </div>
              </div>

              {/* Database Schema */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Schema Organization</h3>
                <div className="space-y-3">
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">public schema</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Core application tables</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">organizations</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">organization_users</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">organization_configurations</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">organization_usage</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">claims</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">notifications</span>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-gray-900">audit_security schema</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Audit logs and security events</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">audit_logs</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">security_events</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">failed_login_attempts</span>
                      <span className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono">rate_limit_events</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Backup Info */}
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup & Recovery</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Automated Daily Backups</p>
                      <p className="text-gray-600">Azure PostgreSQL provides automatic full backups</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Point-in-Time Recovery</p>
                      <p className="text-gray-600">Restore to any point within 7-35 day retention window</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Geo-Redundant Storage</p>
                      <p className="text-gray-600">Backups replicated to paired Azure region</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Tips */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Optimization Tips</h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">â€¢</span>
                      <span>Run ANALYZE after bulk data changes to update statistics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">â€¢</span>
                      <span>Add indexes on frequently filtered columns (status, createdAt, organizationId)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">â€¢</span>
                      <span>Use query limits and pagination for large result sets</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">â€¢</span>
                      <span>Monitor connection pool usage - alert if approaching max connections</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">â€¢</span>
                      <span>Schedule database optimization during off-peak hours</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Help Section */}
        <Card className="mt-8 p-6 bg-orange-50/80 backdrop-blur-sm border-orange-200">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Admin Guidelines
              </h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>
                  â€¢ <strong>User Management:</strong> Add, edit, or deactivate
                  user accounts and assign roles
                </li>
                <li>
                  â€¢ <strong>Local Sections:</strong> Manage local section
                  details, membership, and leadership
                </li>
                <li>
                  â€¢ <strong>System Settings:</strong> Configure global system
                  preferences and features
                </li>
                <li>
                  â€¢ <strong>Security:</strong> Monitor access logs and manage
                  permissions
                </li>
                <li>
                  â€¢ <strong>Reports:</strong> Generate and export system-wide
                  analytics
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
