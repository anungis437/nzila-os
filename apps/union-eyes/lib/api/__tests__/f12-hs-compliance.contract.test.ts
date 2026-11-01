import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(fileURLToPath(new URL('../../../', import.meta.url)), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

// DEF-0B8-HS-TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT (the same fallback in the sibling statistics routes)
describe('health and safety aggregates never run without an organization', () => {
  it.each([
    'health-safety/stats',
    'health-safety/hazards/stats',
    'health-safety/incidents/stats',
    'health-safety/inspections/stats',
    'health-safety/inspections/findings',
  ])('%s refuses a missing organization and keeps no unscoped fallback', (route) => {
    const text = read(route);
    expect(text).not.toContain('sql`1=1`');
    expect(text).toContain("throw ApiError.badRequest('Organization context required')");
    expect(text.indexOf('Organization context required')).toBeLessThan(text.indexOf('orgFilter'));
  });
});

describe('compliance validation states no verdict from typed figures', () => {
  // DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA
  it('has no compliant or violation status and no embedded threshold table', () => {
    const text = read('compliance/validate');
    expect(text).not.toMatch(/status: '(compliant|violation|warning)',/);
    expect(text).not.toMatch(/thresholds\s*[:=]/);
    expect(text).toContain('not a finding of compliance');
  });
});
