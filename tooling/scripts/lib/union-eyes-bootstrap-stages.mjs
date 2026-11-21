/**
 * Production drizzle bootstrap stages.
 *
 * Scoped migrations through 0013 create roles, grants, and RLS helpers.
 * Runtime DML on relations without FORCE RLS is quarantined before later
 * DDL, unless every scoped RLS closure hash is already recorded.
 * Platform SQL creates objects that 0014's preflight requires.
 * Scoped 0014 through 0019 are the RLS closures.
 * Exact manifest grants are activated only after those closure hashes exist
 * and the current catalog passes the privilege preflight.
 * The producer graph imports this list. Do not describe a different order
 * in the runner.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCOPED_FOUNDATION_THROUGH_TAG = '0013_workbook_credential_payment_authority';
export const SCOPED_RLS_CLOSURE_TAG = '0014_lineage_restoration_rls_closure';
export const SCOPED_RLS_CLOSURE_TAGS = [
  '0014_lineage_restoration_rls_closure',
  '0015_deadline_engine_rls_fail_closed_closure',
  '0016_catalog_rls_authority_closure',
  '0017_snapshot_authority_reconciliation',
  '0018_knowledge_transfer_rls_closure',
  '0019_deadline_reassignment_convergence',
  '0020_authority_kernel_rls_closure',
  '0021_message_thread_triage_rls_closure',
];

export const PRODUCTION_BOOTSTRAP_ORDER = [
  { id: 'extensions', lineage: 'postgres' },
  { id: 'snapshot_or_qa_baseline', lineage: 'orchestrator' },
  { id: 'scoped_foundation', lineage: 'scoped', throughTag: SCOPED_FOUNDATION_THROUGH_TAG },
  { id: 'runtime_privilege_quarantine', lineage: 'orchestrator' },
  { id: 'platform_sql', lineage: 'platform' },
  { id: 'scoped_rls_closure', lineage: 'scoped', afterTag: SCOPED_FOUNDATION_THROUGH_TAG },
  { id: 'runtime_grant_activation', lineage: 'orchestrator', securityProfile: 'CURRENT_SOURCE_AUTH_FRAMEWORK_CASE', atomic: true },
];

export function platformMigrationPrecedesScopedClosure() {
  const platformIndex = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'platform_sql');
  const closureIndex = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'scoped_rls_closure');
  return platformIndex !== -1 && closureIndex !== -1 && platformIndex < closureIndex;
}

export function runtimeGrantsFollowSecurityClosure() {
  const quarantine = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'runtime_privilege_quarantine');
  const closure = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'scoped_rls_closure');
  const activation = PRODUCTION_BOOTSTRAP_ORDER.findIndex((stage) => stage.id === 'runtime_grant_activation');
  const stage = PRODUCTION_BOOTSTRAP_ORDER[activation];
  return quarantine !== -1 && quarantine < closure && closure < activation
    && stage?.securityProfile === 'CURRENT_SOURCE_AUTH_FRAMEWORK_CASE' && stage.atomic === true;
}

/** One connection and one transaction contain the current security transition.
 * A failed catalog/admission check rolls back every role, ACL and guard change.
 */
export async function runCurrentSecurityBootstrapStage(client, install, options) {
  await client.query('BEGIN');
  try {
    const report = await install(client, options);
    await client.query('COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Keep the real installer, its mixed TS/CJS dependency graph, and the caller's
 * transaction in this process. Hooks and configuration last only for the call. */
let currentSecurityLoaderActive = false;

export function currentSecurityInstallerExport(loaded) {
  const key = 'installUnionEyesCurrentSecurity';
  const hasNamed = Object.hasOwn(loaded, key);
  const hasCjs = loaded.default !== null && typeof loaded.default === 'object' && Object.hasOwn(loaded.default, key);
  const named = hasNamed ? loaded[key] : undefined;
  const cjs = hasCjs ? loaded.default[key] : undefined;
  if ((hasNamed && typeof named !== 'function') || (hasCjs && typeof cjs !== 'function'))
    throw new Error('Current source security installer export is not a function');
  if (hasNamed && hasCjs && named !== cjs) throw new Error('Current source security installer exports are ambiguous');
  const install = hasNamed ? named : cjs;
  if (typeof install !== 'function') throw new Error('Current source security installer export is missing');
  return install;
}

export async function withCurrentSecurityInstaller(repoRoot, run) {
  if (currentSecurityLoaderActive) throw new Error('Concurrent current security loader is refused');
  const tsconfig = path.join(repoRoot, 'apps/union-eyes/tsconfig.json');
  const previousTsconfig = process.env.TSX_TSCONFIG_PATH;
  currentSecurityLoaderActive = true;
  let unregisterCjs, unregisterEsm;
  try {
    const [{ register: registerEsm }, { register: registerCjs }] = await Promise.all([
      import('tsx/esm/api'), import('tsx/cjs/api'),
    ]);
    process.env.TSX_TSCONFIG_PATH = tsconfig;
    unregisterCjs = registerCjs();
    unregisterEsm = registerEsm({ tsconfig });
    const loaded = await import(pathToFileURL(path.join(repoRoot, 'tooling/scripts/lib/union-eyes-current-security-installer.ts')).href);
    // Node exposes this checkout's CommonJS-transformed TS exports through
    // default; an ESM checkout exposes the same named source export directly.
    const installUnionEyesCurrentSecurity = currentSecurityInstallerExport(loaded);
    return await run(installUnionEyesCurrentSecurity);
  } finally {
    try {
      if (unregisterEsm) await unregisterEsm();
    } finally {
      try { unregisterCjs?.(); } finally {
        if (previousTsconfig === undefined) delete process.env.TSX_TSCONFIG_PATH;
        else process.env.TSX_TSCONFIG_PATH = previousTsconfig;
        currentSecurityLoaderActive = false;
      }
    }
  }
}

export function tagsThrough(entries, throughTag) {
  const index = entries.findIndex((entry) => entry.tag === throughTag);
  if (index < 0) {
    throw new Error(`Tag ${throughTag} is not in the migration journal.`);
  }
  return entries.slice(0, index + 1).map((entry) => entry.tag);
}
