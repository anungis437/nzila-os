/**
 * ARTIFACT TYPE: Migration contract test (static)
 *
 * Proves 20260921_platform_payment_external_reference_uniqueness.sql (and its
 * rollback) install the canonical per-organization idempotency key
 * (organization_id, external_reference) WHERE external_reference IS NOT NULL,
 * fail safely on pre-existing duplicates, and never merge/delete financial
 * rows. Behavioral (SQL-engine) proof lives in
 * platform-payment-reservation-atomicity-pglite.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve(__dirname, '..', 'migrations');
const F = readFileSync(
  resolve(DIR, '20260921_platform_payment_external_reference_uniqueness.sql'),
  'utf8',
);
const R = readFileSync(
  resolve(DIR, '20260921_platform_payment_external_reference_uniqueness_rollback.sql'),
  'utf8',
);
const flat = (s: string) => s.replace(/\s+/g, ' ');
const Ff = flat(F);
const Rf = flat(R);

describe('20260921 platform payment external-reference uniqueness — forward', () => {
  it('creates the per-organization partial unique index on the right table/columns', () => {
    expect(Ff).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS platform_payments_org_external_reference_uq',
    );
    expect(Ff).toContain('ON platform_payments (organization_id, external_reference)');
    expect(Ff).toContain('WHERE external_reference IS NOT NULL');
  });

  it('is per-organization, not a global external_reference unique (avoids cross-org manual-ref collisions)', () => {
    expect(Ff).toContain('(organization_id, external_reference)');
    // No global single-column unique on external_reference alone.
    expect(Ff).not.toMatch(/UNIQUE INDEX[^;]*\(\s*external_reference\s*\)/i);
  });

  it('fails safely on pre-existing duplicates and never merges/deletes rows', () => {
    expect(Ff).toContain('HAVING count(*) > 1');
    expect(Ff).toContain('RAISE EXCEPTION');
    expect(Ff).not.toMatch(/DELETE\s+FROM\s+platform_payments/i);
    expect(Ff).not.toMatch(/UPDATE\s+platform_payments/i);
  });

  it('guards table existence (forward-only, environment-safe)', () => {
    expect(Ff).toContain("to_regclass('platform_payments')");
  });
});

describe('20260921 platform payment external-reference uniqueness — rollback', () => {
  it('drops exactly the forward index and nothing destructive', () => {
    expect(Rf).toContain('DROP INDEX IF EXISTS platform_payments_org_external_reference_uq');
    expect(Rf).not.toMatch(/DROP\s+TABLE/i);
    expect(Rf).not.toMatch(/DELETE\s+FROM/i);
  });
});
