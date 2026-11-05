import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B7-EXC-AI-ROUTES-APPLY-NO-FEATURE-GATE-SAFETY-CHECK-OR-USER-RATE-LIMIT and DEF-0B2-AI-DATA-CLASS-DOWNGRADE (route side): every route under /api/ai
// that calls a model is behind a feature gate, the AI safety check and a rate limit, in that handler. A new AI route cannot be added without them.
// cache-stats reads platform cache counters and is a platform-administrator route instead.
const AI = path.resolve(__dirname, '../../../app/api/ai');
const PLATFORM_ONLY = new Set(['cache-stats']);

function routes(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routes(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('every AI route is gated, safety-checked and rate limited', () => {
  const files = routes(AI).map((file) => ({ name: path.relative(AI, path.dirname(file)).split(path.sep).join('/'), text: readFileSync(file, 'utf8') }));

  it('finds the AI routes', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it.each(files.filter((f) => !PLATFORM_ONLY.has(f.name)).map((f) => [f.name, f.text] as const))('%s', (_name, text) => {
    expect(text).toMatch(/guardAiFeature|requireAiFeature/);
    expect(text).toMatch(/enforceAISafety/);
    expect(text).toMatch(/checkRateLimit|rateLimit/);
  });

  it('cache-stats requires system administrator authority and is audited', () => {
    const text = files.find((f) => f.name === 'cache-stats')!.text;
    expect(text).toContain('withSystemAdminAuth');
    expect(text).toContain('performAuditedOperation');
  });
});
