/**
 * Nzila OS — ML Registry + Scores tables
 *
 * Tables:
 *   mlDatasets         — dataset snapshots with sha256 + blob document ref
 *   mlModels           — versioned model registry (draft/active/retired)
 *   mlTrainingRuns     — training run ledger with artifact refs
 *   mlInferenceRuns    — inference run ledger with output artifact ref
 *   mlScoresStripeDaily  — daily aggregate anomaly scores
 *   mlScoresStripeTxn    — per-transaction anomaly scores (Option B)
 *
 * All tables are entity-scoped. Apps access data through @nzila/ml-sdk,
 * never by importing these tables directly.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  integer,
  numeric,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'
import { documents } from './operations'

// ── Enums ────────────────────────────────────────────────────────────────────

export const mlModelStatusEnum = pgEnum('ml_model_status', ['draft', 'active', 'retired'])
export const mlRunStatusEnum = pgEnum('ml_run_status', ['started', 'success', 'failed'])

// ── A) mlDatasets ─────────────────────────────────────────────────────────────

export const mlDatasets = pgTable(
  'ml_datasets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    /** e.g., stripe_daily_metrics_v1 | stripe_txn_features_v1 */
    datasetKey: text('dataset_key').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    rowCount: integer('row_count').notNull().default(0),
    /** FK → documents.id: the blob-stored CSV snapshot */
    snapshotDocumentId: uuid('snapshot_document_id').references(() => documents.id),
    /** Column metadata and dtypes */
    schemaJson: jsonb('schema_json'),
    /** CLI/code config used to build this snapshot */
    buildConfigJson: jsonb('build_config_json'),
    sha256: text('sha256').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ml_datasets_entity_key_idx').on(table.entityId, table.datasetKey),
    index('ml_datasets_entity_period_idx').on(table.entityId, table.periodStart, table.periodEnd),
  ],
)

// ── B) mlModels ───────────────────────────────────────────────────────────────

export const mlModels = pgTable(
  'ml_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    /** e.g., stripe_anomaly_daily_iforest_v1 | stripe_anomaly_txn_iforest_v1 */
    modelKey: text('model_key').notNull(),
    algorithm: text('algorithm').notNull().default('isolation_forest'),
    version: integer('version').notNull().default(1),
    status: mlModelStatusEnum('status').notNull().default('draft'),
    /** FK → mlDatasets.id the model was trained on */
    trainingDatasetId: uuid('training_dataset_id').references(() => mlDatasets.id),
    /** FK → documents.id: serialised .joblib artifact in Blob */
    artifactDocumentId: uuid('artifact_document_id').references(() => documents.id),
    /** FK → documents.id: metrics JSON in Blob */
    metricsDocumentId: uuid('metrics_document_id').references(() => documents.id),
    hyperparamsJson: jsonb('hyperparams_json').notNull().default({}),
    /** FeatureSpec: numeric_features, categorical_features, encoding_maps, scaler_params */
    featureSpecJson: jsonb('feature_spec_json'),
    approvedBy: text('approved_by'), // clerk_user_id
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ml_models_entity_key_version_idx').on(
      table.entityId,
      table.modelKey,
      table.version,
    ),
    index('ml_models_entity_status_idx').on(table.entityId, table.status),
  ],
)

// ── C) mlTrainingRuns ─────────────────────────────────────────────────────────

export const mlTrainingRuns = pgTable(
  'ml_training_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    modelKey: text('model_key').notNull(),
    datasetId: uuid('dataset_id').references(() => mlDatasets.id),
    status: mlRunStatusEnum('status').notNull().default('started'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** FK → documents.id: training log artifact */
    logsDocumentId: uuid('logs_document_id').references(() => documents.id),
    /** FK → documents.id: metrics JSON after training */
    metricsDocumentId: uuid('metrics_document_id').references(() => documents.id),
    /** FK → documents.id: .joblib artifact */
    artifactDocumentId: uuid('artifact_document_id').references(() => documents.id),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ml_training_runs_entity_key_idx').on(table.entityId, table.modelKey)],
)

// ── D) mlInferenceRuns ────────────────────────────────────────────────────────

export const mlInferenceRuns = pgTable(
  'ml_inference_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    /** FK → mlModels.id */
    modelId: uuid('model_id')
      .notNull()
      .references(() => mlModels.id),
    status: mlRunStatusEnum('status').notNull().default('started'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    inputPeriodStart: date('input_period_start').notNull(),
    inputPeriodEnd: date('input_period_end').notNull(),
    /** FK → documents.id: scored output CSV */
    outputDocumentId: uuid('output_document_id').references(() => documents.id),
    /** { totalRows, anomalyCount, threshold, scoreMin, scoreMax } */
    summaryJson: jsonb('summary_json').notNull().default({}),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ml_inference_runs_entity_model_idx').on(table.entityId, table.modelId),
    index('ml_inference_runs_period_idx').on(table.inputPeriodStart, table.inputPeriodEnd),
  ],
)

// ── E) mlScoresStripeDaily ────────────────────────────────────────────────────

export const mlScoresStripeDaily = pgTable(
  'ml_scores_stripe_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    date: date('date').notNull(),
    featuresJson: jsonb('features_json').notNull().default({}),
    score: numeric('score', { precision: 12, scale: 6 }).notNull(),
    isAnomaly: boolean('is_anomaly').notNull().default(false),
    threshold: numeric('threshold', { precision: 12, scale: 6 }).notNull(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => mlModels.id),
    inferenceRunId: uuid('inference_run_id').references(() => mlInferenceRuns.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ml_scores_stripe_daily_entity_date_model_idx').on(
      table.entityId,
      table.date,
      table.modelId,
    ),
    index('ml_scores_stripe_daily_anomaly_idx').on(table.entityId, table.isAnomaly),
  ],
)

// ── F) mlScoresStripeTxn (Option B — transaction-level) ───────────────────────

export const mlScoresStripeTxn = pgTable(
  'ml_scores_stripe_txn',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id),
    /** Stripe webhook event_id if available */
    stripeEventId: text('stripe_event_id'),
    /** charge_id from Stripe */
    stripeChargeId: text('stripe_charge_id'),
    /** payment_intent_id from Stripe */
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    /** balance_transaction_id from Stripe */
    stripeBalanceTxnId: text('stripe_balance_txn_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    currency: text('currency').notNull().default('cad'),
    /** Transaction amount in major currency units (e.g., 12.50), signed */
    amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
    /** Model-ready feature vector (no PII) */
    featuresJson: jsonb('features_json').notNull().default({}),
    /** IsolationForest anomaly score (lower = more anomalous) */
    score: numeric('score', { precision: 12, scale: 6 }).notNull(),
    isAnomaly: boolean('is_anomaly').notNull().default(false),
    threshold: numeric('threshold', { precision: 12, scale: 6 }).notNull(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => mlModels.id),
    inferenceRunId: uuid('inference_run_id').references(() => mlInferenceRuns.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ml_scores_stripe_txn_entity_time_idx').on(table.entityId, table.occurredAt),
    index('ml_scores_stripe_txn_anomaly_idx').on(table.entityId, table.isAnomaly),
    index('ml_scores_stripe_txn_pi_idx').on(table.entityId, table.stripePaymentIntentId),
  ],
)
