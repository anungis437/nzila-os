'use client';

import { useState, useEffect } from 'react';
import type { GovernancePersonalityProfile } from '@/lib/knowledge-transfer/maturity-personalities/personality-models';
import type { ArchetypeClassificationResult } from '@/lib/knowledge-transfer/learning-archetypes/archetype-models';
import type { GovernanceCultureProfile } from '@/lib/knowledge-transfer/governance-culture/culture-models';

const PERSONALITY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  centralized_governance:  { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-800' },
  distributed_resilience:  { bg: 'bg-teal-50',   border: 'border-teal-300',   text: 'text-teal-900',   badge: 'bg-teal-100 text-teal-800' },
  continuity_reactive:     { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-900',  badge: 'bg-amber-100 text-amber-800' },
  governance_maturing:     { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-900',   badge: 'bg-blue-100 text-blue-800' },
  resilience_fragile:      { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-900',    badge: 'bg-red-100 text-red-800' },
  continuity_progressive:  { bg: 'bg-emerald-50',border: 'border-emerald-400',text: 'text-emerald-900',badge: 'bg-emerald-100 text-emerald-800' },
};

const STABILITY_COLORS: Record<string, string> = {
  highly_stable: 'text-emerald-700',
  stable: 'text-green-700',
  variable: 'text-amber-600',
  unstable: 'text-red-600',
  insufficient_data: 'text-slate-400',
};

function DimensionRadar({
  dimensions,
}: {
  dimensions: { dimension: string; score: number }[];
}) {
  if (dimensions.length === 0) return null;

  const W = 200;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const R = 80;
  const count = dimensions.length;

  const points = dimensions.map((d, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const r = (d.score / 100) * R;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (R + 18) * Math.cos(angle),
      labelY: cy + (R + 18) * Math.sin(angle),
      label: d.dimension,
      score: d.score,
    };
  });

  const gridLevels = [25, 50, 75, 100];
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-48 h-48" aria-label="Governance dimension radar">
      {/* Grid rings */}
      {gridLevels.map((level) =>
        (() => {
          const ringPts = dimensions.map((_, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
            const r = (level / 100) * R;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          });
          return (
            <polygon
              key={level}
              points={ringPts.join(' ')}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })()
      )}
      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + R * Math.cos(angle)}
            y2={cy + R * Math.sin(angle)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        );
      })}
      {/* Score area */}
      <path d={pathD} fill="#4f46e520" stroke="#4f46e5" strokeWidth="1.5" />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4f46e5" />
      ))}
    </svg>
  );
}

/** Organizational resilience identity card — human-readable institutional characterization. */
export function ResilienceIdentityCard() {
  const [personality, setPersonality] = useState<GovernancePersonalityProfile | null>(null);
  const [archetype, setArchetype] = useState<ArchetypeClassificationResult | null>(null);
  const [culture, setCulture] = useState<GovernanceCultureProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [per, arc, cul] = await Promise.all([
          fetch('/api/exit-interviews/maturity-personalities').then((r) => r.json()),
          fetch('/api/exit-interviews/learning-archetypes').then((r) => r.json()),
          fetch('/api/exit-interviews/governance-culture').then((r) => r.json()),
        ]);
        setPersonality(per.data ?? null);
        setArchetype(arc.data ?? null);
        setCulture(cul.data ?? null);
      } catch {
        setError('Unable to load resilience identity. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Deriving organizational resilience identity…
      </div>
    );
  }

  if (error || !personality) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error ?? 'No identity data available.'}
      </div>
    );
  }

  const colors = PERSONALITY_COLORS[personality.personalityType] ?? PERSONALITY_COLORS['governance_maturing'];

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Identity header */}
      <div className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
              Organizational Resilience Identity
            </div>
            <h2 className={`text-2xl font-bold ${colors.text}`}>{personality.personalityName}</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-3xl font-black ${colors.text}`}>{personality.maturityScore}</div>
            <div className="text-xs text-slate-500">Maturity Score</div>
          </div>
        </div>
        <p className={`text-sm font-medium ${colors.text} italic`}>
          &ldquo;{personality.identityStatement}&rdquo;
        </p>
      </div>

      {/* Divider */}
      <div className={`h-px ${colors.border.replace('border-', 'bg-')}`} />

      {/* Main content */}
      <div className="p-6 grid md:grid-cols-2 gap-6">
        {/* Left: characteristics + strategic focus */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Governance Characteristics
            </h3>
            <ul className="space-y-1">
              {personality.governanceCharacteristics.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/60 rounded-lg p-4 border border-white/80">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Strategic Focus</div>
            <p className="text-sm text-slate-700">{personality.strategicFocus}</p>
          </div>

          {/* Stability profile */}
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Governance Stability</div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold capitalize ${STABILITY_COLORS[personality.stabilityProfile.stabilityRating]}`}>
                {personality.stabilityProfile.stabilityRating?.replace(/_/g, ' ')}
              </span>
              <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-indigo-400"
                  style={{ width: `${personality.stabilityProfile.consistencyScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{personality.stabilityProfile.consistencyScore}/100</span>
            </div>
            <p className="text-xs text-slate-600 mt-1">{personality.stabilityProfile.trendNarrative}</p>
          </div>
        </div>

        {/* Right: radar + archetype + culture */}
        <div className="space-y-4 flex flex-col items-center">
          {personality.dimensions.length > 0 && (
            <div className="flex flex-col items-center">
              <DimensionRadar dimensions={personality.dimensions} />
              <div className="mt-1 text-xs text-slate-400">Governance dimensions</div>
            </div>
          )}

          {/* Secondary archetype */}
          {archetype && (
            <div className="w-full bg-white/60 border border-white/80 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Learning Archetype</div>
              <div className={`text-sm font-semibold ${colors.text}`}>{archetype.primaryArchetype.name}</div>
              {archetype.secondaryArchetype && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Secondary: {archetype.secondaryArchetype.name}
                </div>
              )}
              <p className="text-xs text-slate-600 mt-1">{archetype.primaryArchetype.developmentFocus}</p>
            </div>
          )}

          {/* Culture health */}
          {culture && (
            <div className="w-full bg-white/60 border border-white/80 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Culture Health</div>
              <div className="text-sm font-semibold text-slate-800 capitalize">
                {culture.cultureHealth?.replace(/_/g, ' ')} · {culture.cultureScore}/100
              </div>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{culture.cultureSummary}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-4">
        <p className="text-xs text-slate-400 italic">{personality.interpretationGuidance}</p>
      </div>
    </div>
  );
}
