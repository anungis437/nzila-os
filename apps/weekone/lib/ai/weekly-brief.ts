import { rankPriorities } from "@/domain/priorities";
import { scoreRisks } from "@/domain/risk";
import { calculateRunway, runwayStatus } from "@/domain/runway";

export interface WeeklyBriefInput {
  cashOnHand: number;
  monthlyBurn: number;
  overdueInvoices: number;
  openDeals: number;
  pipelineValue: number;
  topDeal?: { name: string; value: number };
}

export interface WeeklyBrief {
  weekStartDate: string;
  summary: string;
  priorities: string[];
  moneyWatch: string;
  pipelineWatch: string;
  riskWatch: string;
  founderRecommendation: string;
}

export function generateWeeklyBrief(input: WeeklyBriefInput): WeeklyBrief {
  const runwayDays = calculateRunway({
    cashOnHand: input.cashOnHand,
    monthlyBurn: input.monthlyBurn,
  });
  const status = runwayStatus(runwayDays);
  const risks = scoreRisks({
    runwayDays,
    overdueInvoicesCount: input.overdueInvoices,
    openDealsCount: input.openDeals,
    prioritiesCount: 4,
    lastActivityDays: 7,
  });
  const priorities = rankPriorities({
    runwayDays,
    pipelineValue: input.pipelineValue,
    overdueInvoices: input.overdueInvoices,
    topDeal: input.topDeal,
  });

  const weekStartDate = new Date().toISOString().split("T")[0]!;

  return {
    weekStartDate,
    summary: `This week your runway is ${runwayDays === Infinity ? "unlimited" : `${runwayDays} days`} with ${input.openDeals} open deal(s) worth $${input.pipelineValue.toLocaleString()} in pipeline.`,
    priorities: priorities.map(
      (p) =>
        `${p.rank}. [${p.category.toUpperCase()}] ${p.title}: ${p.description}`
    ),
    moneyWatch:
      status === "critical"
        ? `⚠️ Runway critical at ${runwayDays} days. Immediate action required.`
        : status === "warning"
          ? `⚡ Runway at ${runwayDays} days. Monitor closely.`
          : `✅ Cash healthy. ${runwayDays} days runway.`,
    pipelineWatch:
      input.openDeals > 0
        ? `${input.openDeals} open deal(s) worth $${input.pipelineValue.toLocaleString()}. ${input.topDeal ? `Focus on ${input.topDeal.name}.` : ""}`
        : "⚠️ No open deals. Create pipeline this week.",
    riskWatch:
      risks.length > 0
        ? risks
            .map(
              (r) =>
                `[${r.level.toUpperCase()}] ${r.label}: ${r.description}`
            )
            .join(" | ")
        : "✅ No active risks detected.",
    founderRecommendation: priorities[0]
      ? `This week: ${priorities[0].title}. ${priorities[0].description}`
      : "Review your top priority and take one decisive action.",
  };
}
