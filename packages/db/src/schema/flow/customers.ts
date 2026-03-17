/**
 * Flow — Customers (Spec §3A)
 *
 * Uses commerce_customers from the shared commerce schema.
 *
 * Column mapping (spec → actual):
 *   id              → id (uuid)
 *   org_id          → orgId (uuid FK)
 *   company_name    → company (text)
 *   contact_name    → name (text)
 *   email           → email (text)
 *   phone           → phone (text)
 *   billing_address → address (jsonb)
 *   notes           → notes (text)
 *   created_at      → createdAt (timestamptz)
 *   updated_at      → updatedAt (timestamptz)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commerceCustomers } from '../commerce'

export type FlowCustomer = InferSelectModel<typeof commerceCustomers>
export type FlowCustomerInsert = InferInsertModel<typeof commerceCustomers>
