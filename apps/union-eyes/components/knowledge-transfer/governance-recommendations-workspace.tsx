'use client';

/**
 * GovernanceRecommendationsWorkspace
 *
 * Three-panel governance recommendations workspace:
 * 1. Recommendation Queue — from decision brief
 * 2. Evidence Review — full reasoning per recommendation
 * 3. Approval Actions — approve/defer/reject with notes
 *
 * Decisions are persisted to cognition memory.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DecisionBrief, ContinuityRecommendation } from '@/lib/knowledge-transfer/decision-intelligence/decision-models';

type ApprovalStatus = 'pending' | 'approved' | 'deferred' | 'rejected';

interface ApprovalState {
  status: ApprovalStatus;
  notes: string;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-200' },
};

const APPROVAL_STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-slate-100 text-slate-600' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  deferred: { label: 'Deferred', color: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

interface RecommendationPanelProps {
  rec: ContinuityRecommendation;
  index: number;
  isSelected: boolean;
  approval: ApprovalState | undefined;
  onSelect: () => void;
}

function RecommendationCard({ rec, index, isSelected, approval, onSelect }: RecommendationPanelProps) {
  const urgency = URGENCY_CONFIG[rec.urgency] ?? URGENCY_CONFIG.medium;
  const approvalConfig = APPROVAL_STATUS_CONFIG[approval?.status ?? 'pending'];

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left transition-colors ${
        isSelected
          ? 'border-slate-400 bg-slate-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              #{index + 1}
            </span>
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${urgency.color}`}>
              {urgency.label}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${approvalConfig.color}`}>
              {approvalConfig.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-800 leading-snug">{rec.headline}</p>
          <p className="mt-0.5 text-xs text-slate-500">{rec.category}</p>
        </div>
      </div>
    </button>
  );
}

interface EvidenceReviewPanelProps {
  rec: ContinuityRecommendation;
}

function EvidenceReviewPanel({ rec }: EvidenceReviewPanelProps) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-slate-800">{rec.headline}</h3>
        <p className="mt-1 text-slate-600">{rec.rationale}</p>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600 mb-1.5">Continuity Logic</p>
        <p className="text-xs text-slate-700 leading-relaxed">{rec.continuityLogic}</p>
      </div>

      {rec.evidence.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Evidence</p>
          <div className="space-y-2">
            {rec.evidence.map((e, i) => (
              <div key={i} className="rounded border border-slate-200 bg-white px-2.5 py-2 text-xs">
                <p className="font-medium text-slate-700">{e.observation}</p>
                <p className="mt-0.5 font-mono text-slate-500">{e.dataPoint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.reasoningChain.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Reasoning Chain</p>
          <div className="space-y-1.5">
            {rec.reasoningChain.map((r) => (
              <div key={r.step} className="flex gap-2 text-xs">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                  {r.step}
                </span>
                <div>
                  <p className="text-slate-700">{r.evaluation}</p>
                  <p className="mt-0.5 text-slate-500">→ {r.conclusion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.governanceImplications.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Governance Implications</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
            {rec.governanceImplications.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {rec.tradeoffs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Trade-offs</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-500">
            {rec.tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {rec.keyAssumptions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Key Assumptions</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-400 italic">
            {rec.keyAssumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ApprovalPanelProps {
  rec: ContinuityRecommendation;
  approval: ApprovalState;
  onUpdate: (status: ApprovalStatus, notes: string) => void;
  isSaving: boolean;
}

function ApprovalPanel({ rec: _rec, approval, onUpdate, isSaving }: ApprovalPanelProps) {
  const [localStatus, setLocalStatus] = useState<ApprovalStatus>(approval.status);
  const [localNotes, setLocalNotes] = useState(approval.notes);

  useEffect(() => {
    setLocalStatus(approval.status);
    setLocalNotes(approval.notes);
  }, [approval]);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">Decision</p>
        <div className="grid grid-cols-2 gap-2">
          {(['approved', 'deferred', 'rejected', 'pending'] as ApprovalStatus[]).map((s) => {
            const cfg = APPROVAL_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setLocalStatus(s)}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  localStatus === s
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Governance Notes
        </label>
        <textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          rows={4}
          placeholder="Record rationale, conditions, or governance observations…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
        />
      </div>

      <button
        onClick={() => onUpdate(localStatus, localNotes)}
        disabled={isSaving}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save Decision'}
      </button>

      <p className="text-xs text-slate-400">
        Decisions are persisted to organizational cognition memory and audit trail.
      </p>
    </div>
  );
}

export function GovernanceRecommendationsWorkspace() {
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [approvals, setApprovals] = useState<Record<string, ApprovalState>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/exit-interviews/decision-brief')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setBrief(json.data as DecisionBrief);
        } else {
          setError(json.error ?? 'Failed to load decision brief');
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpdateApproval = useCallback(
    async (recId: string, status: ApprovalStatus, notes: string) => {
      setIsSaving(true);
      const rec = brief?.recommendations.find((r) => r.id === recId);
      if (!rec) { setIsSaving(false); return; }

      try {
        await fetch('/api/exit-interviews/cognition-memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memoryType: 'governance_reasoning',
            title: `${status === 'approved' ? 'Approved' : status === 'deferred' ? 'Deferred' : status === 'rejected' ? 'Rejected' : 'Reviewed'}: ${rec.headline}`,
            contextSummary: notes || `Governance decision recorded: ${status}`,
            payload: { recId, status, notes, rec },
            keyInsights: notes ? [notes] : [],
            tags: ['governance-decision', rec.category, status],
          }),
        });

        setApprovals((prev) => ({
          ...prev,
          [recId]: { status, notes },
        }));
      } catch {
        // Non-fatal — approval state still updated locally
        setApprovals((prev) => ({
          ...prev,
          [recId]: { status, notes },
        }));
      } finally {
        setIsSaving(false);
      }
    },
    [brief],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading governance recommendations…
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? 'No decision brief available'}
      </div>
    );
  }

  const recs = brief.recommendations;
  const selected = recs[selectedIndex];
  const selectedApproval = selected
    ? approvals[selected.id] ?? { status: 'pending', notes: '' }
    : { status: 'pending', notes: '' };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Governance Recommendation Review</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {recs.length} recommendations requiring governance review · {brief.organizationId}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Recommendation Queue */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recommendation Queue
          </p>
          <div className="space-y-2">
            {recs.map((rec, i) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                index={i}
                isSelected={i === selectedIndex}
                approval={approvals[rec.id]}
                onSelect={() => setSelectedIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* Middle: Evidence Review */}
        <div className="flex-1 overflow-y-auto border-r border-slate-200 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidence &amp; Reasoning
          </p>
          {selected ? (
            <EvidenceReviewPanel rec={selected} />
          ) : (
            <p className="text-sm text-slate-400">Select a recommendation to review evidence.</p>
          )}
        </div>

        {/* Right: Approval Actions */}
        <div className="w-72 shrink-0 overflow-y-auto p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Governance Decision
          </p>
          {selected ? (
            <ApprovalPanel
              rec={selected}
              approval={selectedApproval as ApprovalState}
              onUpdate={(s, n) => handleUpdateApproval(selected.id, s, n)}
              isSaving={isSaving}
            />
          ) : (
            <p className="text-sm text-slate-400">Select a recommendation to record a decision.</p>
          )}
        </div>
      </div>
    </div>
  );
}
