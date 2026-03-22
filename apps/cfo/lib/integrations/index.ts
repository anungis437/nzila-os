/**
 * Integrations barrel — CFO
 *
 * Re-exports all integration modules for convenient access.
 * Each module is self-contained with its own types, config, and functions.
 */

// ── Banking & Payments ──────────────────────────────────────────────────────
export * as plaid from '../plaid'
// eslint-disable-next-line no-restricted-imports -- relative path, not the stripe SDK
export * as stripe from '../stripe'
export * as qbo from '../qbo'

// ── Document & Receipt Processing ───────────────────────────────────────────
export * as dext from '../dext'
export * as documentIntelligence from '../document-intelligence'
export * as excelExport from '../excel-export'

// ── Accounting Platforms ────────────────────────────────────────────────────
export * as xero from '../xero'
export * as sage from '../sage'

// ── Payroll & Expense ───────────────────────────────────────────────────────
export * as payrollProvider from '../payroll-provider'
export * as expenseManagement from '../expense-management'

// ── Tax & Compliance ────────────────────────────────────────────────────────
export * as irsFiling from '../irs-filing'
export * as pension from '../pension'
export * as tax from '../tax'
export * as fx from '../fx'

// ── Business Intelligence ───────────────────────────────────────────────────
export * as biConnector from '../bi-connector'

// ── CRM & Communication ────────────────────────────────────────────────────
export * as crm from '../crm'
export * as chatops from '../chatops'
export * as email from '../email'

// ── Productivity ────────────────────────────────────────────────────────────
export * as calendar from '../calendar'
export * as m365 from '../m365'

// ── AI & ML ─────────────────────────────────────────────────────────────────
export * as aiClient from '../ai-client'
export * as mlClient from '../ml-client'

// ── Public API ──────────────────────────────────────────────────────────────
export * as publicApi from '../public-api'
