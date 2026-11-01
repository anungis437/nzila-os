'use client';

/**
 * Claims Console
 *
 * Fetches and renders the claims list.
 * Members see their own claims; stewards+ see org-wide claims.
 * Consumes GET /api/claims
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ClaimListTable, type ClaimRow } from '@/components/claims/claim-list-table';
import { MemberCaseList } from '@/components/claims/member-case-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
      const res = await fetch('/api/claims');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Standard envelope is { success, data: { data: [...] } }; tolerate flatter shapes.
      const payload = data?.data ?? data;
      const list: unknown[] = Array.isArray(payload)
        ? payload
        : (payload?.data ?? payload?.claims ?? data?.claims ?? []);
      const raw: ClaimRow[] = (Array.isArray(list) ? list : []).map(
        (c) => c as Record<string, unknown>,
      ).map(
        (c: Record<string, unknown>) => ({
          claimId: String(c.claimId ?? c.id ?? ''),
          claimNumber: String(c.claimNumber ?? c.caseNumber ?? c.id ?? ''),
          memberName: String(c.memberName ?? c.member_name ?? ''),
          memberAvatar: c.memberAvatar as string | undefined,
          claimType: String(c.claimType ?? c.claim_type ?? c.type ?? ''),
          status: String(c.status ?? ''),
          priority: String(c.priority ?? 'medium'),
          incidentDate: c.incidentDate ? new Date(c.incidentDate as string) : new Date(c.createdAt as string),
          createdAt: new Date(c.createdAt as string),
          assignedToName: c.assignedToName as string | undefined,
        })
      );
      setClaims(raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
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
