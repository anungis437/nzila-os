/**
 * Flow — Invoices (Spec §3N)
 *
 * Uses commerce_invoices from the shared commerce schema.
 *
 * Column mapping (spec → actual):
 *   invoice_number  → ref (varchar)
 *   subtotal_amount → subtotal (numeric)
 *   tax_amount      → taxTotal (numeric)
 *   total_amount    → total (numeric)
 *   amount_paid     → amountPaid (numeric)
 *   issued_at       → issuedAt (timestamptz)
 *   due_at          → dueDate (timestamptz)
 *   paid_at         → paidAt (timestamptz)
 *   provider        → via metadata (jsonb)
 *   provider_ref    → via metadata (jsonb)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commerceInvoices, commerceInvoiceLines } from '../commerce'

export type FlowInvoice = InferSelectModel<typeof commerceInvoices>
export type FlowInvoiceInsert = InferInsertModel<typeof commerceInvoices>
export type FlowInvoiceLine = InferSelectModel<typeof commerceInvoiceLines>
export type FlowInvoiceLineInsert = InferInsertModel<typeof commerceInvoiceLines>
