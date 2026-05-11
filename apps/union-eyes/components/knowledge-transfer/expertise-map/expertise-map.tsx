'use client';

/**
 * Expertise Dependency Map
 *
 * Visualizes organizational operational dependency structures across
 * published exit interviews.
 *
 * Shows: concentrated expertise domains, isolated operational knowledge,
 * cross-functional overlaps, procedural bottlenecks.
 *
 * This is ORGANIZATIONAL RESILIENCE ANALYSIS — not employee scoring.
 * Cards represent expertise domains, not individuals.
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

interface ExpertiseMapData {
  organizationId: string;
  generatedAt: string;
  totalPublishedInterviews: number;
  domains: ExpertiseDomain[];
  singleSourceDomains: string[];
  wellCoveredDomains: string[];
  categoryBreakdown: Record<string, number>;
}

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-900',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
  },
  high: {
    bg: 'bg-orange-50',
    text: 'text-orange-900',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
  medium: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-900',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  low: {
    bg: 'bg-green-50',
    text: 'text-green-900',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
};

const RISK_LABELS: Record<string, string> = {
  critical: 'Critical — single source',
  high: 'High concentration',
  medium: 'Moderate coverage',
  low: 'Well distributed',
};

const CATEGORY_ICONS: Record<string, string> = {
  system: '⚙',
  vendor: '🤝',
  governance: '📋',
  compliance: '⚖',
  operational: '🔧',
  general: '●',
};

function DomainCard({ domain, isExpanded, onToggle }: {
  domain: ExpertiseDomain;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const styles = RISK_STYLES[domain.riskLevel] ?? RISK_STYLES.low;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left w-full rounded-lg border p-3 transition-all ${styles.bg} ${styles.border} hover:shadow-sm`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5 flex-shrink-0">
          {CATEGORY_ICONS[domain.category] ?? '●'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium ${styles.text} truncate`}>{domain.domain}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0 ${styles.badge}`}>
              {RISK_LABELS[domain.riskLevel]}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{domain.coverageCount} interview{domain.coverageCount !== 1 ? 's' : ''}</span>
            {domain.averageRiskScore > 0 && (
              <span>avg risk {domain.averageRiskScore}/100</span>
            )}
          </div>

          {isExpanded && (
            <div className="mt-2 space-y-1 text-xs">
              {domain.roles.length > 0 && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-slate-600">Roles covered: </span>
                  {domain.roles.join(', ')}
                </p>
              )}
              {domain.isSingleSource && (
                <p className="text-amber-700 font-medium">
                  ⚠ Only one interview documents this area. Consider targeted knowledge capture.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function ExpertiseMap({ initialData }: { initialData?: ExpertiseMapData }) {
  const [data, setData] = useState<ExpertiseMapData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    async function load() {
      try {
        const res = await fetch('/api/exit-interviews/expertise-map', { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 403) { setLoading(false); return; }
          throw new Error('Failed to load expertise map');
        }
        const payload = await res.json() as { data: ExpertiseMapData };
        setData(payload.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [initialData]);

  const categories = useMemo(
    () => [...new Set(data?.domains.map((d) => d.category) ?? [])],
    [data],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.domains.filter(
      (d) =>
        (!categoryFilter || d.category === categoryFilter) &&
        (!riskFilter || d.riskLevel === riskFilter),
    );
  }, [data, categoryFilter, riskFilter]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load expertise map.
      </div>
    );
  }

  if (!data) return null;

  if (data.domains.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">No expertise data yet</p>
        <p className="mt-1">Publish exit interviews to build the organizational expertise map.</p>
      </div>
    );
  }

  const criticalCount = data.domains.filter((d) => d.riskLevel === 'critical').length;
  const highCount = data.domains.filter((d) => d.riskLevel === 'high').length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total domains', value: data.domains.length, color: '' },
          { label: 'Single-source', value: data.singleSourceDomains.length, color: 'text-red-600' },
          { label: 'Well covered', value: data.wellCoveredDomains.length, color: 'text-green-600' },
          { label: 'Published interviews', value: data.totalPublishedInterviews, color: '' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-md border bg-card p-3 text-center">
            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setCategoryFilter(null); setRiskFilter(null); }}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !categoryFilter && !riskFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
        {criticalCount > 0 && (
          <button
            type="button"
            onClick={() => setRiskFilter(riskFilter === 'critical' ? null : 'critical')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              riskFilter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Critical only ({criticalCount})
          </button>
        )}
        {highCount > 0 && (
          <button
            type="button"
            onClick={() => setRiskFilter(riskFilter === 'high' ? null : 'high')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              riskFilter === 'high' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            High only ({highCount})
          </button>
        )}
      </div>

      {/* Domain grid */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((domain) => (
          <DomainCard
            key={domain.domain}
            domain={domain}
            isExpanded={expandedId === domain.domain}
            onToggle={() => setExpandedId(expandedId === domain.domain ? null : domain.domain)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No domains match the current filters.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {data.domains.length} expertise areas across {data.totalPublishedInterviews} published interviews.
        Cards show organizational dependency coverage, not individual performance.
        Last generated {new Date(data.generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
