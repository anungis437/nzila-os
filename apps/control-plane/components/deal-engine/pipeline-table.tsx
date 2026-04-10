"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DealStageBadge } from "./deal-stage-badge";
import { STAGE_METADATA_LIST } from "./stage-metadata";
import type { Deal } from "@nzila/deal-engine/types";
import { ChevronRight } from "lucide-react";

/** Client-safe copy of allowed transitions (mirrors deal-engine lifecycle). */
const NEXT_STAGES: Record<string, string[]> = {
  lead: ["qualified", "lost"],
  qualified: ["demo_scheduled", "lost"],
  demo_scheduled: ["demo_completed", "lost"],
  demo_completed: ["pilot_proposed", "lost"],
  pilot_proposed: ["pilot_active", "lost"],
  pilot_active: ["data_received", "lost"],
  data_received: ["ingestion_running"],
  ingestion_running: ["pilot_review"],
  pilot_review: ["converted", "pilot_active", "lost"],
  converted: ["expanding", "dormant"],
  expanding: ["dormant"],
  dormant: ["qualified"],
};

interface PipelineTableProps {
  deals: Deal[];
}

export function PipelineTable({ deals }: PipelineTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function advanceStage(deal: Deal, toStage: string) {
    setActiveId(deal.id);
    setOpenMenu(null);
    setError(null);
    try {
      const res = await fetch("/api/control-plane/deal-engine/pipeline/mutations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: deal.id,
          fromStage: deal.stage,
          toStage,
          actor: "control-plane-user",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Stage transition failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setActiveId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm border-b border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Value</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Days in Stage</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Risk</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {deals.map((deal) => {
            const nextStages = NEXT_STAGES[deal.stage] ?? [];
            return (
              <tr key={deal.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{deal.accountName}</td>
                <td className="px-4 py-3"><DealStageBadge stage={deal.stage} /></td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{deal.product}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{deal.source}</td>
                <td className="px-4 py-3 text-muted-foreground">{deal.owner}</td>
                <td className="px-4 py-3 text-right text-foreground">
                  ${deal.estimatedValue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={deal.daysInStage > 14 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                    {deal.daysInStage}d
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={
                    deal.conversionRisk === "high" ? "text-red-600 font-medium" :
                    deal.conversionRisk === "medium" ? "text-amber-600" :
                    "text-emerald-600"
                  }>
                    {deal.conversionRisk}
                  </span>
                </td>
                <td className="px-4 py-3 relative">
                  {nextStages.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        disabled={activeId === deal.id}
                        onClick={() => setOpenMenu(openMenu === deal.id ? null : deal.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
                      >
                        {activeId === deal.id ? "…" : <><ChevronRight className="h-3 w-3" />Advance</>}
                      </button>
                      {openMenu === deal.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md">
                          {nextStages.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => advanceStage(deal, s)}
                              className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-accent"
                            >
                              {STAGE_METADATA_LIST[s]?.label ?? s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
