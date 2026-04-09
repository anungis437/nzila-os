"use client";

/**
 * KnowledgeConsole — search-first reference surface.
 *
 * Provides quick links to agreements, education, clause library,
 * precedents, and calendar with a unified search prompt.
 */

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Library,
  Scale,
  Calendar,
  Search,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KnowledgeLink {
  href: string;
  icon: React.ReactNode;
  titleKey: string;
  description: string;
}

export function KnowledgeConsole() {
  const t = useTranslations();
  const locale = useLocale();

  const sections: KnowledgeLink[] = [
    {
      href: `/${locale}/dashboard/agreements`,
      icon: <BookOpen size={20} className="text-blue-600" />,
      titleKey: "sidebar.ourAgreements",
      description: "Collective agreements, MOUs, and policy documents.",
    },
    {
      href: `/${locale}/dashboard/education`,
      icon: <GraduationCap size={20} className="text-green-600" />,
      titleKey: "sidebar.educationTraining",
      description: "Training courses, steward guides, and learning resources.",
    },
    {
      href: `/${locale}/dashboard/clause-library`,
      icon: <Library size={20} className="text-purple-600" />,
      titleKey: "sidebar.clauseLibrary",
      description: "Searchable library of contract clauses and language.",
    },
    {
      href: `/${locale}/dashboard/precedents`,
      icon: <Scale size={20} className="text-amber-600" />,
      titleKey: "sidebar.precedents",
      description: "Arbitration decisions and grievance precedents.",
    },
    {
      href: `/${locale}/dashboard/calendar`,
      icon: <Calendar size={20} className="text-gray-600" />,
      titleKey: "calendar.title",
      description: "Upcoming meetings, deadlines, and key dates.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sidebar.knowledge")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reference materials, learning resources, and agreements — find what you need.
        </p>
      </div>

      {/* Search prompt */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border bg-gray-50/50">
        <Search size={16} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-400">
          Search agreements, clauses, precedents, and training…
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((item) => (
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
