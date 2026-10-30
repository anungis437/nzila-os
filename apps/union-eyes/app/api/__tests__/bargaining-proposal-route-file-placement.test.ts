/** Prevent route/test path inversions when integrating Gate 0 remediation branches. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const api = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(api, path), 'utf8');

describe('bargaining proposal route build contract', () => {
  it('keeps the Next.js route as the real handler, never a Vitest fixture', () => {
    const route = read('bargaining/proposals/[id]/route.ts');
    expect(route).toContain("from '@/lib/api/crud-factory'");
    expect(route).toContain('crudRoutes({');
    expect(route).toMatch(/export\s*\{\s*GET,\s*PATCH,\s*DELETE\s*\}/);
    expect(route).not.toMatch(/from ['"]vitest['"]/);
    expect(route).not.toMatch(/\bdescribe\(/);
  });

  it('keeps the negative path tests in __tests__, not a routable file', () => {
    const test = read('__tests__/bargaining-proposal-delete-parent-boundary.test.ts');
    expect(test).toContain("from 'vitest'");
    expect(test).toContain("describe('bargaining proposal DELETE");
    expect(test).not.toContain('export const dynamic');
    expect(test).not.toMatch(/export\s*\{\s*GET,\s*PATCH,\s*DELETE\s*\}/);
  });
});
