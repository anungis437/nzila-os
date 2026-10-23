"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import StrategicPlanningBoard, { type StrategicGoalRecord } from "./StrategicPlanningBoard";

interface ExecutiveDashboardProps {
  organizationId: string;
  userRole: string;
}

interface ExecutiveIndicators {
  totalMembers: number;
  activeGrievances: number;
  grievanceResolutionRate: number;
  atRiskStrategicGoals: number;
  grievanceMeetingsNext30Days: number;
  duesRemittances: { expectedAmount: number; receivedAmount: number; currency: string };
  provenance?: { generatedAt?: string };
}

type LoadState =
  | { status: "loading" }
  | { status: "unavailable"; httpStatus?: number }
  | { status: "ready"; metrics: ExecutiveIndicators; goals: StrategicGoalRecord[] };

const money = (n: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

/**
 * Aggregate executive indicators. Values come from /api/executive/dashboard
 * (organization-scoped, aggregate only). When the source cannot be read, the
 * indicators are reported as not available — never as zero. Labels name what
 * each figure actually measures; none of them is an approval queue, a governance
 * meeting count or a budget.
 */
export default function ExecutiveDashboard({ userRole }: ExecutiveDashboardProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/executive/dashboard");
      if (!res.ok) {
        setState({ status: "unavailable", httpStatus: res.status });
        return;
      }
      const body = await res.json();
      const data = body?.data;
      if (!data?.metrics) {
        setState({ status: "unavailable" });
        return;
      }
      setState({ status: "ready", metrics: data.metrics, goals: Array.isArray(data.strategicGoals) ? data.strategicGoals : [] });
    } catch {
      setState({ status: "unavailable" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state.status === "loading") {
    return <div className="flex items-center justify-center py-12" role="status" aria-label="Loading executive indicators"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (state.status === "unavailable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executive indicators</CardTitle>
          <CardDescription>
            Not available{state.httpStatus === 403 ? " for your office" : ""}. Figures are not shown rather than shown as zero.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { metrics, goals } = state;
  const cards: Array<{ title: string; value: string; description: string }> = [
    { title: "Active members", value: metrics.totalMembers.toLocaleString(), description: "Members not marked inactive, archived, deleted or disabled" },
    { title: "Open grievances", value: metrics.activeGrievances.toLocaleString(), description: "Aggregate count; case details are not shown here" },
    { title: "Grievance resolution rate", value: `${metrics.grievanceResolutionRate}%`, description: "Resolved share of grievances filed in the current window" },
    { title: "At-risk strategic goals", value: metrics.atRiskStrategicGoals.toLocaleString(), description: "Goals marked at-risk or delayed. This is not an approval queue" },
    { title: "Grievance meetings, next 30 days", value: metrics.grievanceMeetingsNext30Days.toLocaleString(), description: "Case meetings only; governance meetings are not counted" },
    {
      title: "Dues remittances this month",
      value: `${money(metrics.duesRemittances.receivedAmount, metrics.duesRemittances.currency)} of ${money(metrics.duesRemittances.expectedAmount, metrics.duesRemittances.currency)} expected`,
      description: "Employer remittances received. This is not a budget or expenditure",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Executive indicators</h2>
          <p className="text-muted-foreground mt-1">
            Organization-scoped aggregates{metrics.provenance?.generatedAt ? `, generated ${metrics.provenance.generatedAt}` : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">{userRole.replace(/_/g, " ").toUpperCase()}</Badge>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.title}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <StrategicPlanningBoard goals={goals} />
    </div>
  );
}
