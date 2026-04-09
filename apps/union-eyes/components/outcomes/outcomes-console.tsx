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
  DollarSign,
  Briefcase,
  Receipt,
  Gift,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Clock,
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
  const locale = useLocale();

  const outcomes: OutcomeLink[] = [
    {
      href: `/${locale}/dashboard/voting`,
      icon: <Vote size={20} className="text-purple-600" />,
      titleKey: "navigation.vote",
      description: "View active ballots, past results, and your voting record.",
    },
    {
      href: `/${locale}/dashboard/dues`,
      icon: <DollarSign size={20} className="text-green-600" />,
      titleKey: "sidebar.duesDeductions",
      description: "Dues statements, deduction history, and payment status.",
    },
    {
      href: `/${locale}/dashboard/pension`,
      icon: <Briefcase size={20} className="text-blue-600" />,
      titleKey: "sidebar.pensionBenefits",
      description: "Pension contributions, benefit projections, and statements.",
    },
    {
      href: `/${locale}/dashboard/rewards`,
      icon: <Gift size={20} className="text-amber-600" />,
      titleKey: "sidebar.rewards",
      description: "Loyalty rewards, recognition, and member benefits.",
    },
    {
      href: `/${locale}/dashboard/financial`,
      icon: <Receipt size={20} className="text-gray-600" />,
      titleKey: "sidebar.financialManagement",
      description: "Financial reports, budgets, and expense tracking.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.outcomes")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Results and accomplishments — closures, resolutions, and financial health.
        </p>
      </div>

      {/* Primary content: summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-500" />
              Recent Closures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">Cases resolved this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">Favorable outcomes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Avg. Time to Close
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-gray-400 mt-1">Days from intake to closure</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary: detailed navigations */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-3">Detailed Views</h2>
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
