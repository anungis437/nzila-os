import { SummaryCard } from "@/components/ui/summary-card";
import { DollarSign } from "lucide-react";
import type { SaaSUnitEconomics } from "@nzila/platform-metrics";

interface Props {
  economics: SaaSUnitEconomics;
}

export function UnitEconomicsCard({ economics }: Props) {
  return (
    <SummaryCard
      title="Unit Economics"
      icon={<DollarSign className="h-5 w-5" />}
      value={
        <span>
          ${economics.mrr.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">MRR</span>
        </span>
      }
      subtitle={`LTV:CAC ${economics.ltvCacRatio}× · NRR ${economics.nrr}% · ${economics.activeOrgCount} orgs`}
    />
  );
}
