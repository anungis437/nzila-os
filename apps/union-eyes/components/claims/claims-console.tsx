'use client';

/**
 * Claims Console
 *
 * Fetches and renders the claims list.
 * Members see their own claims; stewards+ see org-wide claims.
 * Consumes GET /api/claims
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ClaimListTable, type ClaimRow } from '@/components/claims/claim-list-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

export function ClaimsConsole() {
  const locale = useLocale();
  const router = useRouter();

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
      const raw: ClaimRow[] = (Array.isArray(data) ? data : (data.claims ?? [])).map(
        (c: Record<string, unknown>) => ({
          claimId: String(c.id ?? c.claimId ?? ''),
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
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, []);

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
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage submitted claims
          </p>
        </div>
        <Button onClick={() => router.push(`/${locale}/dashboard/claims/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          New Claim
        </Button>
      </div>

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-base font-medium">No claims yet</p>
          <p className="text-sm text-muted-foreground">
            Claims appear here after members or stewards submit them.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/claims/new`)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Submit first claim
          </Button>
        </div>
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
