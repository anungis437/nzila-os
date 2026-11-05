/**
 * Source-level privacy ratchet for the member-visible case history writer.
 * This is not a substitute for credentialed HTTP, RLS and timeline/export acceptance.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../route.ts', import.meta.url), 'utf8');
const historyStart = 'await tx.insert(claimUpdates).values({';
const historyEnd = '// The member is told in-app';
const history = source.split(historyStart)[1]?.split(historyEnd)[0] ?? '';

describe('case transition reason privacy boundary', () => {
  it('keeps the public status history but never copies the staff reason into the public row', () => {
    expect(history).not.toBe('');
    expect(history).toContain("visibilityScope: 'member'");
    expect(history).toContain('message: `Status changed: ${fromStatus} → ${toDbStatus}`');
    expect(history).not.toMatch(/Reason:|\breason\s*:\s*reason\b|\$\{reason\}/);
  });

  it('retains the reason in the restricted atomic audit, not the public history row', () => {
    const audit = source.split('await persistAtomicAudit(tx, {')[1]?.split('return {')[0] ?? '';
    expect(audit).toContain('reason: reason ?? null');
    expect(audit).toContain("action: 'case.transition'");
  });
});
