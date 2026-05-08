'use client';

import { useState, useEffect } from 'react';
import { GovernanceEvolutionTracker } from './governance-evolution/governance-evolution-tracker';
import type { InstitutionalLearningReport } from '@/lib/knowledge-transfer/institutional-learning/learning-models';

const MATURITY_STAGE_LABEL: Record<string, string> = {
  nascent: 'Nascent',
  emerging: 'Emerging',
  developing: 'Developing',
  established: 'Established',
  advanced: 'Advanced',
  leading: 'Leading',
};

export function InstitutionalIntelligenceWorkspace() {
  const [learningReport, setLearningReport] = useState<InstitutionalLearningReport | null>(null);

  useEffect(() => {
    fetch('/api/exit-interviews/institutional-learning')
      .then((r) => r.json())
      .then((r) => {
        if (r.data) setLearningReport(r.data as InstitutionalLearningReport);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Institutional Operating Intelligence</h1>
        <p className="text-slate-500 text-sm">
          Adaptive governance intelligence — how your organization learns, adapts, and evolves its
          continuity posture over time.
        </p>
        {learningReport && (
          <div className="flex items-center gap-3 pt-2">
            <span className="text-sm font-medium text-slate-700">Maturity Stage:</span>
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700">
              {MATURITY_STAGE_LABEL[learningReport.maturityAssessment.maturityStage] ??
                learningReport.maturityAssessment.maturityStage}
            </span>
            <span className="text-slate-400 text-sm">
              {learningReport.maturityAssessment.maturityScore}/100 learning maturity
            </span>
          </div>
        )}
      </div>

      {learningReport && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
          <p className="text-sm text-indigo-800">{learningReport.summary}</p>
        </div>
      )}

      {/* Main tracker */}
      <GovernanceEvolutionTracker />
    </div>
  );
}
