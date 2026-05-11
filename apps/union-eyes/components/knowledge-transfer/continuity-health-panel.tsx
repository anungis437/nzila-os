'use client';

import { useEffect, useState } from 'react';

interface RiskFlag {
  flag: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRoles: string[];
  topicAreas: string[];
  recommendation: string;
}

interface ContinuityRiskReport {
  organizationId: string;
  generatedAt: string;
  totalPublishedInterviews: number;
  overallRiskScore: number;
  riskFlags: RiskFlag[];
  singleSourceTopics: string[];
  coverageGaps: string[];
  isolatedExpertise: string[];
  executiveSummary: string;
}

const RISK_COLOR: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function RiskScore({ score }: { score: number }) {
  const color = score >= 70 ? 'text-red-600' : score >= 40 ? 'text-orange-500' : 'text-green-600';
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Moderate Risk' : 'Low Risk';
  return (
    <div className="flex items-center gap-2">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{score}</span>
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
}

export function ContinuityHealthPanel() {
  const [report, setReport] = useState<ContinuityRiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch('/api/exit-interviews/continuity-risk', { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 403) {
            setError(null);
            setReport(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch continuity report');
        }
        const payload = await res.json();
        setReport(payload.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void fetchReport();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-muted mb-2" />
        <div className="h-8 w-24 rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load continuity health data.
      </div>
    );
  }

  // No access (403) — silently hide panel
  if (!report) return null;

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">Continuity Health</h2>
          <p className="text-xs text-muted-foreground">
            Based on {report.totalPublishedInterviews} published interview{report.totalPublishedInterviews !== 1 ? 's' : ''}
          </p>
        </div>
        <RiskScore score={report.overallRiskScore} />
      </div>

      {report.executiveSummary && (
        <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
          {report.executiveSummary}
        </p>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Single-source topics"
          value={report.singleSourceTopics.length}
          warn={report.singleSourceTopics.length > 3}
        />
        <StatTile
          label="Coverage gaps"
          value={report.coverageGaps.length}
          warn={report.coverageGaps.length > 0}
        />
        <StatTile
          label="Isolated expertise"
          value={report.isolatedExpertise.length}
          warn={report.isolatedExpertise.length > 5}
        />
      </div>

      {/* Risk flags — collapsed by default */}
      {report.riskFlags.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {expanded ? 'Hide' : 'Show'} {report.riskFlags.length} risk flag{report.riskFlags.length !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <ul className="mt-3 space-y-2">
              {report.riskFlags.map((flag, idx) => (
                <li key={idx} className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${RISK_COLOR[flag.severity]}`}>
                      {flag.severity}
                    </span>
                    <span className="font-medium">{flag.flag}</span>
                  </div>
                  {flag.recommendation && (
                    <p className="text-muted-foreground">{flag.recommendation}</p>
                  )}
                  {flag.topicAreas.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Areas: {flag.topicAreas.join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Updated {new Date(report.generatedAt).toLocaleString()} · Organizational risk only, not individual evaluations
      </p>
    </div>
  );
}

function StatTile({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className={`rounded-md border p-3 text-center ${warn ? 'border-orange-200 bg-orange-50' : 'bg-muted/30'}`}>
      <p className={`text-xl font-bold tabular-nums ${warn ? 'text-orange-600' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
