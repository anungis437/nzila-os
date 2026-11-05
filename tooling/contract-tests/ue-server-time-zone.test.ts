/**
 * UE-CONV-H-029: the Node server runs in UTC.
 *
 * A calendar day is stored as UTC midnight and the Django backend runs in UTC. The screens read a day through @/lib/client/day (the day-render census holds them at zero), but the
 * server renders days too (e-mails, receipts, invoices, PDFs) and groups by month or compares with now in whatever zone the host is set to. Nothing in the repository pins that
 * zone, so a host set to America/Toronto would print a contract that takes effect on 1 April as 31 March. The server pins its own zone before it reads a date.
 * This is a source check: the pin runs in the Next.js instrumentation hook, which no unit test starts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', 'apps', 'union-eyes');
const instrumentation = readFileSync(join(root, 'instrumentation.ts'), 'utf8');
const settings = readFileSync(join(root, 'backend', 'config', 'settings.py'), 'utf8');

describe('UE server time zone', () => {
  it('pins the Node server to UTC before anything else in register() runs', () => {
    const register = instrumentation.indexOf('export async function register()');
    const pin = instrumentation.indexOf("process.env.TZ = 'UTC'");
    const firstImport = instrumentation.indexOf('await import(');
    expect(register).toBeGreaterThan(-1);
    expect(pin).toBeGreaterThan(register);
    expect(firstImport).toBeGreaterThan(pin);
    // Only the Node runtime has a process environment to set.
    expect(instrumentation.slice(pin - 80, pin)).toContain("process.env.NEXT_RUNTIME === 'nodejs'");
  });

  it('is not left as a default an operator could override: the pin assigns, it does not fall back', () => {
    expect(instrumentation).not.toMatch(/process\.env\.TZ\s*(\?\?=|\|\|=)/);
  });

  it('agrees with the backend, which stores and serves UTC', () => {
    expect(settings).toMatch(/^TIME_ZONE = "UTC"$/m);
    expect(settings).toMatch(/^USE_TZ = True$/m);
  });
});
