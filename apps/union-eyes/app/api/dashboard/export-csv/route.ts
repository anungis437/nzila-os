/**
 * Dashboard CSV Export API
 *
 * GET /api/dashboard/export-csv?report=cases|kpis|aging|categories|worksites|assignees|trends
 *
 * PR-051: Returns CSV file download for dashboard data.
 * Authentication: Required via platform auth middleware.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';
import {
  generateCSV,
  CASE_COLUMNS,
  KPI_COLUMNS,
  AGING_COLUMNS,
  CATEGORY_COLUMNS,
  WORKSITE_COLUMNS,
  ASSIGNEE_COLUMNS,
  TREND_COLUMNS,
  kpiCardsToRows,
} from '@/lib/csv-export';
import {
  computeKPIs,
  computeAgingBuckets,
  computeTypeCounts,
  computeWorksiteCounts,
  computeAssigneeCounts,
  computeClosureTrends,
  filterCases,
  type CaseRow,
  type CaseFilter,
} from '@/lib/dashboard-metrics';

const logger = createLogger('dashboard:export-csv');

const VALID_REPORTS = new Set([
  'cases', 'kpis', 'aging', 'categories', 'worksites', 'assignees', 'trends',
]);

export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get('report') ?? 'cases';

    if (!VALID_REPORTS.has(report)) {
      return NextResponse.json(
        { error: `Invalid report type. Valid: ${[...VALID_REPORTS].join(', ')}` },
        { status: 400 },
      );
    }

    // In production this would query the database.
    // For the pilot, we use the same pure-computation approach:
    // the caller would supply cases via a shared service layer.
    // Here we demonstrate the export pipeline with an empty set
    // that the route handler will replace once wired to the DB.
    const cases: CaseRow[] = [];

    // Apply filters from query params
    const filter: CaseFilter = {};
    const timeframe = searchParams.get('timeframeDays');
    if (timeframe) filter.timeframeDays = parseInt(timeframe, 10);
    const status = searchParams.get('status');
    if (status) filter.status = status;
    const worksite = searchParams.get('worksite');
    if (worksite) filter.worksite = worksite;

    const filtered = filterCases(cases, filter);

    let csv: string;
    let filename: string;

    switch (report) {
      case 'cases':
        csv = generateCSV(filtered, CASE_COLUMNS);
        filename = 'cupe-cases.csv';
        break;
      case 'kpis':
        csv = generateCSV(kpiCardsToRows(computeKPIs(filtered)), KPI_COLUMNS);
        filename = 'cupe-kpis.csv';
        break;
      case 'aging':
        csv = generateCSV(computeAgingBuckets(filtered), AGING_COLUMNS);
        filename = 'cupe-aging.csv';
        break;
      case 'categories':
        csv = generateCSV(computeTypeCounts(filtered), CATEGORY_COLUMNS);
        filename = 'cupe-categories.csv';
        break;
      case 'worksites':
        csv = generateCSV(computeWorksiteCounts(filtered), WORKSITE_COLUMNS);
        filename = 'cupe-worksites.csv';
        break;
      case 'assignees':
        csv = generateCSV(computeAssigneeCounts(filtered), ASSIGNEE_COLUMNS);
        filename = 'cupe-assignees.csv';
        break;
      case 'trends':
        csv = generateCSV(computeClosureTrends(filtered), TREND_COLUMNS);
        filename = 'cupe-closure-trends.csv';
        break;
      default:
        csv = '';
        filename = 'export.csv';
    }

    logger.info('CSV export generated', { report, rows: csv.split('\n').length - 1 });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('[/api/dashboard/export-csv] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 },
    );
  }
});

