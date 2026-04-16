"use client";

import type { SimilarCaseResult } from '@/services/case-intelligence/types';

export function SimilarCasesPanel(props: { cases: SimilarCaseResult[]; loading?: boolean }) {
  if (props.loading) {
    return <div className="rounded-lg border bg-white p-4 text-xs text-gray-500">Loading similar cases…</div>;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Similar Cases</h3>
        <p className="text-xs text-gray-500">Explainable pattern matches from authorized case history</p>
      </div>

      {props.cases.length === 0 ? (
        <p className="text-sm text-gray-500">No similar authorized cases found.</p>
      ) : (
        <div className="space-y-2">
          {props.cases.map((item) => (
            <div key={item.caseId} className="rounded border p-3">
              <div className="flex items-center gap-2">
                <a href={`/dashboard/grievances/${item.caseId}`} className="text-sm font-medium text-blue-700 hover:underline">
                  {item.grievanceNumber || item.title || item.caseId}
                </a>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">Score {item.score}</span>
                {item.status ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">{item.status}</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.matchReasons.map((reason) => (
                  <span key={reason} className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
