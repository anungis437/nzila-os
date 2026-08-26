/**
 * Regression test: the deadline-tracking-system scheduleReminders() no-op
 * MUST NEVER return without producing at least a scheduler invocation.
 *
 * Prior state (pre Wave 1 Phase A): the function only cancelled existing
 * reminders and logged a warn — every "reminder created" was silently
 * dropped. Any regression that reintroduces the no-op MUST cause this test
 * to fail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const trackingFile = resolve(__dirname, '..', '..', 'deadline-tracking-system.ts');

describe('deadline-tracking-system: scheduleReminders no-op regression', () => {
  const source = readFileSync(trackingFile, 'utf-8');

  it('MUST import scheduleGrievanceDeadlineReminders from the deadline engine', () => {
    expect(source).toMatch(/scheduleGrievanceDeadlineReminders/);
    expect(source).toMatch(/from ['"]@\/lib\/deadline-engine['"]/);
  });

  it('MUST NOT contain the no-op warning string', () => {
    expect(source).not.toMatch(/scheduleReminders is a no-op/);
    expect(source).not.toMatch(/new reminder notifications are NOT being created/);
  });

  it('scheduleReminders body MUST call scheduleGrievanceDeadlineReminders', () => {
    const scheduleReminders = source.match(
      /async function scheduleReminders[\s\S]*?\n\}\n/,
    );
    expect(scheduleReminders, 'scheduleReminders function must exist').toBeTruthy();
    expect(scheduleReminders?.[0]).toMatch(/scheduleGrievanceDeadlineReminders\s*\(/);
  });
});
