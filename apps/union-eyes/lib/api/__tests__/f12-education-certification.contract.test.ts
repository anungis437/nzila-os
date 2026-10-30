import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(process.cwd(), 'app', 'api');
const read = (route: string) => readFileSync(join(API, ...route.split('/'), 'route.ts'), 'utf8');

describe('F12 certification issue needs a verified completion', () => {
  // DEF-0B6-EDU-CERTIFICATION-ISSUED-WITHOUT-COMPLETION-OR-VERIFICATION
  it('a certification is created only from a completed, passed registration of the organization, as a pending candidate', () => {
    const text = read('education/certifications');
    expect(text).toContain('eq(courseRegistrations.completed, true)');
    expect(text).toContain('eq(courseRegistrations.passed, true)');
    expect(text).toContain('eq(courseRegistrations.organizationId, organizationId)');
    expect(text).toContain("certificationStatus: 'pending_verification'");
    expect(text).toContain('verified: false');
    expect(text).toContain('verifiedBy: null');
  });
});
