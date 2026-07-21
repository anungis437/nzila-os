"use client";

/**
 * Case lifecycle panel for the CUPE 4373 demo.
 *
 * Shows the current stage and offers the next-step actions a steward
 * would normally take (advance, file as grievance, escalate, resolve).
 * Stage transitions persist only in `sessionStorage` for the demo —
 * they do not call the real `/api/cases/[caseId]/transition` endpoint.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileWarning, Flame } from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  STAGE_DESCRIPTION,
  STAGE_BADGE_CLASS,
  deriveStage,
  nextStage,
  canFileGrievance,
  canEscalate,
  canResolve,
  type LifecycleStage,
} from "@/lib/demo/cupe4373-lifecycle";
import type { DemoCase } from "@/lib/demo/cupe4373-demo";

const STORAGE_KEY = (id: string) => `ue-demo-case-stage:${id}`;

type Entry = { stage: LifecycleStage; at: string; action: string };

export function Cupe4373CaseLifecycle({ demoCase }: { demoCase: DemoCase }) {
  const initial = useMemo(() => deriveStage(demoCase), [demoCase]);
  const [stage, setStage] = useState<LifecycleStage>(initial);
  const [history, setHistory] = useState<Entry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY(demoCase.id));
        if (raw) {
          const parsed = JSON.parse(raw) as { stage: LifecycleStage; history: Entry[] };
          if (parsed?.stage && STAGE_ORDER.includes(parsed.stage)) {
            setStage(parsed.stage);
            setHistory(parsed.history ?? []);
          }
        }
      } catch {
        // ignore — fall back to derived stage
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [demoCase.id]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY(demoCase.id),
        JSON.stringify({ stage, history }),
      );
    } catch {
      // ignore quota / private-mode errors
    }
  }, [stage, history, hydrated, demoCase.id]);

  const transition = (to: LifecycleStage, action: string) => {
    setStage(to);
    setHistory((prev) => [
      ...prev,
      { stage: to, at: new Date().toISOString(), action },
    ]);
  };

  const advance = () => {
    const next = nextStage(stage);
    if (next) transition(next, `Advanced to ${STAGE_LABEL[next]}`);
  };

  const fileGrievance = () => transition("grievance_filed", "Filed as Step 1 grievance");
  const escalate = () => transition("escalation", "Escalated to Step 2 / arbitration");
  const resolve = () => transition("resolved", "Closed with outcome accepted");
  const reset = () => {
    setStage(initial);
    setHistory([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY(demoCase.id));
    } catch {
      // ignore
    }
  };

  const next = nextStage(stage);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Case lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {STAGE_ORDER.map((s, idx) => {
            const reached = STAGE_ORDER.indexOf(stage) >= idx;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    s === stage
                      ? STAGE_BADGE_CLASS[s]
                      : reached
                        ? "border-slate-300 bg-white text-slate-700"
                        : "border-dashed border-slate-200 bg-slate-50 text-slate-400"
                  }
                >
                  {STAGE_LABEL[s]}
                </Badge>
                {idx < STAGE_ORDER.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-slate-300" />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Current stage
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{STAGE_LABEL[stage]}</p>
          <p className="mt-1 text-xs text-slate-600">{STAGE_DESCRIPTION[stage]}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {next && (
            <Button size="sm" variant="outline" onClick={advance}>
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              Advance to {STAGE_LABEL[next]}
            </Button>
          )}
          {canFileGrievance(stage) && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={fileGrievance}
            >
              <FileWarning className="mr-2 h-3.5 w-3.5" />
              File as grievance
            </Button>
          )}
          {canEscalate(stage) && (
            <Button
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-800 hover:bg-orange-50"
              onClick={escalate}
            >
              <Flame className="mr-2 h-3.5 w-3.5" />
              Escalate
            </Button>
          )}
          {canResolve(stage) && stage !== "intake" && (
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              onClick={resolve}
            >
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              Mark resolved
            </Button>
          )}
          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset demo
            </Button>
          )}
        </div>

        {history.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Transitions this session
            </p>
            <ul className="space-y-1.5 text-xs text-slate-700">
              {history.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>
                    <span className="font-medium">{h.action}</span>{" "}
                    <span className="text-slate-500">
                      — {new Date(h.at).toLocaleString("en-CA")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Demo-only: stage changes persist for this browser session and do not modify any
          real record. In production, transitions flow through the case workflow API with
          governance approvals and audit entries.
        </p>
      </CardContent>
    </Card>
  );
}
