'use client';

/**
 * Institutional Memory Explorer
 *
 * A navigable organizational memory surface for semantic exploration
 * of institutional knowledge across all published exit interviews.
 *
 * Features:
 *   - Semantic + keyword hybrid search
 *   - Topic cluster navigation
 *   - Related knowledge discovery
 *   - Sensitivity-scoped access
 *   - Source lineage visibility
 *   - AI traceability metadata
 *
 * Designed to feel like organizational cognition — not document storage.
 * This is institutional knowledge navigation, not surveillance.
 */

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';

interface SearchResult {
  id: string;
  title: string;
  roleInUnion: string;
  yearsOfService: number;
  summary: string | null;
  sensitivityLevel: string;
  relevanceScore: number;
  publishedAt: string | null;
  expertiseTags?: string[];
  aiSummary?: string | null;
  indexingStatus?: string;
}

interface ExpertiseDomain {
  domain: string;
  category: string;
  coverageCount: number;
  riskLevel: string;
  roles: string[];
}

const SENSITIVITY_STYLE: Record<string, string> = {
  public_internal: 'bg-green-50 text-green-700',
  restricted: 'bg-blue-50 text-blue-700',
  privileged: 'bg-purple-50 text-purple-700',
  legal_sensitive: 'bg-red-50 text-red-700',
  executive_confidential: 'bg-gray-100 text-gray-700',
};

const SENSITIVITY_LABELS: Record<string, string> = {
  public_internal: 'Internal',
  restricted: 'Restricted',
  privileged: 'Privileged',
  legal_sensitive: 'Legal',
  executive_confidential: 'Executive',
};

const CATEGORY_ICONS: Record<string, string> = {
  system: '⚙',
  vendor: '🤝',
  governance: '📋',
  compliance: '⚖',
  operational: '🔧',
  general: '●',
};

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? 'bg-indigo-400' : pct >= 40 ? 'bg-blue-300' : 'bg-slate-200';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function KnowledgeCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);
  const sensitivityStyle = SENSITIVITY_STYLE[result.sensitivityLevel] ?? 'bg-slate-50 text-slate-600';

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          <Link
            href={`../knowledge-transfer/${result.id}`}
            className="text-sm font-semibold hover:text-primary hover:underline truncate block"
          >
            {result.title}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            {result.roleInUnion} · {result.yearsOfService} years
            {result.publishedAt && (
              <> · Published {new Date(result.publishedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sensitivityStyle}`}>
            {SENSITIVITY_LABELS[result.sensitivityLevel] ?? result.sensitivityLevel}
          </span>
        </div>
      </div>

      <RelevanceBar score={result.relevanceScore} />

      {result.summary && !expanded && (
        <p className="text-sm text-muted-foreground line-clamp-2">{result.summary}</p>
      )}

      {expanded && (
        <div className="space-y-2 text-sm">
          {result.summary && <p className="text-muted-foreground">{result.summary}</p>}
          {result.aiSummary && (
            <div className="rounded-md bg-indigo-50 border border-indigo-100 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">AI Operational Summary</p>
              <p className="text-xs text-indigo-800 leading-relaxed">{result.aiSummary}</p>
            </div>
          )}
          {result.expertiseTags && result.expertiseTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.expertiseTags.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {result.indexingStatus === 'indexed' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span>✓</span> Semantically indexed
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-primary/70 hover:text-primary hover:underline"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

function TopicPill({
  domain,
  onClick,
  active,
}: {
  domain: ExpertiseDomain;
  onClick: () => void;
  active: boolean;
}) {
  const riskColor =
    domain.riskLevel === 'critical' ? 'border-red-300 bg-red-50 text-red-700' :
    domain.riskLevel === 'high' ? 'border-orange-300 bg-orange-50 text-orange-700' :
    domain.riskLevel === 'medium' ? 'border-yellow-300 bg-yellow-50 text-yellow-700' :
    'border-slate-200 bg-white text-slate-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
        active ? 'ring-2 ring-primary ring-offset-1' : ''
      } ${riskColor}`}
    >
      {CATEGORY_ICONS[domain.category] ?? '●'} {domain.domain}
      {domain.coverageCount > 1 && (
        <span className="ml-1 opacity-60">×{domain.coverageCount}</span>
      )}
    </button>
  );
}

