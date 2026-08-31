/**
 * Health & Safety - New Incident Report Page
 * 
 * Dedicated page for reporting new workplace safety incidents
 * with comprehensive incident report form
 * 
 * @page app/[locale]/dashboard/health-safety/incidents/new/page.tsx
 */

"use client";


export const dynamic = 'force-dynamic';
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileWarning, ArrowLeft, AlertCircle } from "lucide-react";
import { IncidentReportForm } from "@/components/health-safety";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

export default function NewIncidentPage() {
  const t = useTranslations("newIncidentPage");
  const router = useRouter();
  const organizationId = useOrganizationId();

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/health-safety/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, organizationId }),
      });

      if (!res.ok) {
        throw new Error(t("errors.submitFailed"));
      }
      
      toast.success(t("toast.success.title"), {
        description: t("toast.success.description"),
      });
      
      // Redirect to incidents list
      router.push("/dashboard/health-safety/incidents");
    } catch (error) {
      logger.error("Failed to submit incident report:", error);
      toast.error(t("toast.error.title"), {
        description: t("toast.error.description"),
      });
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/health-safety/incidents");
  };

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">{t("noOrg.title")}</h2>
            <p className="text-muted-foreground mb-4">
              {t("noOrg.description")}
            </p>
            <Link href="/dashboard/health-safety">
              <Button>{t("noOrg.returnButton")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/dashboard/health-safety/incidents">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              {t("backToIncidents")}
            </Button>
          </Link>

          <div className="flex items-start gap-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
              <FileWarning className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    {t("notice.title")}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-200">
                    <li>{t("notice.items.emergency")}</li>
                    <li>{t("notice.items.window")}</li>
                    <li>{t("notice.items.detail")}</li>
                    <li>{t("notice.items.anonymous")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Incident Report Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("form.title")}</CardTitle>
              <CardDescription>
                {t("form.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentReportForm
                organizationId={organizationId}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
