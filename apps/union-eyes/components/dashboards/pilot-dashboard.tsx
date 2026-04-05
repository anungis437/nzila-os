"use client";

/**
 * Pilot Dashboard — simplified union dashboard for pilot deployments.
 *
 * Shows only three things:
 *  1. My Cases  (with count)
 *  2. Create New Case  (primary CTA)
 *  3. Recent Activity feed
 *
 * Designed to eliminate cognitive overload and guide new users toward
 * the highest-value action (creating their first case).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  FileText,
  Plus,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useUser } from '@nzila/platform-auth/entra/client';
import { useEffect, useState } from "react";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import { usePilotTracking } from "@/lib/hooks/use-pilot-tracking";
import PilotFeedbackWidget from "@/components/pilot/pilot-feedback-widget";

interface PilotStats {
  activeClaims: number;
  resolvedCases: number;
}

export default function PilotDashboard() {
  const { user } = useUser();
  const locale = useLocale();
  const t = useTranslations();
  const organizationId = useOrganizationId();
  const { hasCompletedOnboarding } = usePilotMode();
  const { trackCaseViewed } = usePilotTracking();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<PilotStats>({ activeClaims: 0, resolvedCases: 0 });
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  // Fetch stats
  useEffect(() => {
    if (!organizationId) return;
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/dashboard/stats?organizationId=${organizationId}`);
        if (res.ok) {
          const data = await res.json();
          setStats({ activeClaims: data.activeClaims ?? 0, resolvedCases: data.resolvedCases ?? 0 });
        }
      } catch { /* ignore */ } finally { setIsLoading(false); }
    };
    fetchStats();
  }, [organizationId]);

  // Fetch recent activity
  useEffect(() => {
    if (!organizationId) return;
    const fetchActivities = async () => {
      try {
        setIsLoadingActivities(true);
        const res = await fetch(`/api/activities?organizationId=${organizationId}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const rows = data?.data ?? data?.activities ?? [];
          setActivities(Array.isArray(rows) ? rows : []);
        }
      } catch { /* ignore */ } finally { setIsLoadingActivities(false); }
    };
    fetchActivities();
  }, [organizationId]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("common.goodMorning");
    if (hour < 18) return t("common.goodAfternoon");
    return t("common.goodEvening");
  };

  if (!mounted || !user) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <div key={i} className="h-40 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {getGreeting()}, {user?.firstName || t("common.member")}
        </h1>
        <p className="text-gray-600">{t("pilot.dashboard.subtitle")}</p>
      </motion.div>

      {/* Empty state — single focused CTA when no cases exist */}
      {hasCompletedOnboarding && stats.activeClaims === 0 && !isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-green-200 bg-linear-to-br from-green-50 to-emerald-50">
            <CardContent className="p-10 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-green-600 text-white mb-4">
                <Plus size={28} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t("pilot.dashboard.emptyTitle")}
              </h3>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                {t("pilot.dashboard.emptyDescription")}
              </p>
              <Link href={`/${locale}/dashboard/claims/new`}>
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white text-base px-8">
                  <Plus size={18} className="mr-2" />
                  {t("pilot.dashboard.createFirstCase")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Two-card hero: My Cases + Create Case */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
          >
            {/* My Cases card */}
            <Link href={`/${locale}/dashboard/claims`}>
              <Card className="h-full border-blue-200 bg-blue-50/60 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group">
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="inline-flex p-3 rounded-xl bg-blue-600 text-white mb-4">
                      <FileText size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                      {t("claims.myCases")}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">{t("pilot.dashboard.myCasesHint")}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-blue-700">
                      {isLoading ? "…" : stats.activeClaims}
                    </span>
                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      {t("common.viewAll")} <ArrowRight size={16} className="ml-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Create Case CTA */}
            <Link href={`/${locale}/dashboard/claims/new`}>
              <Card className="h-full border-green-200 bg-linear-to-br from-green-50 to-emerald-50 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group">
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="inline-flex p-3 rounded-xl bg-green-600 text-white mb-4">
                      <Plus size={24} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-green-700 transition-colors">
                      {t("pilot.dashboard.createCase")}
                    </h3>
                    <p className="text-sm text-gray-600">{t("pilot.dashboard.createCaseHint")}</p>
                  </div>
                  <div className="flex items-center text-green-600 text-sm font-medium mt-4 group-hover:translate-x-1 transition-transform">
                    {t("pilot.dashboard.startNow")} <ArrowRight size={16} className="ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Quick Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("pilot.dashboard.resolvedLabel")}</p>
                  <p className="text-xl font-bold text-gray-900">{isLoading ? "…" : stats.resolvedCases}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("pilot.dashboard.teamLabel")}</p>
                  <p className="text-xl font-bold text-gray-900">{t("pilot.dashboard.yourTeamReady")}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock size={18} className="text-blue-600" />
              {t("dashboard.recentActivity")}
            </CardTitle>
            <CardDescription>{t("pilot.dashboard.activityHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
              <div className="text-center py-8">
                <p className="text-gray-600">{t("common.loading")}</p>
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded-lg border bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-blue-100">
                        <FileText size={14} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
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
                  <Clock size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-600">{t("pilot.dashboard.noActivityYet")}</p>
                <p className="text-sm text-gray-500 mt-1">{t("pilot.dashboard.activityWillAppear")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Companion message — supportive, not surveillance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-6"
      >
        <Card className="border-indigo-200 bg-linear-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-indigo-600 text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">{t("pilot.dashboard.companionTitle")}</h4>
                <p className="text-sm text-gray-600">{t("pilot.dashboard.companionMessage")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* In-app feedback widget — shown after first case or 3–5 uses */}
      <PilotFeedbackWidget />
    </div>
  );
}
