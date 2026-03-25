import * as schema from '../apps/union-eyes/db/schema/index';
import * as pkgDb from '../packages/db/src/schema/index';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

const targets = ['communication_preferences','billing_invoices','billing_payments','billing_subscriptions','security_events','security_posture_checks','customer_nps_surveys','customer_onboarding_milestones','integration_partners'];

// Check main schema
console.log('--- Main schema ---');
for (const [k, v] of Object.entries(schema)) {
  if (!is(v, PgTable)) continue;
  const tn = getTableName(v);
  if (targets.includes(tn)) console.log(`  ${k} -> ${tn}`);
}

// Check pkgDb
console.log('--- packages/db schema ---');
for (const [k, v] of Object.entries(pkgDb)) {
  if (!is(v, PgTable)) continue;
  const tn = getTableName(v);
  if (targets.includes(tn)) console.log(`  ${k} -> ${tn}`);
}

// Merged — same as audit script
const allExports: Record<string, unknown> = { ...schema, ...pkgDb };
console.log('\n--- Merged (before legacy) ---');
for (const [k, v] of Object.entries(allExports)) {
  if (!is(v, PgTable)) continue;
  const tn = getTableName(v);
  if (targets.includes(tn)) console.log(`  ${k} -> ${tn}`);
}

// Check if pkgDb overrides anything
const overridden = Object.keys(pkgDb).filter(k => k in schema && k !== '__esModule');
if (overridden.length > 0) {
  console.log(`\nWARNING: ${overridden.length} keys overridden by pkgDb`);
  for (const k of overridden.slice(0, 20)) {
    const mainIsPg = is(schema[k as keyof typeof schema], PgTable);
    const pkgIsPg = is(pkgDb[k as keyof typeof pkgDb], PgTable);
    if (mainIsPg !== pkgIsPg) console.log(`  CONFLICT: ${k} main=${mainIsPg ? 'PgTable' : typeof schema[k as keyof typeof schema]} pkg=${pkgIsPg ? 'PgTable' : typeof pkgDb[k as keyof typeof pkgDb]}`);
  }
}
console.log('Done');

