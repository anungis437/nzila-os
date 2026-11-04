/**
 * Health & Safety - Training Page
 *
 * What the application knows about safety training: how many training records an organization holds and how many of them expire within
 * 30 days, from GET /api/health-safety/stats. No route lists, writes or exports training records, so the page offers no search, filter,
 * export or list, and it has no figure for certified members or overdue training. A figure the route could not give is a dash, not zero.
 *
 * @page app/[locale]/dashboard/health-safety/training/page.tsx
 */

"use client";

export const dynamic = 'force-dynamic';
import { motion } from "framer-motion";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ArrowLeft,
  GraduationCap,
  Clock,
  BookOpen,
} from "lucide-react";
import { useStats } from "@/components/health-safety/use-stats";
import { StatsLoadFailed } from "@/components/health-safety/stats-load-failed";
import { countOrNull, requiredCount } from "@/lib/client/row-fields";

interface TrainingStats {
  recordsHeld: number;
  /** Records that expire within 30 days; null while the organization holds no record, when nothing has been measured. */
  dueSoon: number | null;
}

function toTrainingStats(data: Record<string, unknown>): TrainingStats {
  return { recordsHeld: requiredCount(data, "trainingRecordsHeld"), dueSoon: countOrNull(data, "trainingDue") };
}

const COPY = {
  en: {
    description: "Training records on file and those that expire within 30 days",
    empty: "No safety training records are on file for this organization.",
    onFile: (count: number) => `${count} training record${count === 1 ? " is" : "s are"} on file. This release has no screen that lists them.`,
  },
  fr: {
    description: "Dossiers de formation enregistrés et ceux qui expirent dans les 30 jours",
    empty: "Aucun dossier de formation en sécurité n’est enregistré pour cette organisation.",
    onFile: (count: number) => `${count} dossier${count === 1 ? "" : "s"} de formation ${count === 1 ? "est enregistré" : "sont enregistrés"}. Cette version n’a aucun écran qui les affiche.`,
  },
} as const;

export default function TrainingPage() {
  const t = useTranslations("healthSafetyTrainingPage");
  const copy = useLocale().toLowerCase().startsWith("fr") ? COPY.fr : COPY.en;
  const organizationId = useOrganizationId();

  const { outcome, reload } = useStats("/api/health-safety/stats", toTrainingStats, organizationId ?? "", Boolean(organizationId));
  const stats = outcome?.kind === "ready" ? outcome.stats : null;
  // Loading is "…"; a figure that could not be read, or that the route could not give, is "—": neither is a count of zero.
  const figure = (value: number | null | undefined) => (outcome === null ? "…" : value === null || value === undefined ? "—" : value);

  if (!organizationId) {
    return (
      <div className="p-8 text-center">
        <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">{t("states.noOrganizationSelectedTitle")}</h2>
        <p className="text-muted-foreground">
          {t("states.noOrganizationSelectedDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/dashboard/health-safety"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("header.back")}
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-purple-600" />
              {t("header.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {copy.description}
            </p>
          </div>
        </motion.div>

        {outcome?.kind === "error" && <StatsLoadFailed message={outcome.message} onRetry={reload} />}

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("stats.totalRecords.title")}</CardTitle>
              <BookOpen className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{figure(stats?.recordsHeld)}</div>
              <p className="text-xs text-muted-foreground">{t("stats.totalRecords.description")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("stats.expiringSoon.title")}</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{figure(stats?.dueSoon)}</div>
              <p className="text-xs text-muted-foreground">{t("stats.expiringSoon.description")}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Records */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("records.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats === null ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  {outcome === null ? "…" : "—"}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {stats.recordsHeld === 0 ? copy.empty : copy.onFile(stats.recordsHeld)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
