import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Wave 1 release-blocking floors. These pin the role each route requires so that a route cannot quietly be lowered back
// to the member floor: DEF-0B10-ORG-CAMPAIGN-ROWS-..., DEF-0B12-CRUD-TESTIMONIAL-ITEM-WRITES-..., DEF-0B8-HS-INCIDENT-ITEM-READ-...,
// DEF-0B8-HS-ANONYMOUS-REPORTER-STAMPED-IN-CREATED-BY.

const captured = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (opts: Record<string, unknown>) => {
    captured.calls.push(opts);
    return { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn(), PUT: vi.fn() };
  },
}));

const API = resolve(__dirname, '..');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : routeFiles(full);
    return entry === 'route.ts' ? [full] : [];
  });
}

describe('organizing campaign routes', () => {
  const files = routeFiles(join(API, 'organizing')).filter((f) => readFileSync(f, 'utf8').includes('organizingCampaigns'));

  it('finds the campaign routes', () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  it.each(files.map((f) => [f.slice(API.length)]))('%s reads and writes at the officer floor', (rel) => {
    const source = readFileSync(join(API, rel), 'utf8');
    expect(source).toMatch(/readRole:\s*'officer'/);
    expect(source).toMatch(/writeRole:\s*'officer'/);
    expect(source).not.toMatch(/(read|write)Role:\s*'member'/);
  });
});

describe('testimonial item route', () => {
  it('writes only with a content-management role', async () => {
    captured.calls.length = 0;
    await import('../testimonials/[id]/route');
    expect(captured.calls.at(-1)).toMatchObject({ writeRole: 'content_manager', itemRoute: true });
  });
});

describe('health and safety incident routes', () => {
  it('reads one incident only as a health and safety representative', async () => {
    captured.calls.length = 0;
    await import('../health-safety/incidents/[id]/route');
    expect(captured.calls.at(-1)).toMatchObject({ readRole: 'health_safety_rep' });
  });

  it('marks only a report filed as anonymous for anonymous attribution', async () => {
    captured.calls.length = 0;
    const mod = await import('../health-safety/incidents/route');
    const opts = captured.calls.at(-1) as { anonymousCreate: (v: Record<string, unknown>) => boolean; beforeCreate: (v: Record<string, unknown>) => Record<string, unknown> };
    const base = { description: 'd', locationDescription: 'l', organizationId: 'o', createdBy: 'user-1', incidentType: 'near_miss', severity: 'minor', incidentDate: '2026-03-01T10:00:00Z' };
    expect(opts.anonymousCreate(opts.beforeCreate({ ...base, isAnonymous: true }))).toBe(true);
    expect(opts.anonymousCreate(opts.beforeCreate({ ...base, isAnonymous: false }))).toBe(false);
    expect(opts.anonymousCreate(opts.beforeCreate({ ...base, isAnonymous: 'true' }))).toBe(false);
    expect(opts.anonymousCreate(opts.beforeCreate(base))).toBe(false);
    expect(mod.POST).toBeDefined();
  });

  it('drops the reporter identity from an anonymous report', async () => {
    captured.calls.length = 0;
    vi.resetModules();
    await import('../health-safety/incidents/route');
    const opts = captured.calls.at(-1) as { beforeCreate: (v: Record<string, unknown>) => Record<string, unknown> };
    const valid = { description: 'd', locationDescription: 'l', incidentType: 'near_miss', severity: 'minor', incidentDate: '2026-03-01T10:00:00Z', reportedByName: 'Jo' };
    const anonymous = opts.beforeCreate({ ...valid, isAnonymous: true });
    expect(anonymous.isAnonymous).toBe(true);
    expect(anonymous.reportedByName).toBeUndefined();
    expect(opts.beforeCreate({ ...valid, isAnonymous: false }).reportedByName).toBe('Jo');
  });
});
