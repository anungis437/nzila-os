"use client";

/**
 * Nzila Operations Dashboard
 *
 * Platform-level dashboard for Nzila Ventures staff (app_owner, coo, cto, etc.).
 * Shows platform health, customer metrics, support queue, and revenue KPIs.
 * Fetches real data from /api/platform/stats.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Activity,
  Users,
  Building2,
  BarChart3,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Server,
  ShieldCheck,
  Globe,
  Clock,
  FileText,
  Scale,
} from "lucide-react";

interface PlatformData {
  totalOrganizations: number;
  activeOrganizations: number;
  totalMemberCount: number;
  registeredUsers: number;
  activeUsers: number;
  grievances: { total: number; open: number; highPriority: number; resolved: number; inArbitration: number };
  collectiveAgreements: { total: number; active: number; negotiating: number; expired: number };
  settlements: { total: number; totalMonetaryValue: number };
  clcAffiliatedCount: number;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function NzilaOpsDashboard() {
  const { user } = useUser();
  const t = useTranslations('platform');
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [platformData, setPlatformData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetch('/api/platform/stats')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data) setPlatformData(json.data);
        else if (json) setPlatformData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  const d = platformData;

  const kpis = [
    { title: t('organizations'), value: d?.totalOrganizations ?? 0, icon: <Building2 size={20} />, color: "text-blue-600 bg-blue-100", change: t('active', { count: d?.activeOrganizations ?? 0 }) },
    { title: t('totalMembers'), value: (d?.totalMemberCount ?? 0).toLocaleString(), icon: <Users size={20} />, color: "text-purple-600 bg-purple-100", change: t('registeredUsers', { count: d?.registeredUsers ?? 0 }) },
    { title: t('openGrievances'), value: d?.grievances?.open ?? 0, icon: <AlertTriangle size={20} />, color: "text-orange-600 bg-orange-100", change: t('highPriority', { count: d?.grievances?.highPriority ?? 0 }) },
    { title: t('activeCBAs'), value: d?.collectiveAgreements?.active ?? 0, icon: <FileText size={20} />, color: "text-green-600 bg-green-100", change: t('underNegotiation', { count: d?.collectiveAgreements?.negotiating ?? 0 }) },
    { title: t('settlements'), value: d?.settlements?.total ?? 0, icon: <Scale size={20} />, color: "text-emerald-600 bg-emerald-100", change: t('totalValue', { value: (d?.settlements?.totalMonetaryValue ?? 0).toLocaleString() }) },
    { title: t('clcAffiliated'), value: d?.clcAffiliatedCount ?? 0, icon: <Globe size={20} />, color: "text-indigo-600 bg-indigo-100", change: t('affiliatedOrganizations') },
  ];

  const quickActions: QuickAction[] = [
    { title: t('operationsCenter'), description: t('platformHealthIncidents'), href: `/${locale}/dashboard/operations`, icon: <Activity size={24} />, color: "from-blue-500 to-blue-600" },
    { title: t('supportQueue'), description: t('openTicketsEscalations'), href: `/${locale}/dashboard/support`, icon: <AlertTriangle size={24} />, color: "from-orange-500 to-orange-600" },
    { title: t('customerSuccess'), description: t('onboardingRetention'), href: `/${locale}/dashboard/customer-success`, icon: <Users size={24} />, color: "from-cyan-500 to-cyan-600" },
    { title: t('platformAnalytics'), description: t('usageGrowthEngagement'), href: `/${locale}/dashboard/analytics-admin`, icon: <BarChart3 size={24} />, color: "from-indigo-500 to-indigo-600" },
    { title: t('billingSubscriptions'), description: t('revenuePlanManagement'), href: `/${locale}/dashboard/billing-admin`, icon: <DollarSign size={24} />, color: "from-green-500 to-green-600" },
    { title: t('browseOrganizations'), description: t('viewAllClientOrgs'), href: `/${locale}/dashboard/admin/organizations`, icon: <Globe size={24} />, color: "from-violet-500 to-violet-600" },
    { title: t('securityCompliance'), description: t('platformSecurityPosture'), href: `/${locale}/dashboard/compliance`, icon: <ShieldCheck size={24} />, color: "from-red-500 to-red-600" },
    { title: t('sectorAnalytics'), description: t('crossSectorPerformance'), href: `/${locale}/dashboard/sector-analytics`, icon: <TrendingUp size={24} />, color: "from-teal-500 to-teal-600" },
  ];

  if (!mounted || !user || loading) {
    return (
      <div>
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-gray-200 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {getGreeting()}, {user?.firstName || t('operator')}
        </h1>
        <p className="text-gray-600 text-lg">
          {t('operationsOverview')}
        </p>
      </motion.div>

      {/* KPI Strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8"
      >
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}>
            <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${kpi.color}`}>{kpi.icon}</div>
                </div>
                <p className="text-sm text-gray-600 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900 mb-0.5">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('commandCenter')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.div key={action.href} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.2 + i * 0.04 }}>
              <Link href={action.href}>
                <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className={`inline-flex p-3 rounded-xl bg-linear-to-br ${action.color} text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      {action.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition-colors">{action.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      {t('open')} <ArrowRight size={16} className="ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Platform Health + Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Health */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server size={20} className="text-green-600" />
                {t('platformHealth')}
              </CardTitle>
              <CardDescription>{t('systemStatusUptime')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: t('organizations'), value: t('total', { count: d?.totalOrganizations ?? 0 }), status: (d?.totalOrganizations ?? 0) > 0 ? "operational" : "degraded" },
                  { name: t('registeredUsersLabel'), value: t('users', { count: d?.registeredUsers ?? 0 }), status: (d?.registeredUsers ?? 0) > 0 ? "operational" : "degraded" },
                  { name: t('grievancePipeline'), value: t('openOfTotal', { open: d?.grievances?.open ?? 0, total: d?.grievances?.total ?? 0 }), status: "operational" },
                  { name: t('collectiveAgreements'), value: t('active', { count: d?.collectiveAgreements?.active ?? 0 }), status: "operational" },
                  { name: t('database'), value: platformData ? t('connected') : t('unavailable'), status: platformData ? "operational" : "degraded" },
                ].map(svc => (
                  <div key={svc.name} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${svc.status === "operational" ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-sm font-medium text-gray-900">{svc.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{svc.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Events */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                {t('recentPlatformEvents')}
              </CardTitle>
              <CardDescription>{t('latestSystemActivity')}</CardDescription>
            </CardHeader>
            <CardContent>
              {d?.grievances?.total ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <span className="text-sm font-medium">{t('totalGrievances')}</span>
                    <span className="text-sm font-bold">{d.grievances.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <span className="text-sm font-medium">{t('resolved')}</span>
                    <span className="text-sm font-bold text-green-600">{d.grievances.resolved}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <span className="text-sm font-medium">{t('inArbitration')}</span>
                    <span className="text-sm font-bold text-orange-600">{d.grievances.inArbitration}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <span className="text-sm font-medium">{t('cbasUnderNegotiation')}</span>
                    <span className="text-sm font-bold text-blue-600">{d.collectiveAgreements?.negotiating ?? 0}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex p-3 rounded-full bg-gray-100 mb-3">
                    <Activity size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-600">{t('noDataAvailable')}</p>
                  <p className="text-sm text-gray-500 mt-1">{t('platformActivityAppears')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
