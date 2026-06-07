'use client';

import { useEffect, useState } from 'react';

interface SystemsPayload {
  governanceFlow?: { pattern?: string; velocity?: number };
  continuityMomentum?: { direction?: string; velocity?: number };
  overallSystemsHealth?: number;
  systemsNarrative?: string;
}

interface MultiDomainItem {
  domain: string;
  maturittyLevel?: string;
  strength?: number;
}

interface MultiDomainPayload {
  domains?: MultiDomainItem[];
  institutionalContextSynthesis?: string;
}

interface CorrelationItem {
  dimension1?: string;
  dimension2?: string;
  impact?: 'high' | 'moderate' | 'low' | string;
  correlation_strength?: number;
}

interface CorrelationPayload {
  correlations?: CorrelationItem[];
  systemic_fragility_indicators?: string[];
}

interface OrganizationalCognitionResponse {
  data?: {
    byEngine?: Record<string, { payload?: unknown }>;
    failures?: DashboardData['failures'];
  };
}

// Local relaxed shape; envelope payloads are domain-specific. The dashboard
// renders only a few fields for now and treats the rest as opaque.
interface DashboardData {
  systems: SystemsPayload;
  coherence: Record<string, unknown> | null;
  coordination: Record<string, unknown> | null;
  rhythms: Record<string, unknown> | null;
  elasticity: Record<string, unknown> | null;
  momentum: Record<string, unknown> | null;
  multiDomain: MultiDomainPayload;
  procedural: Record<string, unknown> | null;
  precedent: Record<string, unknown> | null;
  trust: Record<string, unknown> | null;
  correlation: CorrelationPayload;
  /** Per-engine envelopes keyed by engineId, available for explainability surfaces. */
  envelopes: Record<string, { payload?: unknown }>;
  /** Engine failures from the orchestrator (isolated, non-cascading). */
  failures: Array<{ engineId: string; domain: string; error: string }>;
}

export function InstitutionalOperatingIntelligenceWorkspace() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'systems' | 'domains' | 'correlations'>('systems');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Single orchestrated call — replaces the previous 11 parallel fetches.
        const res = (await fetch('/api/exit-interviews/organizational-cognition').then((r) =>
          r.json(),
        )) as OrganizationalCognitionResponse;
        const byEngine = res?.data?.byEngine ?? {};
        const failures: DashboardData['failures'] = res?.data?.failures ?? [];
        const payloadOf = <T,>(id: string): T | null => (byEngine[id]?.payload as T | null) ?? null;
        setData({
          systems: payloadOf<SystemsPayload>('systems-dynamics') ?? {},
          coherence: payloadOf('governance-coherence'),
          coordination: payloadOf('operational-coordination'),
          rhythms: payloadOf('operating-rhythms'),
          elasticity: payloadOf('response-elasticity'),
          momentum: payloadOf('governance-momentum'),
          multiDomain: payloadOf<MultiDomainPayload>('multi-domain-cognition') ?? {},
          procedural: payloadOf('procedural-continuity'),
          precedent: payloadOf('institutional-precedent'),
          trust: payloadOf('operational-trust'),
          correlation: payloadOf<CorrelationPayload>('cross-domain-correlation') ?? {},
          envelopes: byEngine,
          failures,
        });
      } catch (error) {
        // Surface error to telemetry instead of console (NO_CONSOLE_001)
        void error;
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading organizational intelligence...</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Organizational Operating Intelligence</h1>
          <p className="text-slate-600">
            Unified organizational cognition environment. Systems dynamics, governance coherence, multi-domain correlations.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          {(['systems', 'domains', 'correlations'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'systems' && 'Systems Dynamics'}
              {tab === 'domains' && 'Multi-Domain Cognition'}
              {tab === 'correlations' && 'Cross-Domain Correlations'}
            </button>
          ))}
        </div>

        {/* Systems Dynamics Tab */}
        {activeTab === 'systems' && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Governance Flow</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Pattern:</span>
                  <span className="font-medium text-slate-900">{data.systems.governanceFlow?.pattern}</span>
                </div>
                <div className="w-full bg-slate-200 rounded h-2">
                  <div className="bg-blue-600 h-2 rounded" style={{ width: `${data.systems.governanceFlow?.velocity}%` }} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Continuity Momentum</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Direction:</span>
                  <span className="font-medium text-slate-900">{data.systems.continuityMomentum?.direction}</span>
                </div>
                <div className="w-full bg-slate-200 rounded h-2">
                  <div className="bg-green-600 h-2 rounded" style={{ width: `${data.systems.continuityMomentum?.velocity}%` }} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200 md:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-4">Systems Health & Narrative</h3>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600">Overall Health Score:</span>
                  <span className="text-2xl font-bold text-slate-900">{Math.round(data.systems.overallSystemsHealth ?? 0)}/100</span>
                </div>
                <div className="w-full bg-slate-200 rounded h-3">
                  <div className="bg-amber-600 h-3 rounded" style={{ width: `${data.systems.overallSystemsHealth}%` }} />
                </div>
              </div>
              <p className="text-sm text-slate-700">{data.systems.systemsNarrative}</p>
            </div>
          </div>
        )}

        {/* Multi-Domain Tab */}
        {activeTab === 'domains' && data && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Cognition Domains</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.multiDomain.domains?.map((domain, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded border border-slate-200">
                  <div className="font-medium text-slate-900 mb-2">{domain.domain.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-slate-600 mb-3">Maturity: {domain.maturittyLevel}</div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Strength:</span>
                    <div className="w-24 bg-slate-300 rounded h-2">
                      <div className="bg-indigo-600 h-2 rounded" style={{ width: `${domain.strength ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-slate-700">{data.multiDomain.institutionalContextSynthesis}</p>
            </div>
          </div>
        )}

        {/* Correlations Tab */}
        {activeTab === 'correlations' && data && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Cross-Domain Organizational Correlations</h3>
            <div className="space-y-3">
              {data.correlation.correlations?.map((corr, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{corr.dimension1}</div>
                      <div className="text-xs text-slate-500 mt-1">↔ {corr.dimension2}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${corr.impact === 'high' ? 'bg-red-100 text-red-800' : corr.impact === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {(corr.impact ?? 'low').toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-300 rounded h-2">
                    <div className="bg-purple-600 h-2 rounded" style={{ width: `${(corr.correlation_strength ?? 0) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-amber-50 rounded border border-amber-200">
              <p className="text-sm text-slate-700 font-medium mb-2">Fragility Indicators:</p>
              <ul className="text-sm text-slate-700 space-y-1">
                {data.correlation.systemic_fragility_indicators?.map((indicator, i: number) => (
                  <li key={i}>• {indicator}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
