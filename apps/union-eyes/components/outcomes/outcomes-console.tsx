"use client";

/**
 * OutcomesConsole — reflective surface showing results and accomplishments.
 *
 * Links to existing detailed pages (voting, dues, pension, financial)
 * rather than duplicating their content.
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
          Results and accomplishments — voting, finances, and benefits at a glance.
        </p>
      </div>

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
  );
}
