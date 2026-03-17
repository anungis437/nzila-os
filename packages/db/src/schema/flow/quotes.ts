/**
 * Flow — Quotes & Quote Items (Spec §3C, §3D)
 *
 * Uses commerce_quotes + commerce_quote_lines from the shared commerce schema.
 *
 * Column mapping (spec → actual):
 *   quote_number     → ref (varchar)
 *   subtotal_amount  → subtotal (numeric)
 *   tax_amount       → taxTotal (numeric)
 *   total_amount     → total (numeric)
 *   internal_notes   → notes (text)
 *   created_by       → createdBy (text)
 *
 * Quote Lines:
 *   line_number        → sortOrder (integer)
 *   unit_price         → unitPrice (numeric)
 *   line_subtotal      → lineTotal (numeric)
 *   customization_json → metadata (jsonb)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commerceQuotes, commerceQuoteLines } from '../commerce'

export type FlowQuote = InferSelectModel<typeof commerceQuotes>
export type FlowQuoteInsert = InferInsertModel<typeof commerceQuotes>
export type FlowQuoteItem = InferSelectModel<typeof commerceQuoteLines>
export type FlowQuoteItemInsert = InferInsertModel<typeof commerceQuoteLines>
