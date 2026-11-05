'use client';

/**
 * Claims Console
 *
 * Fetches and renders the list of cases the caller may see: their own, and the ones they hold a relationship to (the case authority of
 * GET /api/cases), with the triage queue for a caller who triages.
 * Consumes GET /api/cases
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ClaimListTable } from '@/components/claims/claim-list-table';
import { readClaimRow, type ClaimRow } from '@/components/claims/claim-row';
import { MemberCaseList } from '@/components/claims/member-case-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage, envelopeRows, failureText } from '@/lib/client/api-envelope';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

type ClaimsConsoleProps = {
  /** Members see "My Cases" copy; stewards and above see the org-wide claims copy. */
  view?: 'member' | 'staff';
};

export function ClaimsConsole({ view = 'staff' }: ClaimsConsoleProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('claimsPage');
  const workAid = useTranslations('workAidPage');

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cases');
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(body, t('loadError')));
      // The route's { data: rows } is what the framework wraps as { success, data, timestamp }.
      setClaims(envelopeRows(body).map(readClaimRow));
    } catch (failure) {
      setError(failureText(failure, t('loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

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
        <Button variant="outline" size="sm" onClick={fetchClaims}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('retry')}
        </Button>
      </div>
    );
  }

  const copy = view === 'member' ? 'member' : 'staff';

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(`${copy}Title`)}</h1>
          <p className="text-sm text-muted-foreground">
            {t(`${copy}Subtitle`)}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
        <Button className="w-full sm:w-auto" variant="outline" onClick={() => router.push(view === 'member' ? `/${locale}/dashboard/claims/workaid` : `/${locale}/dashboard/workbench/workaid`)}>
          {workAid('openJourney')}
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => router.push(`/${locale}/dashboard/claims/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t(`${copy}NewAction`)}
        </Button>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-base font-medium">{t(`${copy}EmptyTitle`)}</p>
          <p className="text-sm text-muted-foreground">
            {t(`${copy}EmptyBody`)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/claims/new`)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t(`${copy}EmptyAction`)}
          </Button>
        </div>
      ) : view === 'member' ? (
        <MemberCaseList data={claims} />
      ) : (
        <ClaimListTable
          data={claims}
          onView={(c) => router.push(`/${locale}/dashboard/claims/${c.claimId}`)}
          loading={false}
        />
      )}
    </div>
  );
}
