'use client';

/**
 * Continuity Heatmap
 *
 * Visualizes knowledge coverage intensity across organizational dimensions:
 * departments/roles × coverage areas (systems, governance, compliance, etc.)
 *
 * Color intensity shows: overconcentration, undocumented exposure,
 * continuity fragility, governance dependency density.
 *
 * Visual language: calm operational risk — not cybersecurity threat UI.
 * This shows ORGANIZATIONAL COVERAGE GAPS, not individual performance.
 */

import { useEffect, useMemo, useState } from 'react';

interface ExpertiseDomain {
  domain: string;
  category: string;
  coverageCount: number;
  roles: string[];
  isSingleSource: boolean;
  averageRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface HeatmapCell {
  role: string;
  category: string;
  coverageCount: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  domains: string[];
}

const ROLES = ['member', 'steward', 'chief_steward', 'officer', 'admin'];
const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  steward: 'Steward',
  chief_steward: 'Chief Steward',
  officer: 'Officer',
  admin: 'Admin',
};

const CATEGORIES = ['system', 'vendor', 'governance', 'compliance', 'operational'];
const CATEGORY_LABELS: Record<string, string> = {
  system: 'Systems',
  vendor: 'Vendors',
  governance: 'Governance',
  compliance: 'Compliance',
  operational: 'Operations',
};

function cellRisk(coverageCount: number, isSingleSourceDomains: number): HeatmapCell['riskLevel'] {
  if (coverageCount === 0) return 'none';
  if (isSingleSourceDomains > 3) return 'critical';
  if (isSingleSourceDomains > 1) return 'high';
  if (coverageCount === 1) return 'medium';
  return 'low';
}

const CELL_STYLES: Record<string, string> = {
  none: 'bg-slate-100/50 text-slate-300',
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const RISK_DOTS: Record<string, string> = {
  none: 'bg-slate-200',
  low: 'bg-emerald-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  critical: 'bg-red-500',
};

interface TooltipState {
  cell: HeatmapCell;
  x: number;
  y: number;
}

export function ContinuityHeatmap({ domains }: { domains: ExpertiseDomain[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const cells = useMemo<HeatmapCell[]>(() => {
    const result: HeatmapCell[] = [];
    for (const role of ROLES) {
      for (const category of CATEGORIES) {
        const roleDomains = domains.filter(
          (d) => d.category === category && d.roles.includes(role),
        );
        const singleSourceCount = roleDomains.filter((d) => d.isSingleSource).length;
        result.push({
          role,
          category,
          coverageCount: roleDomains.length,
          riskLevel: cellRisk(roleDomains.length, singleSourceCount),
          domains: roleDomains.map((d) => d.domain).slice(0, 5),
        });
      }
    }
    return result;
  }, [domains]);

  function getCell(role: string, category: string): HeatmapCell {
    return cells.find((c) => c.role === role && c.category === category) ?? {
      role,
      category,
      coverageCount: 0,
      riskLevel: 'none',
      domains: [],
    };
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted-foreground font-medium pb-1 pr-3 whitespace-nowrap">
                Role ↓ / Domain →
              </th>
              {CATEGORIES.map((cat) => (
                <th key={cat} className="text-center text-xs text-muted-foreground font-medium pb-1 whitespace-nowrap">
                  {CATEGORY_LABELS[cat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}>
                <td className="text-xs text-slate-600 font-medium pr-3 whitespace-nowrap py-0.5">
                  {ROLE_LABELS[role]}
                </td>
                {CATEGORIES.map((cat) => {
                  const cell = getCell(role, cat);
                  return (
                    <td key={cat} className="py-0.5">
                      <button
                        type="button"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ cell, x: rect.left, y: rect.bottom });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        className={`w-full min-w-[72px] rounded-md p-2 text-center transition-all hover:ring-1 hover:ring-slate-300 ${CELL_STYLES[cell.riskLevel]}`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_DOTS[cell.riskLevel]}`} />
                          <span className="text-xs font-medium tabular-nums">
                            {cell.coverageCount === 0 ? '—' : cell.coverageCount}
                          </span>
                        </div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs rounded-lg border bg-white shadow-lg p-3 text-xs pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y + 6 }}
        >
          <p className="font-semibold text-slate-800 mb-1">
            {ROLE_LABELS[tooltip.cell.role]} × {CATEGORY_LABELS[tooltip.cell.category]}
          </p>
          <p className="text-muted-foreground mb-1">
            {tooltip.cell.coverageCount} domain{tooltip.cell.coverageCount !== 1 ? 's' : ''} covered
          </p>
          {tooltip.cell.domains.length > 0 && (
            <p className="text-slate-600">
              {tooltip.cell.domains.join(', ')}
              {tooltip.cell.domains.length >= 5 && ' …'}
            </p>
          )}
          {tooltip.cell.coverageCount === 0 && (
            <p className="text-slate-400 italic">No documented coverage for this area.</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-slate-600">Coverage:</span>
        {[
          { key: 'none', label: 'Not covered' },
          { key: 'low', label: 'Well covered' },
          { key: 'medium', label: 'Limited' },
          { key: 'high', label: 'Concentrated' },
          { key: 'critical', label: 'Single-source' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded ${RISK_DOTS[key] ?? 'bg-slate-200'}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Numbers indicate how many knowledge domains have been captured for that role–category combination.
        Coverage reflects documented organizational knowledge, not individual capability.
      </p>
    </div>
  );
}

/**
 * Self-loading heatmap that fetches expertise map data.
 */
export function ContinuityHeatmapContainer() {
  const [domains, setDomains] = useState<ExpertiseDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/exit-interviews/expertise-map', { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 403) { setLoading(false); return; }
          throw new Error('Failed to load');
        }
        const payload = await res.json() as { data: { domains: ExpertiseDomain[] } };
        setDomains(payload.data.domains);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load heatmap.
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No expertise data to visualize yet.
      </div>
    );
  }

  return <ContinuityHeatmap domains={domains} />;
}
