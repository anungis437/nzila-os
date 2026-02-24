"use client";

/**
 * Union / Local Dashboard
 *
 * The original dashboard for union and local-level users.
 * Shows claims, grievances, deadlines, case workbench, member directory,
 * voting, analytics, and role-filtered quick actions.
 *
 * Preserved as-is from the previous page.tsx implementation.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { 
  FileText, 
  Mic, 
  Vote, 
  // BookOpen, 
  Shield, 
  Users, 
  BarChart3, 
  Scale, 
  Bell, 
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { DeadlineWidget } from "@/components/deadlines";
import { useRouter } from "next/navigation";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { SeedDataButton } from "@/components/dev/seed-data-button";
import { UserRole as RBACRole } from "@/lib/auth/roles";

type UserRole = "member" | "steward" | "officer" | "admin";

interface DashboardStats {
  activeClaims: number;
  pendingReviews: number;
  resolvedCases: number;
  highPriorityClaims: number;
  activeMembers?: number;
}

interface DeadlineSummary {
  activeDeadlines: number;
  overdueCount: number;
  dueSoonCount: number;
  criticalCount: number;
  avgDaysOverdue: number;
  onTimePercentage: number;
}

interface CriticalDeadline {
  id: string;
  deadlineName: string;
  claimNumber?: string;
  currentDeadline: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  daysOverdue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  roles: UserRole[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getQuickLinks = (t: any): QuickLink[] => [
  {
    title: t('claims.submitNew'),
    description: t('dashboard.voiceEnabled'),
    href: "/dashboard/claims/new",
    icon: <Mic size={24} />,
    color: "from-blue-500 to-blue-600",
    roles: ["member", "steward", "officer", "admin"]
  },
  {
    title: t('claims.myCases'),
    description: t('dashboard.trackSubmissions'),
    href: "/dashboard/claims",
    icon: <FileText size={24} />,
    color: "from-green-500 to-green-600",
    roles: ["member", "steward", "officer", "admin"]
  },
  {
    title: t('navigation.vote'),
    description: t('dashboard.activeVotes'),
    href: "/dashboard/voting",
    icon: <Vote size={24} />,
    color: "from-purple-500 to-purple-600",
    roles: ["member", "steward", "officer", "admin"]
  },
  {
    title: t('claims.caseQueue'),
    description: t('dashboard.reviewCases'),
    href: "/dashboard/workbench",
    icon: <Shield size={24} />,
    color: "from-orange-500 to-orange-600",
    roles: ["steward", "officer", "admin"]
  },
  {
    title: t('members.directory'),
    description: t('members.contactMembers'),
    href: "/dashboard/members",
    icon: <Users size={24} />,
    color: "from-cyan-500 to-cyan-600",
    roles: ["steward", "officer", "admin"]
  },
  {
    title: t('navigation.analytics'),
    description: t('analytics.unionInsights'),
    href: "/dashboard/analytics",
    icon: <BarChart3 size={24} />,
    color: "from-indigo-500 to-indigo-600",
    roles: ["steward", "officer", "admin"]
  },
  {
    title: t('grievance.title'),
    description: t('grievance.formalProcesses'),
    href: "/dashboard/grievances",
    icon: <Scale size={24} />,
    color: "from-amber-500 to-amber-600",
    roles: ["officer", "admin"]
  },
  {
    title: t('navigation.adminPanel'),
    description: t('dashboard.systemManagement'),
    href: "/dashboard/admin",
    icon: <Shield size={24} />,
    color: "from-red-500 to-red-600",
    roles: ["admin"]
  },
];

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
  roles: UserRole[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getStats = (t: any): StatCard[] => [
  {
    title: t('dashboard.myActiveCases'),
    value: 0,
    change: t('dashboard.thisWeek', { count: 0 }),
    icon: <FileText size={20} />,
    color: "text-blue-600 bg-blue-100",
    roles: ["member", "steward", "officer", "admin"]
  },
  {
    title: t('dashboard.pendingReviews'),
    value: 0,
    change: t('dashboard.inYourQueue'),
    icon: <Clock size={20} />,
    color: "text-orange-600 bg-orange-100",
    roles: ["steward", "officer", "admin"]
  },
  {
    title: t('members.activeMembers'),
    value: 0,
    change: t('members.totalMembers'),
    icon: <Users size={20} />,
    color: "text-green-600 bg-green-100",
    roles: ["steward", "officer", "admin"]
  },
  {
    title: t('analytics.resolutionRate'),
    value: "-",
    change: t('timeDate.last30Days'),
    icon: <TrendingUp size={20} />,
    color: "text-purple-600 bg-purple-100",
    roles: ["officer", "admin"]
  },
];

export default function UnionDashboard() {
  const { user } = useUser();
  const router = useRouter();
  const organizationId = useOrganizationId();
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("member");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    activeClaims: 0,
    pendingReviews: 0,
    resolvedCases: 0,
    highPriorityClaims: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Fetch user role from database
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/auth/user-role');
        if (response.ok) {
          const { role } = await response.json();
          
          // Map RBAC roles to simplified dashboard roles
          let mappedRole: UserRole = "member";
          switch (role) {
            case RBACRole.ADMIN:
            case RBACRole.PRESIDENT:
            case RBACRole.VICE_PRESIDENT:
            case RBACRole.SECRETARY_TREASURER:
              mappedRole = "admin";
              break;
            case RBACRole.OFFICER:
            case RBACRole.CHIEF_STEWARD:
            case RBACRole.NATIONAL_OFFICER:
              mappedRole = "officer";
              break;
            case RBACRole.STEWARD:
            case RBACRole.BARGAINING_COMMITTEE:
            case RBACRole.HEALTH_SAFETY_REP:
              mappedRole = "steward";
              break;
            case RBACRole.MEMBER:
            default:
              mappedRole = "member";
              break;
          }
          
          setUserRole(mappedRole);
        }
      } catch (_error) {
        // Default to member on error
        setUserRole("member");
      }
    };
    
    if (user?.id) {
      fetchUserRole();
    }
  }, [user?.id]);
  
  const [deadlineSummary, setDeadlineSummary] = useState<DeadlineSummary>({
    activeDeadlines: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    criticalCount: 0,
    avgDaysOverdue: 0,
    onTimePercentage: 0,
  });
  const [criticalDeadlines, setCriticalDeadlines] = useState<CriticalDeadline[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDeadlines, setIsLoadingDeadlines] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  
  // Fetch real dashboard statistics
  useEffect(() => {
    if (!organizationId) return;

    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/dashboard/stats?organizationId=${organizationId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardStats(data);
        }
      } catch (_error) {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStats();
  }, [organizationId]);

  // Fetch notifications
  useEffect(() => {
    if (!organizationId) return;

    const fetchNotifications = async () => {
      try {
        setIsLoadingNotifications(true);
        const response = await fetch(`/api/notifications?organizationId=${organizationId}&limit=5`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadNotificationsCount(data.unreadCount || 0);
        }
      } catch (_error) {
        // silently fail
      } finally {
        setIsLoadingNotifications(false);
      }
    };
    
    fetchNotifications();
  }, [organizationId]);

  // Fetch activities
  useEffect(() => {
    if (!organizationId) return;

    const fetchActivities = async () => {
      try {
        setIsLoadingActivities(true);
        const response = await fetch(`/api/activities?organizationId=${organizationId}&limit=5`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (_error) {
        // silently fail
      } finally {
        setIsLoadingActivities(false);
      }
    };
    
    fetchActivities();
  }, [organizationId]);

  // Fetch deadline data
  useEffect(() => {
    if (!organizationId) return;

    const fetchDeadlines = async () => {
      try {
        setIsLoadingDeadlines(true);
        
        const summaryResponse = await fetch(`/api/deadlines/dashboard?organizationId=${organizationId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setDeadlineSummary(summaryData);
        }

        const upcomingResponse = await fetch(`/api/deadlines/upcoming?organizationId=${organizationId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (upcomingResponse.ok) {
          const upcomingData = await upcomingResponse.json();
          setCriticalDeadlines(upcomingData.deadlines || []);
        }
      } catch (_error) {
        // silently fail
      } finally {
        setIsLoadingDeadlines(false);
      }
    };

    fetchDeadlines();
  }, [organizationId]);
  
  // Update stats with real data
  const stats = getStats(t);
  const updatedStats = stats.map(stat => {
    if (stat.title === t('dashboard.myActiveCases')) {
      return { ...stat, value: isLoading ? "..." : dashboardStats.activeClaims, change: t('dashboard.highPriority', { count: dashboardStats.highPriorityClaims }) };
    } else if (stat.title === t('dashboard.pendingReviews')) {
      return { ...stat, value: isLoading ? "..." : dashboardStats.pendingReviews, change: t('dashboard.inYourQueue') };
    } else if (stat.title === t('members.activeMembers')) {
      const memberValue = isLoading ? "..." : (dashboardStats.activeMembers || 0);
      return { ...stat, value: memberValue, change: t('members.totalMembers') };
    } else if (stat.title === t('analytics.resolutionRate')) {
      const total = dashboardStats.activeClaims + dashboardStats.resolvedCases;
      const rate = total > 0 ? Math.round((dashboardStats.resolvedCases / total) * 100) : 0;
      return { ...stat, value: isLoading ? "..." : `${rate}%`, change: t('timeDate.last30Days') };
    }
    return stat;
  });
  
  const quickLinks = getQuickLinks(t);
  const visibleQuickLinks = quickLinks.filter(link => link.roles.includes(userRole));
  const visibleStats = updatedStats.filter(stat => stat.roles.includes(userRole));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('common.goodMorning');
    if (hour < 18) return t('common.goodAfternoon');
    return t('common.goodEvening');
  };

  // SSR Guard
  if (!mounted || !user) {
    return (
      <main className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 p-6 md:p-10">
      {/* Development Helper */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">
            🧪 Development Tools
          </h3>
          <SeedDataButton />
        </div>
      )}

      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {getGreeting()}, {user?.firstName || t('common.member')}
        </h1>
        <p className="text-gray-600 text-lg">
          {t('dashboard.welcomeMessage')}
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {visibleStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
          >
            <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.change}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.quickActions')}</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleQuickLinks.map((link, index) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
            >
              <Link href={link.href}>
                <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className={`inline-flex p-3 rounded-xl bg-linear-to-br ${link.color} text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      {link.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{link.description}</p>
                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      {t('common.go')} <ArrowRight size={16} className="ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Deadline Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <DeadlineWidget
          summary={deadlineSummary}
          criticalDeadlines={criticalDeadlines}
          loading={isLoadingDeadlines}
          onViewAll={() => router.push('/dashboard/deadlines')}
        />
      </motion.div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                {t('dashboard.recentActivity')}
              </CardTitle>
              <CardDescription>{t('dashboard.latestActions')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivities ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">{t('common.loading')}</p>
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="p-3 rounded-lg border bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          activity.color === 'red' ? 'bg-red-100' :
                          activity.color === 'orange' ? 'bg-orange-100' :
                          activity.color === 'green' ? 'bg-green-100' :
                          activity.color === 'purple' ? 'bg-purple-100' :
                          'bg-blue-100'
                        }`}>
                          {activity.icon === 'file' ? (
                            <FileText size={16} className={`${
                              activity.color === 'red' ? 'text-red-600' :
                              activity.color === 'orange' ? 'text-orange-600' :
                              activity.color === 'green' ? 'text-green-600' :
                              activity.color === 'purple' ? 'text-purple-600' :
                              'text-blue-600'
                            }`} />
                          ) : activity.icon === 'clock' ? (
                            <Clock size={16} className={`${
                              activity.color === 'red' ? 'text-red-600' :
                              activity.color === 'orange' ? 'text-orange-600' :
                              activity.color === 'green' ? 'text-green-600' :
                              activity.color === 'purple' ? 'text-purple-600' :
                              'text-blue-600'
                            }`} />
                          ) : (
                            <Users size={16} className={`${
                              activity.color === 'red' ? 'text-red-600' :
                              activity.color === 'orange' ? 'text-orange-600' :
                              activity.color === 'green' ? 'text-green-600' :
                              activity.color === 'purple' ? 'text-purple-600' :
                              'text-blue-600'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{activity.description}</p>
                          {activity.claimNumber && (
                            <Link 
                              href={`/dashboard/claims/${activity.id}`}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {activity.claimNumber}
                            </Link>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(activity.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex p-3 rounded-full bg-gray-100 mb-3">
                    <FileText size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-600">{t('dashboard.noActivity')}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('dashboard.actionsAppearHere')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Important Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} className="text-orange-600" />
                {t('dashboard.importantAlerts')}
                {unreadNotificationsCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                    {unreadNotificationsCount} {t('common.new')}
                  </span>
                )}
              </CardTitle>
              <CardDescription>{t('dashboard.timeSensitive')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingNotifications ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">{t('common.loading')}</p>
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg border ${
                        !notification.read 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          notification.type === 'error' ? 'bg-red-100' :
                          notification.type === 'warning' ? 'bg-orange-100' :
                          notification.type === 'success' ? 'bg-green-100' :
                          'bg-blue-100'
                        }`}>
                          <AlertCircle size={16} className={
                            notification.type === 'error' ? 'text-red-600' :
                            notification.type === 'warning' ? 'text-orange-600' :
                            notification.type === 'success' ? 'text-green-600' :
                            'text-blue-600'
                          } />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900">{notification.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Link 
                    href="/dashboard/notifications" 
                    className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-4"
                  >
                    {t('common.viewAll')} <ArrowRight size={14} className="inline ml-1" />
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex p-3 rounded-full bg-green-100 mb-3">
                    <Bell size={24} className="text-green-600" />
                  </div>
                  <p className="text-gray-600">{t('dashboard.allCaughtUp')}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('dashboard.noUrgentAlerts')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Helpful Resources - For Members */}
      {(userRole === "member" || userRole === "steward") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8"
        >
          <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-600 text-white">
                  <AlertCircle size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">{t('help.needHelp')}</h3>
                  <p className="text-gray-700 mb-4">
                    {t('help.supportMessage')}
                  </p>
                  <div className="flex gap-3">
                    <Link href="/dashboard/claims/new">
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        {t('claims.submitCase')}
                      </button>
                    </Link>
                    <Link href="/dashboard/agreements">
                      <button className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
                        {t('dashboard.viewAgreements')}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </main>
  );
}
