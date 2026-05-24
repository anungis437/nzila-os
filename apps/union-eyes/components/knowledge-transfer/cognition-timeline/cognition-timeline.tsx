'use client';

/**
 * CognitionTimeline — Organizational cognition evolution tracker
 *
 * Visualizes how organizational continuity reasoning and resilience
 * has evolved over time — simulations, governance investigations,
 * continuity improvements, and resilience score trajectory.
 *
 * An organizational memory audit trail — not a personal activity log.
 */

import { useState, useEffect } from 'react';
import type { CognitionMemoryStore, CognitionMemoryEntry, ResilienceSnapshotPoint } from '@/lib/knowledge-transfer/cognition-memory/memory-models';

const MEMORY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  simulation_snapshot: { label: 'Simulation', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '⚡' },
  propagation_investigation: { label: 'Propagation', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🔗' },
  mitigation_comparison: { label: 'Mitigation', color: 'bg-green-100 text-green-700 border-green-200', icon: '🛡' },
  governance_reasoning: { label: 'Governance', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⚖' },
  resilience_baseline: { label: 'Resilience Baseline', color: 'bg-teal-100 text-teal-700 border-teal-200', icon: '📊' },
  continuity_assessment: { label: 'Continuity Assessment', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: '📋' },
  decision_brief: { label: 'Decision Brief', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: '📌' },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function ResilienceSparkline({ points }: { points: ResilienceSnapshotPoint[] }) {
  if (points.length < 2) return null;

  const scores = points.map((p) => p.resilienceScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = Math.max(max - min, 10);

  const width = 220;
  const height = 48;
  const padding = 6;

  const xs = points.map((_, i) => padding + ((i / (points.length - 1)) * (width - padding * 2)));
  const ys = points.map((p) => height - padding - ((p.resilienceScore - min) / range) * (height - padding * 2));

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const latest = scores[scores.length - 1];
  const first = scores[0];
  const delta = latest - first;
  const strokeColor = delta >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-2 text-xs font-semibold text-slate-600">Resilience Score Trend</p>
      <div className="flex items-center gap-4">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <polyline
            points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {xs.map((x, i) => (
            <circle key={i} cx={x} cy={ys[i]} r="2.5" fill={strokeColor} />
          ))}
        </svg>
        <div className="shrink-0 text-xs text-slate-600">
          <div className="font-mono text-lg font-bold" style={{ color: strokeColor }}>
            {latest}
          </div>
          <div>current</div>
          <div className="mt-0.5">
            <span style={{ color: strokeColor }}>
              {delta >= 0 ? '+' : ''}{delta} pts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineEntryCardProps {
  entry: CognitionMemoryEntry;
}

function TimelineEntryCard({ entry }: TimelineEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = MEMORY_TYPE_CONFIG[entry.memoryType] ?? {
    label: entry.memoryType,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: '📄',
  };

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-300 shadow-sm text-[9px]">
        {config.icon}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}>
                {config.label}
              </span>
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  #{tag}
                </span>
              ))}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">{entry.title}</p>
            {entry.resilienceScoreAtCapture !== null && (
              <p className="mt-0.5 text-xs text-slate-500">
                Resilience: <span className="font-mono font-semibold">{entry.resilienceScoreAtCapture}/100</span>
              </p>
            )}
          </div>
          <time className="shrink-0 text-xs text-slate-400">{formatDate(entry.createdAt)}</time>
        </div>

        {entry.contextSummary && (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">{entry.contextSummary}</p>
        )}

        {entry.keyInsights.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {expanded ? '▲ Hide insights' : `▼ ${entry.keyInsights.length} key insight${entry.keyInsights.length !== 1 ? 's' : ''}`}
            </button>
            {expanded && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-slate-500">
                {entry.keyInsights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FilterType = 'all' | string;

export function CognitionTimeline() {
  const [store, setStore] = useState<CognitionMemoryStore | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch('/api/exit-interviews/cognition-memory')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setStore(json.data as CognitionMemoryStore);
        else setError(json.error ?? 'Failed to load cognition memory');
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredEntries = store
    ? filter === 'all'
      ? store.entries
      : store.entries.filter((e) => e.memoryType === filter)
    : [];

  const memoryTypes = store
    ? Array.from(new Set(store.entries.map((e) => e.memoryType)))
    : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">Organizational Cognition Timeline</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Persistent record of continuity reasoning, governance investigations, and resilience evolution.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="py-8 text-center text-sm text-slate-400">Loading cognition memory…</div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {store && !isLoading && (
          <>
            {/* Resilience sparkline */}
            {store.resilienceTimeline.length >= 2 && (
              <ResilienceSparkline points={store.resilienceTimeline} />
            )}

            {/* Filter bar */}
            {memoryTypes.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All ({store.entries.length})
                </button>
                {memoryTypes.map((type) => {
                  const config = MEMORY_TYPE_CONFIG[type] ?? { label: type, color: 'text-slate-600', icon: '' };
                  const count = store.entries.filter((e) => e.memoryType === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filter === type
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {config.icon} {config.label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            {filteredEntries.length === 0 ? (
              <div className="mt-8 rounded-md border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-400">
                No cognition memory entries yet.
                <br />
                <span className="mt-1 block text-xs">
                  Memory is created as your organization conducts simulations, governance investigations, and continuity assessments.
                </span>
              </div>
            ) : (
              <div className="mt-4 space-y-3 border-l-2 border-slate-200 pl-2">
                {filteredEntries.map((entry) => (
                  <TimelineEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
