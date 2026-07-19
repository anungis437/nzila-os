import { describe, it, expect } from 'vitest';
import { CarbonAccountingService, carbonAccountingService } from '../carbon-accounting-service';

const svc = new CarbonAccountingService();

describe('CarbonAccountingService emissions calculations', () => {
  it('calculateScope2 returns the estimated cloud electricity emissions', async () => {
    const s2 = await svc.calculateScope2(2026, 1);
    expect(s2).toBeCloseTo((150000 * 0.002) / 1000);
  });

  it('calculateScope3 returns a breakdown of supply-chain emissions', async () => {
    const s3 = await svc.calculateScope3(2026, 1);
    expect(s3.remoteWork).toBeGreaterThan(0);
    expect(s3.saasVendors).toBeCloseTo(40 / 12);
    expect(s3.travel).toBeCloseTo(15 / 12);
    expect(s3.hardware).toBeCloseTo(5 / 12);
  });

  it('calculateRenewablePercent returns 99', async () => {
    expect(await svc.calculateRenewablePercent(2026, 1)).toBe(99);
  });

  it('getActiveMemberCount returns the estimated count', async () => {
    expect(await svc.getActiveMemberCount(2026, 1)).toBe(5000);
  });

  it('calculateMonthlyEmissions assembles scopes, breakdown and per-member', async () => {
    const m = await svc.calculateMonthlyEmissions(2026, 3);
    expect(m.month).toBe('2026-03');
    expect(m.scope1).toBe(0);
    expect(m.scope2).toBeGreaterThan(0);
    expect(m.total).toBeCloseTo(m.scope1 + m.scope2 + m.scope3);
    expect(m.renewablePercent).toBe(99);
    expect(m.perMember).toBeGreaterThan(0);
  });

  it('calculateYearlyEmissions aggregates 12 months and computes target metrics', async () => {
    const y = await svc.calculateYearlyEmissions(2026);
    expect(y.year).toBe(2026);
    expect(y.total).toBeCloseTo(y.scope1 + y.scope2 + y.scope3);
    expect(y.sbtiTarget).toBe(225);
    expect(y.percentOfTarget).toBeGreaterThan(0);
    expect(typeof y.reductionFromBaseline).toBe('number');
  });
});

describe('CarbonAccountingService SBTi target interpolation', () => {
  it('returns the baseline for years before the baseline year', async () => {
    const y = await svc.calculateYearlyEmissions(2025);
    expect(y.sbtiTarget).toBe(225);
  });

  it('interpolates between baseline and the 2030 target', async () => {
    const y2028 = await svc.calculateYearlyEmissions(2028);
    expect(y2028.sbtiTarget).toBeGreaterThan(112.5);
    expect(y2028.sbtiTarget).toBeLessThan(225);
  });

  it('interpolates between the 2030 and 2050 targets', async () => {
    const y2040 = await svc.calculateYearlyEmissions(2040);
    expect(y2040.sbtiTarget).toBeGreaterThan(22.5);
    expect(y2040.sbtiTarget).toBeLessThan(112.5);
  });

  it('returns the 2050 target for years at or after 2050', async () => {
    const y2050 = await svc.calculateYearlyEmissions(2051);
    expect(y2050.sbtiTarget).toBe(22.5);
  });
});

describe('CarbonAccountingService region helpers', () => {
  it('verifyRenewableRegions reports compliance for the default deployment', async () => {
    const r = await svc.verifyRenewableRegions();
    expect(r.compliant).toBe(true);
    expect(r.deployedRegions).toContain('canadacentral');
    expect(r.violations).toHaveLength(0);
  });

  it('isRenewableRegion validates approved and unapproved regions', () => {
    expect(svc.isRenewableRegion('azure', 'canadacentral')).toBe(true);
    expect(svc.isRenewableRegion('aws', 'us-west-2')).toBe(true);
    expect(svc.isRenewableRegion('gcp', 'northamerica-northeast1')).toBe(true);
    expect(svc.isRenewableRegion('azure', 'us-east-1')).toBe(false);
  });

  it('getRegionDetails returns approved region details', () => {
    const d = svc.getRegionDetails('azure', 'canadacentral');
    expect(d.found).toBe(true);
    expect(d.approved).toBe(true);
  });

  it('getRegionDetails returns blocked region details', () => {
    const d = svc.getRegionDetails('azure', 'us-east-1');
    expect(d.found).toBe(true);
    expect(d.approved).toBe(false);
  });

  it('getRegionDetails returns not-found for unknown regions', () => {
    const d = svc.getRegionDetails('azure', 'mars-central-1');
    expect(d.found).toBe(false);
    expect(d.approved).toBe(false);
  });
});

describe('CarbonAccountingService dashboards and projections', () => {
  it('getCarbonDashboard returns a complete summary', async () => {
    const d = await svc.getCarbonDashboard();
    expect(d.currentMonth).toBeDefined();
    expect(d.yearToDate).toBeDefined();
    expect(d.regionCompliance.compliant).toBe(true);
    expect(d.sbtiProgress.baselineYear).toBe(2026);
    expect(typeof d.sbtiProgress.onTrackFor2030).toBe('boolean');
    expect(d.comparison.industryAverage).toBe(0.12);
  });

  it('getHistoricalEmissions returns one entry per year in range', async () => {
    const h = await svc.getHistoricalEmissions(2026, 2028);
    expect(h).toHaveLength(3);
    expect(h[0].year).toBe(2026);
    expect(h[2].year).toBe(2028);
  });

  it('getHistoricalEmissions uses defaults when no range is provided', async () => {
    const h = await svc.getHistoricalEmissions();
    expect(h.length).toBeGreaterThan(0);
    expect(h[0].year).toBe(2026);
  });

  it('projectFutureEmissions projects to 2050 with recommendations', async () => {
    const p = await svc.projectFutureEmissions(2050);
    expect(p.projected.length).toBeGreaterThan(0);
    expect(typeof p.willMeet2030Target).toBe('boolean');
    expect(typeof p.willMeet2050Target).toBe('boolean');
    expect(p.recommendations.length).toBeGreaterThan(0);
  });

  it('projectFutureEmissions handles a short horizon', async () => {
    const p = await svc.projectFutureEmissions(new Date().getFullYear() + 1);
    expect(Array.isArray(p.projected)).toBe(true);
    expect(p.recommendations.length).toBeGreaterThan(0);
  });

  it('exposes a singleton instance', () => {
    expect(carbonAccountingService).toBeInstanceOf(CarbonAccountingService);
  });
});
