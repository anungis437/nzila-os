"use client";

/**
 * Federation / Provincial Dashboard
 *
 * Dashboard for provincial federation roles (fed_executive, fed_staff).
 * Shows regional metrics: affiliated locals, provincial remittances,
 * regional compliance, CBA activity, and provincial campaign tracking.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useUser } from '@nzila/platform-auth/entra/client';
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  Users,
  DollarSign,
  BarChart3,
  Scale,
  FileBarChart,
  TrendingUp,
  ArrowRight,
  MapPin,
  Landmark,
  AlertCircle,
  Calendar,
  Handshake,
  Library,
  ClipboardCheck,
} from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";

// ── Types ────────────────────────────────────────────────────────────────────
interface FedStats {
  totalLocals: number;
  totalMembers: number;
  remittancesCollected: number;
  remittancesOutstanding: number;
  activeCBAs: number;
  complianceRate: number;
}

// ── Component ────────────────────────────────────────────────────────────────

interface FederationDashboardProps {
  isPlatformViewer?: boolean;
}

export default function FederationDashboard({ isPlatformViewer = false }: FederationDashboardProps) {
  const t = useTranslations("federationDashboard");
  const { user } = useUser();
  const { organization, organizationId } = useOrganization();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [childOrgs, setChildOrgs] = useState<{ id: string; name: string; memberCount: number }[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
     
  }, []);

  // Fetch actual child organizations (affiliated locals/unions) — only for federation-type orgs
  useEffect(() => {
    if (!organizationId || (organization && organization.type !== 'federation')) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/children`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setChildOrgs(json.data ?? []);
        }
      } catch {
        // API unavailable — keep empty
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, organization]);

  const totalLocalMembers = childOrgs.reduce((sum, o) => sum + (o.memberCount ?? 0), 0);

  const stats: FedStats = {
    totalLocals: childOrgs.length,
    totalMembers: totalLocalMembers,
    remittancesCollected: 0,
    remittancesOutstanding: 0,
    activeCBAs: 0,
    complianceRate: 0,
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 18) return t("greetings.afternoon");
    return t("greetings.evening");
  };

  const provinceName = organization?.jurisdiction || t("defaultProvince");

  const kpis = [
    { title: t("kpis.locals.title"), value: stats.totalLocals, icon: <Building2 size={20} />, color: "text-blue-600 bg-blue-100", change: t("kpis.locals.change") },
    { title: t("kpis.members.title"), value: stats.totalMembers.toLocaleString(), icon: <Users size={20} />, color: "text-green-600 bg-green-100", change: t("kpis.members.change") },
    { title: t("kpis.collected.title"), value: `$${stats.remittancesCollected.toLocaleString()}`, icon: <DollarSign size={20} />, color: "text-emerald-600 bg-emerald-100", change: t("kpis.collected.change") },
    { title: t("kpis.outstanding.title"), value: `$${stats.remittancesOutstanding.toLocaleString()}`, icon: <DollarSign size={20} />, color: "text-amber-600 bg-amber-100", change: t("kpis.outstanding.change") },
    { title: t("kpis.cbas.title"), value: stats.activeCBAs, icon: <Handshake size={20} />, color: "text-purple-600 bg-purple-100", change: t("kpis.cbas.change") },
    { title: t("kpis.compliance.title"), value: `${stats.complianceRate}%`, icon: <ClipboardCheck size={20} />, color: "text-indigo-600 bg-indigo-100", change: t("kpis.compliance.change") },
  ];

  const quickActions = [
    { title: t("actions.dashboard.title"), description: t("actions.dashboard.description"), href: `/${locale}/dashboard/federation`, icon: <Landmark size={24} />, color: "from-blue-500 to-blue-600" },
    { title: t("actions.unions.title"), description: t("actions.unions.description"), href: `/${locale}/dashboard/federation/affiliates`, icon: <Building2 size={24} />, color: "from-cyan-500 to-cyan-600" },
    { title: t("actions.remittances.title"), description: t("actions.remittances.description"), href: `/${locale}/dashboard/remittances`, icon: <DollarSign size={24} />, color: "from-emerald-500 to-emerald-600" },
    { title: t("actions.analytics.title"), description: t("actions.analytics.description"), href: `/${locale}/dashboard/analytics`, icon: <BarChart3 size={24} />, color: "from-indigo-500 to-indigo-600" },
    { title: t("actions.precedents.title"), description: t("actions.precedents.description"), href: `/${locale}/dashboard/precedents`, icon: <Scale size={24} />, color: "from-amber-500 to-amber-600" },
    { title: t("actions.clauses.title"), description: t("actions.clauses.description"), href: `/${locale}/dashboard/clause-library`, icon: <Library size={24} />, color: "from-teal-500 to-teal-600" },
    { title: t("actions.calendar.title"), description: t("actions.calendar.description"), href: `/${locale}/dashboard/calendar`, icon: <Calendar size={24} />, color: "from-violet-500 to-violet-600" },
    { title: t("actions.reports.title"), description: t("actions.reports.description"), href: `/${locale}/dashboard/reports`, icon: <FileBarChart size={24} />, color: "from-red-500 to-red-600" },
  ];

  if (!mounted || !user) {
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
          {getGreeting()}, {user?.firstName || t("fallbackName")}
        </h1>
        <p className="text-gray-600 text-lg">
          <MapPin size={16} className="inline mr-1" />
          {provinceName} &mdash; {t("subtitle")}
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

      {/* Quick Actions — hidden for platform admins */}
      {!isPlatformViewer && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("sectionTitle")}</h2>
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
                      {t("open")} <ArrowRight size={16} className="ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
      )}

      {/* Regional Overview + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-green-600" />
                {t("overview.title")}
              </CardTitle>
              <CardDescription>{t("overview.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: t("overview.rows.membershipGrowth"), value: "—", trend: "neutral" },
                  { label: t("overview.rows.avgResolution"), value: "—", trend: "neutral" },
                  { label: t("overview.rows.cbaRenewals"), value: "—", trend: "neutral" },
                  { label: t("overview.rows.compliance"), value: "—", trend: "neutral" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Regional Alerts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle size={20} className="text-orange-600" />
                {t("alerts.title")}
              </CardTitle>
              <CardDescription>{t("alerts.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="inline-flex p-3 rounded-full bg-green-100 mb-3">
                  <MapPin size={24} className="text-green-600" />
                </div>
                <p className="text-gray-600">{t("alerts.noUrgent")}</p>
                <p className="text-sm text-gray-500 mt-1">{t("alerts.willAppear")}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
