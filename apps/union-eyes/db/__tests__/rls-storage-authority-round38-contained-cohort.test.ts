/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 38: parameterized cohort matrix proving the first
 * CONTAINED_NO_AUTHORITY dispositions (donation_receipts,
 * payment_classification_policy) mechanically, rather than one bespoke
 * test file per table. A single shared reachability ratchet plus one
 * table-specific operation assertion proves the whole cohort — see
 * scripts/generate-storage-authority-census.ts's doc comment for the
 * broader "close by cohort, not one table at a time" doctrine this round
 * introduces.
 *
 * NOTE: ai_budgets was considered for this cohort but excluded — its
 * Drizzle export (aiBudgets) IS directly referenced by
 * lib/ai/services/cost-tracking-wrapper.ts and rate-limiter.ts (those
 * files' own *callers* are unreachable, per the round-35 finding, but
 * that is a transitive-reachability proof this census's simple "zero
 * direct symbol references" bar does not establish). It remains
 * NEEDS_REVIEW; do not add it here without redoing that deeper trace.
 *
 * Any future CONTAINED_NO_AUTHORITY promotion should be added as a new
 * row to COHORT below rather than a new standalone test file, as long as
 * its Django ViewSet + model live in the union-eyes backend and its TS
 * side has zero direct production references to the Drizzle export.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';
import { toPascalCase, findDjangoModel, realImporterFiles } from '../../scripts/generate-storage-authority-census';

const APP_ROOT = resolve(__dirname, '..', '..');

interface CohortRow {
  table: string;
  djangoAppFile: string;
}

const COHORT: CohortRow[] = [
  { table: 'donation_receipts', djangoAppFile: 'backend/billing/views.py' },
  { table: 'payment_classification_policy', djangoAppFile: 'backend/billing/views.py' },
];

describe.each(COHORT)('round 38 CONTAINED_NO_AUTHORITY cohort: $table', ({ table, djangoAppFile }) => {
  it('is classified CONTAINED_NO_AUTHORITY with the strict-zero authority shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry, `${table}: no manifest entry found`).toBeTruthy();
    expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry!.requiredRuntimePrivileges).toEqual([]);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('NONE');
    expect(entry!.dbExecutionPrincipal).toBe('NONE');
    expect(entry!.reviewPriority).toBe('NONE');
  });

  it('the Django ViewSet is router-registered (reachable) but uses an unconditional deny-all permission', () => {
    const pascalName = toPascalCase(table);
    const django = findDjangoModel(pascalName);
    expect(django, `${table}: no Django model found for ${pascalName}`).toBeTruthy();
    expect(django!.modelFile).toBe(djangoAppFile.replace('views.py', 'models.py'));
    expect(django!.routerRegistered, `${table}: Django ViewSet must remain reachable (router-registered), not merely absent`).toBe(true);
    expect(django!.usesDenyAll, `${table}: Django ViewSet must use an unconditional deny-all permission`).toBe(true);
  });

  it('has zero real production TS/TSX consumers of the table\'s Drizzle export (reachability ratchet)', () => {
    // Mirrors the round-38 census's own TS-reachability check exactly —
    // if this ever finds a real importer, CONTAINED_NO_AUTHORITY is
    // automatically invalidated per its doctrine (types.ts) and this
    // entry must revert to NEEDS_REVIEW before shipping.
    const camelName = table.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const importers = realImporterFiles(`\\b${camelName}\\b`, ['*.ts', '*.tsx']);
    expect(importers, `${table}: a new production consumer appeared — CONTAINED_NO_AUTHORITY is invalidated, revert to NEEDS_REVIEW`).toEqual([]);
  });

  it('the Django ViewSet source is unchanged from the deny-all permission the manifest reason cites', () => {
    const src = readFileSync(resolve(APP_ROOT, djangoAppFile), 'utf8');
    const pascalName = toPascalCase(table);
    const viewSetName = `${pascalName}ViewSet`;
    const classStart = src.indexOf(`class ${viewSetName}(`);
    expect(classStart, `${table}: ${viewSetName} not found in ${djangoAppFile}`).toBeGreaterThan(-1);
    const nextClassStart = src.indexOf('\nclass ', classStart + 1);
    const classBlock = src.slice(classStart, nextClassStart === -1 ? undefined : nextClassStart);
    expect(classBlock).toMatch(/permission_classes\s*=\s*\[\s*\w*DenyAllPermission\s*\]/);
  });
});
