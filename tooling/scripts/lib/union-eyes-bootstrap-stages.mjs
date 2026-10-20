/**
 * Production drizzle bootstrap stages.
 *
 * Scoped migrations through 0013 create roles, grants, and RLS helpers.
 * Platform SQL creates objects that 0014's preflight requires.
 * Scoped 0014 and 0015 are the RLS closures and run after that DDL.
 * The producer graph imports this list. Do not describe a different order
 * in the runner.
 */

export const SCOPED_FOUNDATION_THROUGH_TAG = '0013_workbook_credential_payment_authority';
export const SCOPED_RLS_CLOSURE_TAG = '0014_lineage_restoration_rls_closure';

export const PRODUCTION_BOOTSTRAP_ORDER = [
  { id: 'extensions', lineage: 'postgres' },
  { id: 'snapshot_or_qa_baseline', lineage: 'orchestrator' },
  { id: 'scoped_foundation', lineage: 'scoped', throughTag: SCOPED_FOUNDATION_THROUGH_TAG },
  { id: 'platform_sql', lineage: 'platform' },
  { id: 'runtime_role_regrant', lineage: 'orchestrator' },
  { id: 'scoped_rls_closure', lineage: 'scoped', afterTag: SCOPED_FOUNDATION_THROUGH_TAG },
];

export function platformMigrationPrecedesScopedClosure() {
  const platformIndex = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'platform_sql');
  const closureIndex = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'scoped_rls_closure');
  return platformIndex !== -1 && closureIndex !== -1 && platformIndex < closureIndex;
}

export function tagsThrough(entries, throughTag) {
  const index = entries.findIndex((entry) => entry.tag === throughTag);
  if (index < 0) {
    throw new Error(`Tag ${throughTag} is not in the migration journal.`);
  }
  return entries.slice(0, index + 1).map((entry) => entry.tag);
}
