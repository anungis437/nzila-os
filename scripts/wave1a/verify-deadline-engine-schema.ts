#!/usr/bin/env tsx
/**
 * Wave 1 Phase A — deadline engine schema-drift check.
 *
 * Runs against a live database (uses `DATABASE_URL`) and asserts the
 * complete surface migration 0045_union_eyes_deadline_engine.sql was
 * supposed to leave behind is actually present, unaltered, with RLS
 * enabled and immutability triggers active.
 *
 * WHY THIS EXISTS
 *   - The evidence dossier at commit 32de2ef67 was invalid partly
 *     because we lacked a mechanism to prove the DB shape matches the
 *     migration file. Without this check, a partial or hand-modified
 *     schema can pass every application test yet break the lifecycle
 *     invariants (tenant isolation, immutable executions, pending
 *     uniqueness) at runtime.
 *   - Runs in CI (Wave 1 Phase A branch protection) and can be run
 *     locally against staging with the same command.
 *
 * FAILS on:
 *   - Missing table (deadline_reminders, deadline_reminder_executions,
 *     deadline_audit_events)
 *   - Missing critical column
 *   - Missing partial index (deadline_reminders_pending_uidx)
 *   - Missing provider-message idempotency index
 *   - RLS not enabled on any of the 3 tables
 *   - Tenant-isolation policy missing
 *   - Immutability trigger missing on executions or audit tables
 *   - Manifest checksum drift for 0045_union_eyes_deadline_engine.sql
 *
 * Usage:
 *   pnpm verify:deadline-engine-schema -- --static
 *   pnpm verify:deadline-engine-schema
 *
 * Env:
 *   DATABASE_URL   required unless --static is used
 *   MANIFEST_PATH  optional (defaults to migrations/migration-manifest.json)
 *   MIGRATIONS_DIR optional (defaults to migrations)
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';

interface Manifest {
  lockedThrough: string;
  migrations: Array<{ file: string; sha256: string }>;
}

interface Check {
  name: string;
  passed: boolean;
  detail?: unknown;
}

const REQUIRED_TABLES = [
  'deadline_reminders',
  'deadline_reminder_executions',
  'deadline_audit_events',
] as const;

const REQUIRED_MIGRATIONS = [
  '0045_union_eyes_deadline_engine.sql',
  '0046_union_eyes_staging_proof_controls.sql',
] as const;

const REQUIRED_COLUMNS: Record<string, string[]> = {
  deadline_reminders: [
    'id',
    'source_table',
    'source_deadline_id',
    'organization_id',
    'offset_days',
    'scheduled_for',
    'timezone',
    'reminder_kind',
    'status',
    'attempt_count',
    'max_attempts',
    'lease_owner',
    'lease_expires_at',
    'recipient_user_id',
    'recipient_role',
    'recipient_email',
    'recipient_email_hash',
    'recipient_locale',
    'provider',
    'provider_message_id',
    'cancelled_reason',
    'sent_at',
    'failed_at',
    'dead_lettered_at',
    'created_at',
    'updated_at',
  ],
  deadline_reminder_executions: [
    'id',
    'reminder_id',
    'organization_id',
    'attempt_number',
    'outcome',
    'provider',
    'provider_message_id',
    'provider_status_code',
    'error_code',
    'error_message',
    'duration_ms',
    'worker_instance',
    'correlation_id',
    'attempted_at',
  ],
  deadline_audit_events: [
    'id',
    'organization_id',
    'source_table',
    'source_deadline_id',
    'reminder_id',
    'event_type',
    'actor_type',
    'actor_id',
    'correlation_id',
    'metadata',
    'occurred_at',
  ],
};

const REQUIRED_INDEXES = [
  'deadline_reminders_pending_uidx',
  'deadline_reminders_provider_msg_uidx',
];

const REQUIRED_POLICIES = [
  { table: 'deadline_reminders', policy: 'deadline_reminders_tenant_isolation' },
  { table: 'deadline_reminder_executions', policy: 'deadline_reminder_executions_read' },
  { table: 'deadline_audit_events', policy: 'deadline_audit_events_tenant_isolation' },
];

const REQUIRED_TRIGGERS = [
  { table: 'deadline_reminders', trigger: 'trg_deadline_reminders_touch' },
  { table: 'deadline_reminder_executions', trigger: 'trg_deadline_reminder_executions_immutable' },
  { table: 'deadline_audit_events', trigger: 'trg_deadline_audit_events_immutable' },
];

async function main(): Promise<void> {
  const staticOnly = process.argv.includes('--static');
  const dbUrl = process.env.DATABASE_URL;
  if (!staticOnly && !dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const manifestPath = process.env.MANIFEST_PATH
    ?? resolve(process.cwd(), 'migrations/migration-manifest.json');
  const migrationsDir = process.env.MIGRATIONS_DIR ?? resolve(process.cwd(), 'migrations');

  const checks: Check[] = [];

  // 1. Manifest checksum for migration 0045.
  try {
    const manifest: Manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const migrationFile of REQUIRED_MIGRATIONS) {
      const entry = manifest.migrations.find((m) => m.file === migrationFile);
      if (!entry) {
        checks.push({ name: `manifest registers ${migrationFile}`, passed: false, detail: 'entry missing' });
        continue;
      }
      const contents = readFileSync(resolve(migrationsDir, entry.file), 'utf8').replace(/\r\n/g, '\n');
      const actual = createHash('sha256').update(contents).digest('hex');
      checks.push({
        name: `manifest checksum matches ${migrationFile}`,
        passed: actual === entry.sha256,
        detail: actual !== entry.sha256 ? { expected: entry.sha256, actual } : undefined,
      });
    }
    checks.push({
      name: 'manifest locked through staging proof controls',
      passed: manifest.lockedThrough >= '0046_union_eyes_staging_proof_controls.sql',
      detail: { lockedThrough: manifest.lockedThrough },
    });
  } catch (err) {
    checks.push({
      name: 'manifest readable',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  if (staticOnly) {
    const failed = checks.filter((check) => !check.passed);
    console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, ok: failed.length === 0, checks }, null, 2));
    if (failed.length) process.exit(1);
    return;
  }

  const sql = postgres(dbUrl!, { max: 2, ssl: 'require', prepare: false, idle_timeout: 5 });
  try {
    // 2. Tables present.
    for (const t of REQUIRED_TABLES) {
      const rows = await sql<{ ok: boolean }[]>`
        select exists(
          select 1 from information_schema.tables
           where table_schema = 'public' and table_name = ${t}
        ) as ok
      `;
      checks.push({ name: `table public.${t}`, passed: rows[0]?.ok === true });
    }

    // 3. Columns present.
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      const rows = await sql<{ column_name: string }[]>`
        select column_name from information_schema.columns
         where table_schema = 'public' and table_name = ${table}
      `;
      const found = new Set(rows.map((r) => r.column_name));
      const missing = cols.filter((c) => !found.has(c));
      checks.push({
        name: `columns present on ${table}`,
        passed: missing.length === 0,
        detail: missing.length ? { missing } : undefined,
      });
    }

    // 4. Indexes.
    for (const idx of REQUIRED_INDEXES) {
      const rows = await sql<{ ok: boolean }[]>`
        select exists(select 1 from pg_indexes where indexname = ${idx}) as ok
      `;
      checks.push({ name: `index ${idx}`, passed: rows[0]?.ok === true });
    }

    // 5. RLS enabled on all 3 tables.
    for (const t of REQUIRED_TABLES) {
      const rows = await sql<{ relrowsecurity: boolean }[]>`
        select relrowsecurity from pg_class
         where relname = ${t} and relnamespace = 'public'::regnamespace
      `;
      checks.push({
        name: `RLS enabled on ${t}`,
        passed: rows[0]?.relrowsecurity === true,
      });
    }

    // 6. Policies present.
    for (const { table, policy } of REQUIRED_POLICIES) {
      const rows = await sql<{ ok: boolean }[]>`
        select exists(
          select 1 from pg_policies
           where schemaname = 'public' and tablename = ${table} and policyname = ${policy}
        ) as ok
      `;
      checks.push({ name: `policy ${policy} on ${table}`, passed: rows[0]?.ok === true });
    }

    // 7. Triggers present.
    for (const { table, trigger } of REQUIRED_TRIGGERS) {
      const rows = await sql<{ ok: boolean }[]>`
        select exists(
          select 1 from information_schema.triggers
           where event_object_schema = 'public'
             and event_object_table = ${table}
             and trigger_name = ${trigger}
        ) as ok
      `;
      checks.push({ name: `trigger ${trigger} on ${table}`, passed: rows[0]?.ok === true });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  const failed = checks.filter((c) => !c.passed);
  const summary = {
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    ok: failed.length === 0,
    checks,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('verify-deadline-engine-schema failed:', err);
  process.exit(2);
});
