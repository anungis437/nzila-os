'use client';

/**
 * Propagation Playback
 *
 * Animated timeline visualization of organizational continuity degradation.
 * Simulates how disruptions propagate through the knowledge dependency graph
 * over a projected recovery timeline.
 *
 * Shows organizational process degradation — not individual impact.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface DegradationTimelineStep {
  week: number;
  operationalCapacity: number;
  affectedDomains: string[];
  criticalFailures: string[];
  recoveryProgress: number;
}

export interface MitigationReplayEvent {
  week: number;
  intervention: string;
  capacityBoost: number;
}

export interface PropagationPlaybackData {
  scenarioName: string;
  disruptionType: string;
  totalWeeks: number;
  timeline: DegradationTimelineStep[];
  mitigationReplays: MitigationReplayEvent[];
  bottlenecksExposed: string[];
  recoveryWeek: number | null;
}

interface Props {
  playback: PropagationPlaybackData;
}

export function PropagationPlayback({ playback }: Props) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxWeek = playback.totalWeeks;
  const step = playback.timeline[currentWeek] ?? playback.timeline[playback.timeline.length - 1];

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentWeek(0);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentWeek((prev) => {
        if (prev >= maxWeek - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 280);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, maxWeek]);

  if (!step) return <div className="text-slate-500 text-sm">No timeline data</div>;

  const capacityColor = step.operationalCapacity >= 80 ? '#10b981' : step.operationalCapacity >= 60 ? '#f59e0b' : step.operationalCapacity >= 40 ? '#f97316' : '#ef4444';
  const mitigationAtWeek = playback.mitigationReplays.filter((m) => m.week === currentWeek);

  // Build sparkline points
  const sparkW = 300;
  const sparkH = 60;
  const points = playback.timeline.map((t, i) => {
    const x = (i / Math.max(playback.timeline.length - 1, 1)) * sparkW;
    const y = sparkH - (t.operationalCapacity / 100) * sparkH;
    return `${x},${y}`;
  }).join(' ');
  const progressX = (currentWeek / Math.max(playback.timeline.length - 1, 1)) * sparkW;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{playback.scenarioName}</h3>
        <p className="text-xs text-slate-500">Disruption type: {playback.disruptionType} — {maxWeek}-week simulation</p>
      </div>

      {/* Sparkline timeline */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="text-xs text-slate-500 mb-2">Operational capacity over time</div>
        <svg width={sparkW} height={sparkH + 10} className="w-full" viewBox={`0 0 ${sparkW} ${sparkH + 10}`}>
          <polyline points={points} fill="none" stroke="#cbd5e1" strokeWidth={2} />
          {/* Current week cursor */}
          <line x1={progressX} y1={0} x2={progressX} y2={sparkH} stroke="#6366f1" strokeWidth={1.5} />
          <circle cx={progressX} cy={sparkH - (step.operationalCapacity / 100) * sparkH} r={4} fill="#6366f1" />
          {/* Mitigation events */}
          {playback.mitigationReplays.map((m) => {
            const mx = (playback.timeline.findIndex((t) => t.week >= m.week) / Math.max(playback.timeline.length - 1, 1)) * sparkW;
            return <line key={`${m.week}-${m.intervention}`} x1={mx} y1={0} x2={mx} y2={sparkH} stroke="#10b981" strokeWidth={1} strokeDasharray="3 2" />;
          })}
        </svg>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Week 0</span>
          <span>Week {maxWeek}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="text-xs px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
        <button
          onClick={isPlaying ? pause : play}
          className="text-xs px-4 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={maxWeek - 1}
          value={currentWeek}
          onChange={(e) => {
            setIsPlaying(false);
            setCurrentWeek(Number(e.target.value));
          }}
          className="flex-1"
        />
        <span className="text-xs text-slate-500 w-16">Week {currentWeek}</span>
      </div>

      {/* Current state */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-xs text-slate-500">Operational capacity</div>
          <div className="text-2xl font-semibold" style={{ color: capacityColor }}>
            {step.operationalCapacity}%
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${step.operationalCapacity}%`, background: capacityColor }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1">
          <div className="text-xs text-slate-500">Recovery progress</div>
          <div className="text-2xl font-semibold text-indigo-600">
            {step.recoveryProgress}%
          </div>
          {playback.recoveryWeek !== null && (
            <div className="text-xs text-slate-400">
              Full recovery: week {playback.recoveryWeek}
            </div>
          )}
        </div>
      </div>

      {/* Affected domains */}
      {step.affectedDomains.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-700 mb-1">Affected domains this week</div>
          <div className="flex flex-wrap gap-1.5">
            {step.affectedDomains.map((d) => (
              <span key={d} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Critical failures */}
      {step.criticalFailures.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-700 mb-1">Critical failures at week {currentWeek}</div>
          <div className="flex flex-wrap gap-1.5">
            {step.criticalFailures.map((f) => (
              <span key={f} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Mitigation events at this week */}
      {mitigationAtWeek.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-emerald-700 mb-1">Mitigation activated this week</div>
          {mitigationAtWeek.map((m) => (
            <div key={m.intervention} className="text-xs text-emerald-700">
              {m.intervention} — +{m.capacityBoost}% capacity recovery
            </div>
          ))}
        </div>
      )}

      {/* Bottlenecks exposed */}
      {playback.bottlenecksExposed.length > 0 && (
        <div className="text-xs text-slate-500">
          <span className="font-medium">Bottlenecks exposed: </span>
          {playback.bottlenecksExposed.join(', ')}
        </div>
      )}
    </div>
  );
}
