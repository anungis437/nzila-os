"use client";

/**
 * OutcomesConsole — reflective surface showing results and accomplishments.
 *
 * Leads with a summary of recent closures and resolution metrics,
 * then links to detailed pages (voting, dues, pension, financial).
 */

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  Vote,
  Receipt,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Activity,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OutcomeLink {
  href: string;
  icon: React.ReactNode;
  titleKey: string;
  description: string;
}

export function OutcomesConsole() {
  const t = useTranslations();
  const tOut = useTranslations("outcomesConsole");
  const locale = useLocale();

  const outcomes: OutcomeLink[] = [
    {
      href: `/${locale}/dashboard/voting`,
      icon: <Vote size={20} className="text-purple-600" />,
      titleKey: "navigation.vote",
      description: tOut("links.votingDescription"),
    },
    {
      href: `/${locale}/dashboard/financial`,
      icon: <Receipt size={20} className="text-gray-600" />,
      titleKey: "sidebar.financialManagement",
      description: tOut("links.financialDescription"),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.outcomes")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tOut("subtitle")}
        </p>
      </div>

      {/* Primary content: summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              {tOut("summary.recentClosures")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">{tOut("summary.recentClosuresDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              {tOut("summary.resolutionRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">{tOut("summary.resolutionRateDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              {tOut("summary.avgTimeToClose")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">{tOut("summary.avgTimeToCloseDescription")}</p>
          </CardContent>
        </Card>
      </div>

      {/* System Effectiveness — trust signal block */}
      <Card className="border-l-4 border-l-green-600">
        <CardContent className="py-5 px-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} className="text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">{tOut("effectiveness.title")}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Activity size={14} className="text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900">—</p>
                <p className="text-xs text-gray-500">{tOut("effectiveness.recommendationSuccess")}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{tOut("effectiveness.recommendationSuccessHint")}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <TrendingUp size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900">—</p>
                <p className="text-xs text-gray-500">{tOut("effectiveness.actionTaken")}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{tOut("effectiveness.actionTakenHint")}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MessageCircle size={14} className="text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-lg font-bold text-gray-900">—</p>
                <p className="text-xs text-gray-500">{tOut("effectiveness.feedbackCoverage")}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{tOut("effectiveness.feedbackCoverageHint")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary: outcome detail navigations */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-3">{tOut("exploreManage")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {outcomes.map((item) => (
            <Link key={item.href} href={item.href} className="block group">
              <Card className="h-full transition-all hover:shadow-md hover:border-blue-200 group-hover:bg-gray-50/50">
                <CardContent className="py-4 px-4 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm text-gray-900">
                        {t(item.titleKey)}
                      </span>
                      <ArrowRight size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
