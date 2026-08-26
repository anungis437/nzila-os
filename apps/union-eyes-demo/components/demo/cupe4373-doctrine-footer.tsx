"use client";

/**
 * Shared doctrine compliance footer for CUPE 4373 demo surfaces.
 *
 * Carries the canonical disclaimers required by the organizational
 * operational cognition doctrine — bounded interpretation, explicit
 * human reviewer of record, escalation pathway, retention basis.
 */

import { ShieldCheck, UserCheck } from "lucide-react";
import { retentionPolicy } from "@/lib/demo/cupe4373-demo";

type Props = {
  /** Which accountable human role owns final authority on this surface. */
  reviewerOfRecord: string;
  /** Escalation pathway — who/what to escalate to when interpretation needs review. */
  escalation: string;
  /** Optional extra context line. */
  context?: string;
};

export function Cupe4373DoctrineFooter({
  reviewerOfRecord,
  escalation,
  context,
}: Props) {
  return (
    <footer
      aria-label="Organizational cognition doctrine"
      className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
        <div className="flex gap-2">
          <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-900">Reviewer of record</p>
            <p>{reviewerOfRecord}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-900">Escalation pathway</p>
            <p>{escalation}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <div>
            <p className="font-medium text-slate-900">Retention</p>
            <p>{retentionPolicy.shortLabel}</p>
          </div>
        </div>
      </div>
      <p className="mt-3 border-t border-slate-200 pt-3 text-slate-600">
        Bounded organizational interpretation; final authority remains with accountable union
        officers. {context}
      </p>
    </footer>
  );
}
