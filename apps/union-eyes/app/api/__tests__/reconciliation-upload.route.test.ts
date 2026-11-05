import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B11-PRP-RECONCILIATION-BANK-AND-UPLOAD-PATHS-ARE-NAMED-FOR-BANK-FEEDS-BUT-LIST-RUNS-AND-EXCEPTIONS: the upload path listed exceptions and the bank
// path listed runs under names that promise a file intake and a bank feed. Neither exists, so both answer 501 behind the officer floor. Runs and exceptions
// are read through the reconciliation process and queue routes.
describe.each(['bank', 'upload'])('reconciliation/%s route', (name) => {
  const source = readFileSync(resolve(__dirname, '../reconciliation', name, 'route.ts'), 'utf8');

  it('answers 501 behind the officer floor and reads nothing', () => {
    expect(source).toContain('ApiError.notImplemented');
    expect(source).toContain("minRole: 'officer'");
    expect(source).not.toContain('listExceptions');
    expect(source).not.toContain('reconciliationRuns');
  });
});
