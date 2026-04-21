export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  label: string;
  level: RiskLevel;
  description: string;
}

export function scoreRisks(params: {
  runwayDays: number;
  overdueInvoicesCount: number;
  openDealsCount: number;
  prioritiesCount: number;
  lastActivityDays: number;
}): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (params.runwayDays < 60) {
    risks.push({
      label: "Low Runway",
      level: params.runwayDays < 30 ? "critical" : "high",
      description: `Only ${params.runwayDays} days of runway remaining.`,
    });
  }

  if (params.overdueInvoicesCount > 0) {
    risks.push({
      label: "Overdue Receivables",
      level: params.overdueInvoicesCount > 3 ? "high" : "medium",
      description: `${params.overdueInvoicesCount} invoice(s) overdue.`,
    });
  }

  if (params.openDealsCount === 0) {
    risks.push({
      label: "Silent Pipeline",
      level: "high",
      description: "No open deals in pipeline.",
    });
  }

  if (params.prioritiesCount > 7) {
    risks.push({
      label: "Too Many Priorities",
      level: "medium",
      description: "Founder appears overloaded.",
    });
  }

  if (params.lastActivityDays > 14) {
    risks.push({
      label: "Pipeline Inactive",
      level: "medium",
      description: "No pipeline activity in 2+ weeks.",
    });
  }

  return risks;
}
