"use client";

/**
 * Nzila Operations Dashboard
 *
 * Platform-level dashboard for Nzila Ventures staff (app_owner, coo, cto, etc.).
 * Shows platform health, customer metrics, support queue, and revenue KPIs.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
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
  Zap,
  ShieldCheck,
  Globe,
  HeartPulse,
  Clock,
} from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";

// ── Types ────────────────────────────────────────────────────────────────────
interface PlatformStats {
  totalOrganizations: number;
  activeUsers: number;
  openTickets: number;
  mrr: number;
  uptimePercent: number;
  avgResponseTime: number;
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
  const { userOrganizations } = useOrganization();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Derive stats from context (API calls will replace placeholder values)
  const stats: PlatformStats = {
    totalOrganizations: userOrganizations?.length ?? 0,
    activeUsers: 0,
    openTickets: 0,
    mrr: 0,
    uptimePercent: 99.9,
    avgResponseTime: 0,
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const kpis = [
    { title: "Organizations", value: stats.totalOrganizations, icon: <Building2 size={20} />, color: "text-blue-600 bg-blue-100", change: "active on platform" },
    { title: "Monthly Recurring Revenue", value: `$${stats.mrr.toLocaleString()}`, icon: <DollarSign size={20} />, color: "text-green-600 bg-green-100", change: "MRR" },
    { title: "Platform Uptime", value: `${stats.uptimePercent}%`, icon: <HeartPulse size={20} />, color: "text-emerald-600 bg-emerald-100", change: "last 30 days" },
    { title: "Avg Response Time", value: `${stats.avgResponseTime}ms`, icon: <Zap size={20} />, color: "text-amber-600 bg-amber-100", change: "p95 latency" },
    { title: "Open Support Tickets", value: stats.openTickets, icon: <AlertTriangle size={20} />, color: "text-orange-600 bg-orange-100", change: "awaiting response" },
    { title: "Active Users (30d)", value: stats.activeUsers, icon: <Users size={20} />, color: "text-purple-600 bg-purple-100", change: "unique logins" },
  ];

  const quickActions: QuickAction[] = [
    { title: "Operations Center", description: "Platform health & incidents", href: "/dashboard/operations", icon: <Activity size={24} />, color: "from-blue-500 to-blue-600" },
    { title: "Support Queue", description: "Open tickets & escalations", href: "/dashboard/support", icon: <AlertTriangle size={24} />, color: "from-orange-500 to-orange-600" },
    { title: "Customer Success", description: "Onboarding & retention", href: "/dashboard/customer-success", icon: <Users size={24} />, color: "from-cyan-500 to-cyan-600" },
    { title: "Platform Analytics", description: "Usage, growth & engagement", href: "/dashboard/analytics-admin", icon: <BarChart3 size={24} />, color: "from-indigo-500 to-indigo-600" },
    { title: "Billing & Subscriptions", description: "Revenue & plan management", href: "/dashboard/billing-admin", icon: <DollarSign size={24} />, color: "from-green-500 to-green-600" },
    { title: "Browse Organizations", description: "View all client organizations", href: "/dashboard/admin/organizations", icon: <Globe size={24} />, color: "from-violet-500 to-violet-600" },
    { title: "Security & Compliance", description: "Platform security posture", href: "/dashboard/compliance", icon: <ShieldCheck size={24} />, color: "from-red-500 to-red-600" },
    { title: "Sector Analytics", description: "Cross-sector performance data", href: "/dashboard/sector-analytics", icon: <TrendingUp size={24} />, color: "from-teal-500 to-teal-600" },
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
          {getGreeting()}, {user?.firstName || "Operator"}
        </h1>
        <p className="text-gray-600 text-lg">
          Nzila Platform Operations &mdash; here&apos;s your overview.
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Command Center</h2>
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

      {/* Platform Health + Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Health */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <Card className="border-white/50 bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server size={20} className="text-green-600" />
                Platform Health
              </CardTitle>
              <CardDescription>System status and uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Web Application", status: "operational", latency: "142ms" },
                  { name: "PostgreSQL Database", status: "operational", latency: "8ms" },
                  { name: "Redis Cache", status: "operational", latency: "2ms" },
                  { name: "Clerk Auth", status: "operational", latency: "45ms" },
                  { name: "Background Jobs", status: "operational", latency: "—" },
                ].map(svc => (
                  <div key={svc.name} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${svc.status === "operational" ? "bg-green-500" : "bg-yellow-500"}`} />
                      <span className="text-sm font-medium text-gray-900">{svc.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{svc.latency}</span>
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
                Recent Platform Events
              </CardTitle>
              <CardDescription>Latest system activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="inline-flex p-3 rounded-full bg-gray-100 mb-3">
                  <Activity size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-600">No recent events</p>
                <p className="text-sm text-gray-500 mt-1">Platform activity will appear here</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
