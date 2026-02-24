/**
 * ML Predictions Schema
 * Machine learning predictions and model metadata
 */

import {
  pgTable,
  uuid,
  varchar,
  _text,
  timestamp,
  decimal,
  integer,
  jsonb,
  _boolean,
  index,
  unique
} from "drizzle-orm/pg-core";
import { organizations } from "../schema-organizations";

// ============================================================================
// ML PREDICTIONS
// ============================================================================

export const mlPredictions = pgTable("ml_predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  predictionType: varchar("prediction_type", { length: 50 }).notNull(), // 'workload_forecast', 'churn_risk', etc.
  predictionDate: timestamp("prediction_date", { mode: 'date' }).notNull(),
  predictedValue: decimal("predicted_value").notNull(),
  lowerBound: decimal("lower_bound"),
  upperBound: decimal("upper_bound"),
  confidence: decimal("confidence"), // 0-100
  horizon: integer("horizon"), // 30, 60, 90 days
  granularity: varchar("granularity", { length: 20 }), // 'daily', 'weekly'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_ml_predictions_organization").on(table.organizationId),
  typeIdx: index("idx_ml_predictions_type").on(table.predictionType),
  dateIdx: index("idx_ml_predictions_date").on(table.predictionDate),
  // Unique constraint for organization + type + date + horizon
  uniquePrediction: unique("unique_prediction").on(table.organizationId, table.predictionType, table.predictionDate, table.horizon),
}));

// ============================================================================
// MODEL METADATA
// ============================================================================

export const modelMetadata = pgTable("model_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  modelType: varchar("model_type", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  accuracy: decimal("accuracy"),
  trainedAt: timestamp("trained_at").notNull().defaultNow(),
  parameters: jsonb("parameters"),
}, (table) => ({
  organizationIdx: index("idx_model_metadata_organization").on(table.organizationId),
  typeIdx: index("idx_model_metadata_type").on(table.modelType),
  // Unique constraint for organization + type + version
  uniqueModel: unique("unique_model").on(table.organizationId, table.modelType, table.version),
}));

// ============================================================================
// TYPES
// ============================================================================

export type MlPrediction = typeof mlPredictions.$inferSelect;
export type InsertMlPrediction = typeof mlPredictions.$inferInsert;

export type ModelMetadata = typeof modelMetadata.$inferSelect;
export type InsertModelMetadata = typeof modelMetadata.$inferInsert;