export function InstitutionalMemoryExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [expertiseDomains, setExpertiseDomains] = useState<ExpertiseDomain[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load expertise domains for browsing
  useEffect(() => {
    async function loadDomains() {
      try {
        const res = await fetch('/api/exit-interviews/expertise-map', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json() as { data: { domains: ExpertiseDomain[] } };
        // Show single-source and high-risk topics prominently
        const sorted = [...(payload.data.domains ?? [])].sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.riskLevel as keyof typeof order] ?? 3) - (order[b.riskLevel as keyof typeof order] ?? 3);
        });
        setExpertiseDomains(sorted.slice(0, 40));
      } catch {
        // ignore
      }
    }
    void loadDomains();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const res = await fetch('/api/exit-interviews/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: searchQuery, semanticWeight: 0.65 }),
      });
      if (!res.ok) throw new Error('Search failed');
      const payload = await res.json() as { data: SearchResult[] };
      setResults(payload.data ?? []);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search error');
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void performSearch(query);
  }

  function handleTopicClick(domain: ExpertiseDomain) {
    if (activeTopic === domain.domain) {
      setActiveTopic(null);
    } else {
      setActiveTopic(domain.domain);
      setQuery(domain.domain);
      void performSearch(domain.domain);
    }
  }

  const semanticCount = results.filter((r) => r.relevanceScore >= 0.6).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Institutional Memory</h1>
          <p className="text-muted-foreground mt-1">
            Navigate and explore your organization&apos;s documented operational knowledge.
          </p>
        </div>
        <Link
          href="../continuity-intelligence"
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Continuity Intelligence →
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search procedures, systems, vendors, governance topics…"
              className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Search institutional memory"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setActiveTopic(null); setResults([]); setHasSearched(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Hybrid semantic + keyword search across all indexed exit interviews.
          Results are scoped to your access level.
        </p>
      </form>

      {/* Topic browser */}
      {expertiseDomains.length > 0 && !hasSearched && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Browse by Knowledge Area</h2>
          <p className="text-xs text-muted-foreground">
            Click any topic to explore related interviews. 
            <span className="text-red-600 ml-1">Red = critical single-source areas</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {expertiseDomains.map((domain) => (
              <TopicPill
                key={domain.domain}
                domain={domain}
                onClick={() => handleTopicClick(domain)}
                active={activeTopic === domain.domain}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search error */}
      {searchError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {searchError}
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {results.length > 0
                ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
                : `No results for "${query}"`}
            </h2>
            {results.length > 0 && semanticCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {semanticCount} strong semantic match{semanticCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {results.length === 0 && !searching && (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium">No matching knowledge found</p>
              <p className="mt-1">Try broader terms, or check that interviews have been published and indexed.</p>
            </div>
          )}

          <div className="space-y-2">
            {results.map((result) => (
              <KnowledgeCard key={result.id} result={result} />
            ))}
          </div>

          {results.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Results ranked by semantic + keyword relevance. Sensitivity filters applied per your access level.
              Indexed interviews use vector similarity search.
            </p>
          )}
        </div>
      )}

      {/* Empty state when no search */}
      {!hasSearched && expertiseDomains.length === 0 && (
        <div className="rounded-lg border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          <p className="font-medium text-base">Organizational memory is building</p>
          <p className="mt-2 max-w-md mx-auto">
            As exit interviews are published and indexed, they become searchable and explorable here.
            Search for procedures, systems, vendors, or governance topics.
          </p>
          <Link
            href="../knowledge-transfer/new"
            className="mt-4 inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Capture Knowledge →
          </Link>
        </div>
      )}

      {/* AI traceability footer */}
      <div className="rounded-md border bg-slate-50 px-4 py-3 space-y-1">
        <p className="text-xs font-medium text-slate-600">AI Traceability</p>
        <p className="text-xs text-muted-foreground">
          Search uses hybrid semantic (pgvector) + keyword matching via{' '}
          <span className="font-mono">@nzila/ai-sdk</span>. All indexed documents carry governance
          metadata: sensitivity level, consent status, indexing timestamp, and source interview lineage.
          Access is scoped to your organizational role.
        </p>
      </div>
    </div>
  );
}
