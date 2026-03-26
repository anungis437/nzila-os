/**
 * Grievance Queue Page
 *
 * Steward and staff workspace for managing grievance cases.
 * Filtered queue, saved views, workload card, quick actions.
 *
 * @module app/grievances/page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { LoadingSkeletonComposer } from '@/components/ui/loading-skeleton-composer';
import { EmptyState } from '@/components/ui/empty-state';
import {
  GrievanceFilterBar,
  GrievanceFilters,
  DEFAULT_FILTERS,
} from '@/components/grievances/grievance-filter-bar';
import {
  GrievanceQueueTable,
  GrievanceRow,
} from '@/components/grievances/grievance-queue-table';
import { StewardLoadCard, StewardWorkload } from '@/components/grievances/steward-load-card';
import { useTranslations } from 'next-intl';

export default function GrievancesPage() {
  const router = useRouter();
  const t = useTranslations('grievances');
  const [loading, setLoading] = useState(true);
  const [grievances, setGrievances] = useState<GrievanceRow[]>([]);
  const [filters, setFilters] = useState<GrievanceFilters>(DEFAULT_FILTERS);
  const [workload, setWorkload] = useState<StewardWorkload>({
    activeCases: 0,
    overdueCases: 0,
    avgDaysInState: 0,
    casesThisWeek: 0,
  });

  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all_statuses') params.set('status', filters.status);
      if (filters.priority && filters.priority !== 'all_priorities') params.set('priority', filters.priority);
      if (filters.employer && filters.employer !== 'all_employers') params.set('employer', filters.employer);
      if (filters.steward && filters.steward !== 'all_stewards') params.set('steward', filters.steward);
      if (filters.search) params.set('q', filters.search);
      if (filters.dateFrom) params.set('from', filters.dateFrom.toISOString());
      if (filters.dateTo) params.set('to', filters.dateTo.toISOString());

      const res = await fetch(`/api/grievances?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch grievances');
      const body = await res.json();
      setGrievances(body.data ?? []);
    } catch (error) {
      logger.error('Failed to load grievances', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchWorkload = useCallback(async () => {
    try {
      const res = await fetch('/api/grievances/workload');
      if (!res.ok) return;
      const body = await res.json();
      setWorkload(body.data ?? workload);
    } catch (error) {
      logger.error('Failed to load workload', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  // Apply client-side search filter for fast UX
  const filteredGrievances = grievances.filter((g) => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    return (
      g.grievanceNumber.toLowerCase().includes(q) ||
      g.title.toLowerCase().includes(q) ||
      g.grievantName.toLowerCase().includes(q) ||
      g.employerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => router.push('/grievances/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("fileNewGrievance")}
        </Button>
      </div>

      {/* Workload summary */}
      <StewardLoadCard
        stewardName={t("stewardName")}
        workload={workload}
      />

      {/* Filters */}
      <GrievanceFilterBar
        filters={filters}
        onFilterChange={setFilters}
        resultCount={filteredGrievances.length}
      />

      {/* Queue */}
      {loading ? (
        <LoadingSkeletonComposer variant="table" rows={8} />
      ) : filteredGrievances.length === 0 ? (
        <EmptyState
          title={t("noGrievancesFound")}
          description={t("noGrievancesDescription")}
          action={{
            label: t("fileNewGrievanceAction"),
            onClick: () => router.push('/grievances/new'),
          }}
        />
      ) : (
        <GrievanceQueueTable
          data={filteredGrievances}
          onView={(row) => router.push(`/dashboard/cases/${row.id}`)}
          onExport={(fmt) => logger.info(`Export requested: ${fmt}`)}
        />
      )}
    </div>
  );
}
