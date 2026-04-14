import { SummaryCard } from "@/components/ui/summary-card";
import { Leaf } from "lucide-react";
import type { ESGScorecard } from "@nzila/platform-metrics";

interface Props {
  scorecard: ESGScorecard;
}

export function ESGScoreCard({ scorecard }: Props) {
  return (
    <SummaryCard
      title="ESG Impact"
      icon={<Leaf className="h-5 w-5" />}
      value={
        <span>
          {scorecard.rating}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({scorecard.compositeScore}/100)
          </span>
        </span>
      }
      subtitle={`E ${scorecard.pillars.environmental} · S ${scorecard.pillars.social} · G ${scorecard.pillars.governance} · CO₂ ${scorecard.carbonFootprint.totalCo2Kg}kg`}
    />
  );
}
