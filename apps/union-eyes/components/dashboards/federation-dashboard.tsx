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
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
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
export default function FederationDashboard() {
  const { user } = useUser();
  const { organization, userOrganizations } = useOrganization();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
     
  }, []);

  const stats: FedStats = {
    totalLocals: userOrganizations?.length ?? 0,
    totalMembers: 0,
    remittancesCollected: 0,
    remittancesOutstanding: 0,
    activeCBAs: 0,
    complianceRate: 0,
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const provinceName = organization?.jurisdiction || "Provincial Federation";

  const kpis = [
    { title: "Affiliated Locals", value: stats.totalLocals, icon: <Building2 size={20} />, color: "text-blue-600 bg-blue-100", change: "in province" },
    { title: "Total Members", value: stats.totalMembers.toLocaleString(), icon: <Users size={20} />, color: "text-green-600 bg-green-100", change: "provincial members" },
    { title: "Remittances Collected", value: `$${stats.remittancesCollected.toLocaleString()}`, icon: <DollarSign size={20} />, color: "text-emerald-600 bg-emerald-100", change: "current period" },
    { title: "Outstanding", value: `$${stats.remittancesOutstanding.toLocaleString()}`, icon: <DollarSign size={20} />, color: "text-amber-600 bg-amber-100", change: "pending" },
    { title: "Active CBAs", value: stats.activeCBAs, icon: <Handshake size={20} />, color: "text-purple-600 bg-purple-100", change: "active agreements" },
    { title: "Compliance Rate", value: `${stats.complianceRate}%`, icon: <ClipboardCheck size={20} />, color: "text-indigo-600 bg-indigo-100", change: "locals reporting" },
  ];

  const quickActions = [
    { title: "Federation Dashboard", description: "Regional overview", href: "/dashboard/federation", icon: <Landmark size={24} />, color: "from-blue-500 to-blue-600" },
    { title: "Affiliated Unions", description: "Manage local affiliates", href: "/dashboard/federation/affiliates", icon: <Building2 size={24} />, color: "from-cyan-500 to-cyan-600" },
    { title: "Remittance Tracking", description: "Per-capita & dues tracking", href: "/dashboard/remittances", icon: <DollarSign size={24} />, color: "from-emerald-500 to-emerald-600" },
    { title: "Provincial Analytics", description: "Regional trends & metrics", href: "/dashboard/analytics", icon: <BarChart3 size={24} />, color: "from-indigo-500 to-indigo-600" },
    { title: "Precedent Database", description: "Provincial precedents", href: "/dashboard/precedents", icon: <Scale size={24} />, color: "from-amber-500 to-amber-600" },
    { title: "Shared Clause Library", description: "Model contract language", href: "/dashboard/clause-library", icon: <Library size={24} />, color: "from-teal-500 to-teal-600" },
    { title: "CBA Calendar", description: "Renewal & expiry dates", href: "/dashboard/calendar", icon: <Calendar size={24} />, color: "from-violet-500 to-violet-600" },
    { title: "Provincial Reports", description: "Compliance & filing reports", href: "/dashboard/reports", icon: <FileBarChart size={24} />, color: "from-red-500 to-red-600" },
  ];

  if (!mounted || !user) {
    return (
      <main className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-gray-200 rounded-lg" />)}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 p-6 md:p-10">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {getGreeting()}, {user?.firstName || "Staff"}
        </h1>
        <p className="text-gray-600 text-lg">
          <MapPin size={16} className="inline mr-1" />
          {provinceName} &mdash; Federation Operations
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Federation Operations</h2>
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
                      Open <ArrowRight size={16} className="ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Regional Overview + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-green-600" />
                Regional Overview
              </CardTitle>
              <CardDescription>Provincial aggregate trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Membership Growth", value: "—", trend: "neutral" },
                  { label: "Avg. Grievance Resolution", value: "—", trend: "neutral" },
                  { label: "Upcoming CBA Renewals", value: "—", trend: "neutral" },
                  { label: "Provincial Compliance", value: "—", trend: "neutral" },
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
                Provincial Alerts
              </CardTitle>
              <CardDescription>Items requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="inline-flex p-3 rounded-full bg-green-100 mb-3">
                  <MapPin size={24} className="text-green-600" />
                </div>
                <p className="text-gray-600">No urgent items</p>
                <p className="text-sm text-gray-500 mt-1">Provincial alerts will appear here</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
