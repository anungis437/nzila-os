/**
 * Union Eyes — staging proof ledger (UE-CONV-H-016).
 *
 * The HMAC-gated staging proof harness (POST /api/staging-proof/deadline-engine/scenario, lib/staging-proof/ledger.ts) records every run it makes: the single-use
 * nonce it was authorized with, the run, and the events that open and close it. These three relations existed only in the DDL of the route's PGlite test, so the
 * harness could not start on a real database. They hold no tenant data (a proof run makes and retires its own synthetic organization), so they carry no
 * organization column: SYSTEM_ONLY, written and read by the system role and never by the tenant runtime role.
 *
 * Created by platform migration 0078 (generated from these declarations with scripts/generate-relation-create.ts); row security by cache migration 0054.
 */
import { boolean, check, foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** A nonce is accepted once: the primary key refuses its second use. */
export const stagingProofNonceUses = pgTable(
  'staging_proof_nonce_uses',
  {
    nonce: text('nonce').primaryKey(),
    proofRunId: uuid('proof_run_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_staging_proof_nonce_uses_expires').on(table.expiresAt)],
);

/** One run per nonce. It starts as `started` and is settled once: `completed`, `failed` or `cleanup_failed`, and only then has a finalized time. */
export const stagingProofRuns = pgTable(
  'staging_proof_runs',
  {
    id: uuid('id').primaryKey(),
    nonce: text('nonce').notNull(),
    scenario: text('scenario').notNull(),
    correlationId: text('correlation_id').notNull(),
    status: text('status').notNull(),
    cleanupPassed: boolean('cleanup_passed'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: 'staging_proof_runs_nonce_fk', columns: [table.nonce], foreignColumns: [stagingProofNonceUses.nonce] }),
    uniqueIndex('staging_proof_runs_nonce_uidx').on(table.nonce),
    check('staging_proof_runs_status_valid', sql`${table.status} IN ('started', 'completed', 'failed', 'cleanup_failed')`),
    check('staging_proof_runs_finalized_when_settled', sql`(${table.status} = 'started') = (${table.finalizedAt} IS NULL)`),
  ],
);

/** Append-only evidence: the system role may add events and read them, never change or remove one. */
export const stagingProofRunEvents = pgTable(
  'staging_proof_run_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proofRunId: uuid('proof_run_id').notNull(),
    scenario: text('scenario').notNull(),
    eventType: text('event_type').notNull(),
    correlationId: text('correlation_id').notNull(),
    createdIdentifiers: jsonb('created_identifiers'),
    expectedOutcome: jsonb('expected_outcome'),
    actualOutcome: jsonb('actual_outcome'),
    cleanupPassed: boolean('cleanup_passed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ name: 'staging_proof_run_events_run_fk', columns: [table.proofRunId], foreignColumns: [stagingProofRuns.id] }),
    index('idx_staging_proof_run_events_run').on(table.proofRunId),
    check('staging_proof_run_events_type_valid', sql`${table.eventType} IN ('started', 'completed', 'failed', 'cleanup_failed')`),
  ],
);
