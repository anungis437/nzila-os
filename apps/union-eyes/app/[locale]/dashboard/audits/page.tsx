export const dynamic = 'force-dynamic';

import { Metadata } from "next";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, CheckCircle, AlertCircle } from "lucide-react";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auditsPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AuditsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auditsPage" });
  const _user = await requireUser();
  
  // Require at least officer level (60) to view audits
  const hasAccess = await hasMinRole("officer");
  
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Fetch audit data from API
  let audits: { id: string; title: string; type: string; status: string; dateCompleted?: string; dateScheduled?: string; auditor: string; findings: number; hasReport: boolean; }[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const res = await fetch(`${baseUrl}/api/v2/audits`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      audits = Array.isArray(json) ? json : json?.audits ?? json?.data ?? [];
    }
  } catch {
    // API not available — empty state
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "in-progress": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "scheduled": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Financial": return "bg-green-500/10 text-green-700 border-green-500/20";
      case "Internal": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "Compliance": return "bg-purple-500/10 text-purple-700 border-purple-500/20";
      case "Membership": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("statuses.completed");
      case "in-progress":
        return t("statuses.inProgress");
      case "scheduled":
        return t("statuses.scheduled");
      default:
        return t("statuses.unknown");
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "Financial":
        return t("types.financial");
      case "Internal":
        return t("types.internal");
      case "Compliance":
        return t("types.compliance");
      case "Membership":
        return t("types.membership");
      default:
        return t("types.other");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")}
          </p>
        </div>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          {t("scheduleAudit")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.totalAudits")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audits.length}</div>
            <p className="text-xs text-muted-foreground">{t("summary.thisYear")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.completed")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "completed").length}
            </div>
            <p className="text-xs text-green-500">{t("summary.allClear")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.inProgress")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "in-progress").length}
            </div>
            <p className="text-xs text-muted-foreground">{t("summary.activeReviews")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.scheduled")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audits.filter(a => a.status === "scheduled").length}
            </div>
            <p className="text-xs text-muted-foreground">{t("summary.upcoming")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Audits List */}
      <div className="grid gap-4">
        {audits.map((audit) => (
          <Card key={audit.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{audit.title}</CardTitle>
                    <Badge variant="outline" className={getTypeColor(audit.type)}>
                      {getTypeLabel(audit.type)}
                    </Badge>
                  </div>
                  <CardDescription>
                    {t("auditor", { auditor: audit.auditor })}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={getStatusColor(audit.status)}>
                  {getStatusLabel(audit.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {audit.dateCompleted && t("completedDate", { value: new Date(audit.dateCompleted).toLocaleDateString() })}
                    {audit.dateScheduled && t("scheduledDate", { value: new Date(audit.dateScheduled).toLocaleDateString() })}
                  </div>
                  {audit.findings > 0 && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      {t("findings", { count: audit.findings })}
                    </div>
                  )}
                </div>
                {audit.hasReport && (
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    {t("downloadReport")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
