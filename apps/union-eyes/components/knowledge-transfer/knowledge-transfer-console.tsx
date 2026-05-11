'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ContinuityHealthPanel } from './continuity-health-panel';

type ExitInterviewStatus = 'draft' | 'submitted' | 'reviewed' | 'published' | 'archived';
type SensitivityLevel = 'public_internal' | 'restricted' | 'privileged' | 'legal_sensitive' | 'executive_confidential';
type IndexingStatus = 'pending' | 'indexing' | 'indexed' | 'failed' | 'skipped';

type ExitInterviewListItem = {
  id: string;
  title: string;
  retiringEmployeeName: string;
  roleInUnion: string;
  status: ExitInterviewStatus;
  sensitivityLevel: SensitivityLevel;
  indexingStatus: IndexingStatus;
  continuityRiskScore: number | null;
  expertiseTags: string[] | null;
  createdAt: string;
  publishedAt: string | null;
};

type SearchResult = {
  id: string;
  title: string;
  roleInUnion: string;
  yearsOfService: number;
  summary: string | null;
  sensitivityLevel: SensitivityLevel;
  relevanceScore: number;
  publishedAt: string | null;
};

const SENSITIVITY_LABEL: Record<SensitivityLevel, string> = {
  public_internal: 'Internal',
  restricted: 'Restricted',
  privileged: 'Privileged',
  legal_sensitive: 'Legal',
  executive_confidential: 'Executive',
};

const SENSITIVITY_STYLE: Record<SensitivityLevel, string> = {
  public_internal: 'bg-green-50 text-green-700',
  restricted: 'bg-blue-50 text-blue-700',
  privileged: 'bg-purple-50 text-purple-700',
  legal_sensitive: 'bg-red-50 text-red-700',
  executive_confidential: 'bg-gray-100 text-gray-700',
};

const INDEXING_STYLE: Record<IndexingStatus, string> = {
  pending: 'text-muted-foreground',
  indexing: 'text-blue-500',
  indexed: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-muted-foreground',
};

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const color = score >= 70 ? 'text-red-600 font-semibold' : score >= 40 ? 'text-orange-500' : 'text-green-600';
  return <span className={`tabular-nums text-xs ${color}`}>{score}/100</span>;
}

export function KnowledgeTransferConsole() {
  const [items, setItems] = useState<ExitInterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    if (!statusFilter) return '';
    return `?status=${encodeURIComponent(statusFilter)}`;
  }, [statusFilter]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/exit-interviews${queryString}`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to fetch interviews');
        const payload = await response.json();
        setItems(payload.data ?? []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [queryString]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch('/api/exit-interviews/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: searchQuery }),
      });
      if (!res.ok) throw new Error('Search failed');
      const payload = await res.json();
      setSearchResults(payload.data ?? []);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search error');
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Transfer</h1>
          <p className="text-sm text-muted-foreground">
            Preserve institutional memory and reduce operational continuity risk.
          </p>
        </div>
        <Link
          href="/dashboard/knowledge-transfer/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New Exit Interview
        </Link>
      </header>

      {/* Continuity health panel — only visible to officer+ */}
      <ContinuityHealthPanel />

      {/* Hybrid search */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <form onSubmit={(e) => void handleSearch(e)} className="flex gap-2">
          <input
            type="search"
            placeholder="Search knowledge base (semantic + keyword)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
            minLength={2}
          />
          <button
            type="submit"
            disabled={searching || searchQuery.length < 2}
            className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
          {searchResults !== null && (
            <button type="button" onClick={clearSearch} className="rounded-md border px-3 text-sm">
              Clear
            </button>
          )}
        </form>

        {searchError && <p className="text-sm text-destructive">{searchError}</p>}

        {searchResults !== null && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} — hybrid semantic + keyword</p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching knowledge found.</p>
            ) : (
              <ul className="space-y-2">
                {searchResults.map((r) => (
                  <li key={r.id} className="flex items-start justify-between rounded-md border p-3 text-sm">
                    <div>
                      <Link href={`/dashboard/knowledge-transfer/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.roleInUnion} · {r.yearsOfService}y</p>
                      {r.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.summary}</p>}
                    </div>
                    <span className="ml-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {Math.round(r.relevanceScore * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Browse filter */}
      <div className="rounded-lg border bg-card p-4">
        <label htmlFor="status-filter" className="mb-2 block text-sm font-medium">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-64"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading interviews...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Retiring Employee</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Sensitivity</th>
                <th className="px-4 py-3 text-left font-medium">Risk</th>
                <th className="px-4 py-3 text-left font-medium">Index</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                    No interviews found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/knowledge-transfer/${item.id}`} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                      {item.expertiseTags && item.expertiseTags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {item.expertiseTags.slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{item.retiringEmployeeName}</td>
                    <td className="px-4 py-3 capitalize">{item.roleInUnion.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 capitalize">{item.status}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SENSITIVITY_STYLE[item.sensitivityLevel ?? 'public_internal']}`}>
                        {SENSITIVITY_LABEL[item.sensitivityLevel ?? 'public_internal']}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge score={item.continuityRiskScore} />
                    </td>
                    <td className={`px-4 py-3 text-xs capitalize ${INDEXING_STYLE[item.indexingStatus ?? 'pending']}`}>
                      {item.indexingStatus ?? 'pending'}
                    </td>
                    <td className="px-4 py-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
