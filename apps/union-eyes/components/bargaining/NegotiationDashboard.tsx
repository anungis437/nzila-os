/**
 * Negotiation Dashboard Component
 * 
 * Displays active negotiations overview for bargaining committee members.
 * Shows status, deadlines, proposals, and team information.
 */

"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Calendar, Users, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Negotiation {
  id: string;
  title: string;
  status: string;
  unionName: string;
  employerName: string;
  firstSessionDate: string | null;
  targetCompletionDate: string | null;
  currentRound: number;
  totalSessions: number;
  createdAt: string;
}

interface NegotiationDashboardProps {
  organizationId: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-gray-500",
  active: "bg-blue-500",
  impasse: "bg-orange-500",
  conciliation: "bg-yellow-500",
  tentative: "bg-purple-500",
  ratified: "bg-green-500",
  rejected: "bg-red-500",
  strike_lockout: "bg-red-700",
  completed: "bg-green-700",
  abandoned: "bg-gray-700",
};

export function NegotiationDashboard({ organizationId }: NegotiationDashboardProps) {
  const locale = useLocale();
  const t = useTranslations("negotiationDashboard");
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNegotiations();
  }, [organizationId]);

  const fetchNegotiations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bargaining/negotiations?limit=50`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch negotiations");
      }
      
      const data = await response.json();
      setNegotiations(data.negotiations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const activeNegotiations = negotiations.filter(n => 
    ["active", "impasse", "conciliation", "tentative"].includes(n.status)
  );

  const upcomingDeadlines = negotiations
    .filter(n => n.targetCompletionDate)
    .sort((a, b) => 
      new Date(a.targetCompletionDate!).getTime() - new Date(b.targetCompletionDate!).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/dashboard/bargaining/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newNegotiation")}
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.total")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{negotiations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.active")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeNegotiations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.completed")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {negotiations.filter(n => n.status === "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.upcomingDeadlines")}</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingDeadlines.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Negotiations List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("activeSection.title")}</CardTitle>
          <CardDescription>
            {t("activeSection.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeNegotiations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("activeSection.empty")}
            </p>
          ) : (
            <div className="space-y-4">
              {activeNegotiations.map((negotiation) => (
                <div
                  key={negotiation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/bargaining/negotiations/${negotiation.id}`}
                        className="font-semibold hover:underline"
                      >
                        {negotiation.title}
                      </Link>
                      <Badge className={statusColors[negotiation.status]}>
                        {t(`statuses.${negotiation.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t("vsLabel", { union: negotiation.unionName, employer: negotiation.employerName })}
                      </span>
                      {negotiation.firstSessionDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("started", { date: format(new Date(negotiation.firstSessionDate), "MMM d, yyyy") })}
                        </span>
                      )}
                      <span>{t("round", { round: negotiation.currentRound, sessions: negotiation.totalSessions })}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/bargaining/negotiations/${negotiation.id}`}>
                      {t("viewDetails")}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Negotiations Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("allSection.title")}</CardTitle>
          <CardDescription>{t("allSection.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {negotiations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{t("allSection.emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t("allSection.emptyBody")}
              </p>
              <Button className="mt-4" asChild>
                <Link href={`/${locale}/dashboard/bargaining/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("createNegotiation")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {negotiations.map((negotiation) => (
                <div
                  key={negotiation.id}
                  className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-accent transition-colors"
                >
                  <div>
                    <Link
                      href={`/dashboard/bargaining/negotiations/${negotiation.id}`}
                      className="font-medium hover:underline"
                    >
                      {negotiation.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {negotiation.unionName} • {negotiation.employerName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[negotiation.status]}>
                      {t(`statuses.${negotiation.status}`)}
                    </Badge>
                    {negotiation.targetCompletionDate && (
                      <span className="text-sm text-muted-foreground">
                        {t("target", { date: format(new Date(negotiation.targetCompletionDate), "MMM d, yyyy") })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
