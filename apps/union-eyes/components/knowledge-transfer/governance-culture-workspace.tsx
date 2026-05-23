'use client';

import { ContinuityCultureEvolution } from '@/components/knowledge-transfer/continuity-culture/continuity-culture-evolution';
import { ResilienceIdentityCard } from '@/components/knowledge-transfer/resilience-identity/resilience-identity-card';

export function GovernanceCultureWorkspace() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Governance Culture Intelligence</h1>
        <p className="text-sm text-slate-500 mt-1">
          Organizational continuity culture · Behavior patterns · Resilience habits · Learning trajectories
        </p>
      </div>

      {/* Resilience identity — always visible at top */}
      <ResilienceIdentityCard />

      {/* Culture evolution detail */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Continuity Culture Evolution</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            How this organization&apos;s governance culture, operational habits, and learning trajectory are evolving over time.
          </p>
        </div>
        <ContinuityCultureEvolution />
      </div>

      {/* Organizational scope notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-0.5">Organizational Scope</div>
            <p className="text-xs text-slate-500">
              All intelligence on this page characterizes organizational governance culture — not individual employees.
              Insights are derived from organizational continuity records and are intended exclusively for governance strategy and continuity planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
