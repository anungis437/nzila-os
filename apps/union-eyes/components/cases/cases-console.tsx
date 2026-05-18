'use client';

/**
 * Cases Console
 *
 * Fetches and renders the case list for the steward/officer workbench.
 * Consumes GET /api/cases — steward+ access required.
 */

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CaseList, type CaseListItem } from '@/components/cases/case-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

export function CasesConsole() {
  const t = useTranslations('casesPage');
  const locale = useLocale();
  const router = useRouter();

  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCases() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cases');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCases(Array.isArray(data) ? data : (data.cases ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCases(); }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchCases}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-sm text-muted-foreground">
            Active cases assigned to your workbench
          </p>
        </div>
        <Button onClick={() => router.push(`/${locale}/dashboard/claims/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Case
        </Button>
      </div>

      {cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-base font-medium">No cases yet</p>
          <p className="text-sm text-muted-foreground">
            Cases appear here when members submit grievances or when you create
            a case directly.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/claims/new`)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create first case
          </Button>
        </div>
      ) : (
        <CaseList cases={cases} showFilters />
      )}
    </div>
  );
}
