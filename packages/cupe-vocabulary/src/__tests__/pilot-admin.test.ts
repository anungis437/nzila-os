/**
 * Tests for pilot admin health-check logic — PR-060
 *
 * Validates runHealthChecks() across 7 check dimensions and buildPilotStatus().
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors
// ---------------------------------------------------------------------------

interface PilotConfiguration {
  vocabularyLoaded: boolean;
  orgConfigured: boolean;
  usersInvited: number;
  worksitesConfigured: number;
  slaThresholdsSet: boolean;
  auditTrailActive: boolean;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface PilotHealthCheck {
  overall: 'healthy' | 'degraded' | 'critical';
  checks: HealthCheck[];
  timestamp: string;
}

interface CaseSummary {
  total: number;
  open: number;
  resolved: number;
  overdueCount: number;
}

function runHealthChecks(config: PilotConfiguration, cases: CaseSummary): PilotHealthCheck {
  const checks: HealthCheck[] = [];

  // Vocabulary
  checks.push({
    name: 'vocabulary',
    status: config.vocabularyLoaded ? 'pass' : 'fail',
    message: config.vocabularyLoaded ? 'CUPE vocabulary loaded' : 'Vocabulary not loaded — cases cannot be filed',
  });

  // Organization
  checks.push({
    name: 'organization',
    status: config.orgConfigured ? 'pass' : 'fail',
    message: config.orgConfigured ? 'Organization configured' : 'Organization not configured',
  });

  // Users
  checks.push({
    name: 'users',
    status: config.usersInvited >= 2 ? 'pass' : config.usersInvited >= 1 ? 'warn' : 'fail',
    message: `${config.usersInvited} users invited (≥2 recommended)`,
  });

  // Worksites
  checks.push({
    name: 'worksites',
    status: config.worksitesConfigured >= 1 ? 'pass' : 'fail',
    message: `${config.worksitesConfigured} worksites configured`,
  });

  // SLA thresholds
  checks.push({
    name: 'sla-thresholds',
    status: config.slaThresholdsSet ? 'pass' : 'warn',
    message: config.slaThresholdsSet ? 'SLA thresholds configured' : 'Using default SLA thresholds',
  });

  // Audit trail
  checks.push({
    name: 'audit-trail',
    status: config.auditTrailActive ? 'pass' : 'fail',
    message: config.auditTrailActive ? 'Audit trail active' : 'Audit trail not active — compliance at risk',
  });

  // SLA compliance
  const compliance = cases.total > 0 ? cases.overdueCount / cases.total : 0;
  checks.push({
    name: 'sla-compliance',
    status: compliance <= 0.05 ? 'pass' : compliance <= 0.15 ? 'warn' : 'fail',
    message: `SLA compliance: ${Math.round((1 - compliance) * 100)}% (${cases.overdueCount} overdue of ${cases.total})`,
  });

  // Overall
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const overall = failCount > 0 ? 'critical' : warnCount > 0 ? 'degraded' : 'healthy';

  return { overall, checks, timestamp: new Date().toISOString() };
}

interface PilotStatus {
  health: PilotHealthCheck;
  metrics: CaseSummary;
  configuration: PilotConfiguration;
}

function buildPilotStatus(config: PilotConfiguration, cases: CaseSummary): PilotStatus {
  return { health: runHealthChecks(config, cases), metrics: cases, configuration: config };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const HEALTHY_CONFIG: PilotConfiguration = {
  vocabularyLoaded: true,
  orgConfigured: true,
  usersInvited: 3,
  worksitesConfigured: 2,
  slaThresholdsSet: true,
  auditTrailActive: true,
};

const HEALTHY_CASES: CaseSummary = { total: 50, open: 10, resolved: 40, overdueCount: 1 };

describe('runHealthChecks', () => {
  it('returns healthy when all checks pass', () => {
    const result = runHealthChecks(HEALTHY_CONFIG, HEALTHY_CASES);
    expect(result.overall).toBe('healthy');
    expect(result.checks.every(c => c.status === 'pass')).toBe(true);
  });

  it('returns critical when vocabulary not loaded', () => {
    const config = { ...HEALTHY_CONFIG, vocabularyLoaded: false };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.overall).toBe('critical');
    expect(result.checks.find(c => c.name === 'vocabulary')?.status).toBe('fail');
  });

  it('returns degraded when only one user invited', () => {
    const config = { ...HEALTHY_CONFIG, usersInvited: 1 };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.overall).toBe('degraded');
    expect(result.checks.find(c => c.name === 'users')?.status).toBe('warn');
  });

  it('returns critical when zero users', () => {
    const config = { ...HEALTHY_CONFIG, usersInvited: 0 };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.overall).toBe('critical');
    expect(result.checks.find(c => c.name === 'users')?.status).toBe('fail');
  });

  it('worksites fail when zero configured', () => {
    const config = { ...HEALTHY_CONFIG, worksitesConfigured: 0 };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.checks.find(c => c.name === 'worksites')?.status).toBe('fail');
  });

  it('SLA thresholds warn when using defaults', () => {
    const config = { ...HEALTHY_CONFIG, slaThresholdsSet: false };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.checks.find(c => c.name === 'sla-thresholds')?.status).toBe('warn');
    expect(result.overall).toBe('degraded');
  });

  it('audit trail fail when not active', () => {
    const config = { ...HEALTHY_CONFIG, auditTrailActive: false };
    const result = runHealthChecks(config, HEALTHY_CASES);
    expect(result.checks.find(c => c.name === 'audit-trail')?.status).toBe('fail');
    expect(result.overall).toBe('critical');
  });

  it('SLA compliance fails when >15% overdue', () => {
    const cases = { total: 10, open: 5, resolved: 5, overdueCount: 3 };
    const result = runHealthChecks(HEALTHY_CONFIG, cases);
    expect(result.checks.find(c => c.name === 'sla-compliance')?.status).toBe('fail');
  });

  it('SLA compliance warns when 5-15% overdue', () => {
    const cases = { total: 100, open: 30, resolved: 70, overdueCount: 10 };
    const result = runHealthChecks(HEALTHY_CONFIG, cases);
    expect(result.checks.find(c => c.name === 'sla-compliance')?.status).toBe('warn');
  });

  it('SLA compliance passes with no cases', () => {
    const cases = { total: 0, open: 0, resolved: 0, overdueCount: 0 };
    const result = runHealthChecks(HEALTHY_CONFIG, cases);
    expect(result.checks.find(c => c.name === 'sla-compliance')?.status).toBe('pass');
  });

  it('generates 7 checks total', () => {
    const result = runHealthChecks(HEALTHY_CONFIG, HEALTHY_CASES);
    expect(result.checks).toHaveLength(7);
  });

  it('includes a valid ISO timestamp', () => {
    const result = runHealthChecks(HEALTHY_CONFIG, HEALTHY_CASES);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

describe('buildPilotStatus', () => {
  it('includes health, metrics, and configuration', () => {
    const status = buildPilotStatus(HEALTHY_CONFIG, HEALTHY_CASES);
    expect(status.health.overall).toBe('healthy');
    expect(status.metrics).toEqual(HEALTHY_CASES);
    expect(status.configuration).toEqual(HEALTHY_CONFIG);
  });

  it('reflects degraded health from config changes', () => {
    const config = { ...HEALTHY_CONFIG, slaThresholdsSet: false };
    const status = buildPilotStatus(config, HEALTHY_CASES);
    expect(status.health.overall).toBe('degraded');
  });
});
