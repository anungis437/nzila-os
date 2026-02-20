/**
 * @nzila/ml-core — Model Registry helpers
 *
 * Server-side utilities for reading/writing ML model registry from DB.
 * Never imported by apps directly; apps use @nzila/ml-sdk.
 */
import { db } from '@nzila/db'
import { mlModels, mlDatasets } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { MlModelKey, MlModelStatus } from './types'

/**
 * Return the latest active model for a given entityId + modelKey.
 * Returns null if none exists.
 */
export async function getActiveModel(entityId: string, modelKey: MlModelKey) {
  const rows = await db
    .select()
    .from(mlModels)
    .where(
      and(
        eq(mlModels.entityId, entityId),
        eq(mlModels.modelKey, modelKey),
        eq(mlModels.status, 'active' as MlModelStatus),
      ),
    )
    .orderBy(desc(mlModels.version))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Return all models for a given entityId, ordered by modelKey asc + version desc.
 */
export async function listModels(entityId: string) {
  return db
    .select()
    .from(mlModels)
    .where(eq(mlModels.entityId, entityId))
    .orderBy(desc(mlModels.version))
}

/**
 * Activate a model by id (sets status = active, retires all others of same key).
 */
export async function activateModel(
  entityId: string,
  modelId: string,
  approvedBy: string,
): Promise<void> {
  const model = await db
    .select()
    .from(mlModels)
    .where(and(eq(mlModels.id, modelId), eq(mlModels.entityId, entityId)))
    .limit(1)
    .then((r) => r[0])

  if (!model) throw new Error(`Model ${modelId} not found for entity ${entityId}`)

  // Retire all other active versions of same key
  await db
    .update(mlModels)
    .set({ status: 'retired', updatedAt: new Date() })
    .where(
      and(
        eq(mlModels.entityId, entityId),
        eq(mlModels.modelKey, model.modelKey),
        eq(mlModels.status, 'active'),
      ),
    )

  // Activate target
  await db
    .update(mlModels)
    .set({ status: 'active', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(mlModels.id, modelId))
}

/**
 * Retire a model by id.
 */
export async function retireModel(entityId: string, modelId: string): Promise<void> {
  await db
    .update(mlModels)
    .set({ status: 'retired', updatedAt: new Date() })
    .where(and(eq(mlModels.id, modelId), eq(mlModels.entityId, entityId)))
}

/**
 * Get dataset by id.
 */
export async function getDataset(entityId: string, datasetId: string) {
  const rows = await db
    .select()
    .from(mlDatasets)
    .where(and(eq(mlDatasets.id, datasetId), eq(mlDatasets.entityId, entityId)))
    .limit(1)
  return rows[0] ?? null
}
