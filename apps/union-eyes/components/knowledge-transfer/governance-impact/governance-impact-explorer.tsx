'use client';

/**
 * Governance Impact Explorer
 *
 * Visualizes governance continuity exposure across organizational domains.
 * Shows which governance processes are fragile, their dependency paths,
 * and the continuity implications of governance knowledge concentration.
 *
 * This is organizational governance resilience analysis — not policy enforcement.
 */

import { useState } from 'react';

export interface GovernanceNode {
  id: string;
  name: string;
  type: 'compliance' | 'regulatory' | 'procedural' | 'decision_authority';
  isSingleSource: boolean;
  dependsOn: string[];
  downstreamProcesses: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  continuityImplication: string;
}

export interface GovernanceImpactData {
  totalGovernanceProcesses: number;
  singleSourceProcesses: number;
  criticalGovernanceGaps: string[];
  nodes: GovernanceNode[];
  cascadeRisks: Array<{
    triggerNode: string;
    cascadedProcesses: string[];
    severity: string;
    description: string;
  }>;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

const TYPE_LABELS: Record<string, string> = {
  compliance: 'Compliance',
  regulatory: 'Regulatory',
  procedural: 'Procedural',
  decision_authority: 'Decision Authority',
};

interface Props {
  data: GovernanceImpactData;
}

export function GovernanceImpactExplorer({ data }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showSingleSourceOnly, setShowSingleSourceOnly] = useState(false);

  const filteredNodes = data.nodes.filter((n) => {
    if (filterType && n.type !== filterType) return false;
    if (showSingleSourceOnly && !n.isSingleSource) return false;
    return true;
  });

  const selectedNode = selectedNodeId ? data.nodes.find((n) => n.id === selectedNodeId) : null;

  const concentrationPct = data.totalGovernanceProcesses > 0
    ? Math.round((data.singleSourceProcesses / data.totalGovernanceProcesses) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-semibold text-slate-800">{data.totalGovernanceProcesses}</div>
          <div className="text-xs text-slate-500">Governance Processes</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-semibold text-amber-700">{data.singleSourceProcesses}</div>
          <div className="text-xs text-amber-600">Single-Source ({concentrationPct}%)</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-semibold text-red-700">{data.criticalGovernanceGaps.length}</div>
          <div className="text-xs text-red-600">Critical Gaps</div>
        </div>
      </div>

      {/* Critical governance gaps */}
      {data.criticalGovernanceGaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-red-700 mb-1">Critical Governance Continuity Gaps</div>
          <div className="flex flex-wrap gap-1.5">
            {data.criticalGovernanceGaps.map((gap) => (
              <span key={gap} className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">{gap}</span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500">Filter:</span>
        {['compliance', 'regulatory', 'procedural', 'decision_authority'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(filterType === t ? null : t)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              filterType === t
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
        <button
          onClick={() => setShowSingleSourceOnly(!showSingleSourceOnly)}
          className={`text-xs px-2.5 py-1 rounded border transition-colors ml-auto ${
            showSingleSourceOnly
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          Single-source only
        </button>
      </div>

      {/* Governance process list */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {filteredNodes.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-6">No governance processes match filters</div>
        )}
        {filteredNodes.map((node) => (
          <button
            key={node.id}
            onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedNodeId === node.id
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: RISK_COLORS[node.riskLevel] }}
                />
                <span className="text-sm font-medium text-slate-800">{node.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">{TYPE_LABELS[node.type]}</span>
                {node.isSingleSource && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5">single</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: RISK_COLORS[selectedNode.riskLevel] }}
            />
            <h4 className="font-medium text-slate-800">{selectedNode.name}</h4>
            <span className="text-xs text-slate-500 ml-auto">{TYPE_LABELS[selectedNode.type]}</span>
          </div>
          <p className="text-sm text-slate-600">{selectedNode.continuityImplication}</p>
          {selectedNode.downstreamProcesses.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">Downstream processes affected if this fails</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.downstreamProcesses.map((p) => (
                  <span key={p} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{p}</span>
                ))}
              </div>
            </div>
          )}
          {selectedNode.dependsOn.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">Depends on</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.dependsOn.map((d) => (
                  <span key={d} className="text-xs bg-blue-50 text-blue-600 rounded px-2 py-0.5">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cascade risks */}
      {data.cascadeRisks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Governance Cascade Risks</h4>
          <div className="space-y-2">
            {data.cascadeRisks.map((risk, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-800">Trigger: {risk.triggerNode}</span>
                  <span className="text-xs text-slate-500">→ {risk.cascadedProcesses.length} downstream</span>
                  <span className={`text-xs rounded px-1.5 ml-auto ${
                    risk.severity === 'critical' ? 'bg-red-50 text-red-600' :
                    risk.severity === 'high' ? 'bg-orange-50 text-orange-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>{risk.severity}</span>
                </div>
                <p className="text-xs text-slate-500">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
