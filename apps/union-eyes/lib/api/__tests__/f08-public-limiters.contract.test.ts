import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API = join(process.cwd(), 'app', 'api');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : routeFiles(full);
    return name === 'route.ts' ? [full] : [];
  });
}

// DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS / DEF-0B10-PIL-PUBLIC-APPLICATION-RATE-LIMIT-IS-KEYED-ON-THE-FIRST-FORWARDED-FOR-VALUE-THE-CLIENT-CAN-SUPPLY
describe('unauthenticated public routes use the shared limiter and the trusted client address', () => {
  const files = ['icra', 'workbook', 'pilot', 'ocra'].flatMap((area) => {
    try { return routeFiles(join(API, area)); } catch { return []; }
  });

  it('finds the public route sets', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((file) => [file.slice(API.length + 1).replace(/\\/g, '/'), file]))('%s keeps no per-process counter and reads no client-typed address', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    expect(text).not.toMatch(/from '@\/lib\/rate-limit'/);
    expect(text).not.toMatch(/headers\.get\('x-forwarded-for'\)\?\.split/);
  });
});
