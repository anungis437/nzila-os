/**
 * Flow — Products (Spec §3B)
 *
 * Uses commerce_products from the shared commerce schema.
 *
 * Column mapping (spec → actual):
 *   id                     → id (uuid)
 *   org_id                 → orgId (uuid FK)
 *   sku                    → sku (varchar)
 *   name                   → name (text)
 *   category               → category (varchar)
 *   description            → description (text)
 *   default_cost           → costPrice (numeric)
 *   default_price          → basePrice (numeric)
 *   supplier_metadata_json → metadata (jsonb)
 *   design_metadata_json   → metadata (jsonb)
 *   created_at             → createdAt (timestamptz)
 *   updated_at             → updatedAt (timestamptz)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commerceProducts } from '../commerce'

export type FlowProduct = InferSelectModel<typeof commerceProducts>
export type FlowProductInsert = InferInsertModel<typeof commerceProducts>
