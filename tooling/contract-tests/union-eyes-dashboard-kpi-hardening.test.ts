import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Union Eyes dashboard KPI hardening contract', () => {
  it('leadership route is wired to shared KPI service', () => {
    const source = read('apps/union-eyes/app/api/dashboard/leadership/route.ts');
    expect(source).toContain('getLeadershipDashboardMetrics');
    expect(source).toContain('standardSuccessResponse(metrics)');
  });

  it('executive routes are wired to shared KPI service without placeholder metric literals', () => {
    const metricsRoute = read('apps/union-eyes/app/api/executive/metrics/route.ts');
    const dashboardRoute = read('apps/union-eyes/app/api/executive/dashboard/route.ts');

    expect(metricsRoute).toContain('getExecutiveMetrics');
    expect(dashboardRoute).toContain('getExecutiveMetrics');

    expect(metricsRoute).not.toMatch(/pendingApprovals:\s*0/);
    expect(metricsRoute).not.toMatch(/upcomingMeetings:\s*0/);
    expect(metricsRoute).not.toMatch(/membershipTrend:\s*0/);
    expect(metricsRoute).not.toMatch(/monthlyBudget:\s*0/);

    expect(dashboardRoute).not.toMatch(/pendingApprovals:\s*0/);
    expect(dashboardRoute).not.toMatch(/upcomingMeetings:\s*0/);
  });

  it('shared KPI service emits provenance and cache metadata fields', () => {
    const source = read('apps/union-eyes/lib/services/dashboard-kpi-service.ts');

    expect(source).toContain('provenance');
    expect(source).toContain('window');
    expect(source).toContain('sources');
    expect(source).toContain('cache');
    expect(source).toContain('cacheGet');
    expect(source).toContain('cacheSet');
  });
});
