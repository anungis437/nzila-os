/**
 * Nzila OS — Org-Scoped Table Registry
 *
 * The single source of truth for which tables require entity_id (Org) scoping.
 * Every table listed here MUST have an `entity_id` column, and every table
 * in the schema that HAS an `entity_id` column MUST be listed here.
 *
 * Contract test `org-scoped-registry.test.ts` enforces bidirectional consistency:
 *   - If a table has entity_id but isn't in the registry → CI fails.
 *   - If a table is in the registry but lacks entity_id → CI fails.
 *
 * This registry is consumed by:
 *   - createScopedDb() — validates Org filter presence
 *   - createAuditedScopedDb() — validates Org + audit on every write
 *   - Contract tests — ensure no drift between schema and registry
 *   - GA Gate — confirms Org isolation coverage
 *
 * @module @nzila/db/org-registry
 * @see docs/architecture/ORG_SCOPED_TABLES.md
 */

// ── The Registry ────────────────────────────────────────────────────────────

/**
 * Exhaustive list of Drizzle table export names that require Org (entity_id) scoping.
 *
 * Table names here are the **TS export names** from `@nzila/db/schema`,
 * matching the camelCase identifiers used in app code. The underlying
 * DB column is always `entity_id`.
 *
 * Tables NOT in this list are either:
 *   - Global (e.g., `people`, `aiApps`, `aiModels`)
 *   - Scoped via FK to an Org-scoped parent (e.g., `evidencePackArtifacts` → `evidencePacks`)
 *   - Partner-scoped (e.g., `partners`, `deals` — use `partner_id`, not `entity_id`)
 */
export const ORG_SCOPED_TABLES = [
  // ── entities.ts ─────────────────────────────────────────
  'entityRoles',
  'entityMembers',

  // ── governance.ts ───────────────────────────────────────
  'meetings',
  'resolutions',
  'approvals',
  'votes',

  // ── operations.ts ───────────────────────────────────────
  'governanceActions',
  'documents',
  'filings',
  'complianceTasks',
  'auditEvents',
  'evidencePacks',
  'auditLog',

  // ── equity.ts ───────────────────────────────────────────
  'shareClasses',
  'shareholders',
  'shareLedgerEntries',
  'shareCertificates',
  'capTableSnapshots',

  // ── finance.ts ──────────────────────────────────────────
  'closePeriods',
  'closeTasks',
  'closeExceptions',
  'closeApprovals',
  'qboConnections',
  'qboSyncRuns',
  'qboReports',
  'financeGovernanceLinks',

  // ── payments.ts ─────────────────────────────────────────
  'stripeConnections',
  'stripeWebhookEvents',
  'stripePayments',
  'stripeRefunds',
  'stripeDisputes',
  'stripePayouts',
  'stripeReports',
  'stripeSubscriptions',

  // ── ai.ts ───────────────────────────────────────────────
  'aiCapabilityProfiles',
  'aiRequests',
  'aiUsageBudgets',
  'aiKnowledgeSources',
  'aiEmbeddings',
  'aiActions',
  'aiActionRuns',
  'aiKnowledgeIngestionRuns',
  'aiDeploymentRoutes',

  // ── ml.ts ───────────────────────────────────────────────
  'mlDatasets',
  'mlModels',
  'mlTrainingRuns',
  'mlInferenceRuns',
  'mlScoresStripeDaily',
  'mlScoresStripeTxn',
  'mlScoresUECasesPriority',
  'mlScoresUESlaRisk',

  // ── ue.ts ───────────────────────────────────────────────
  'ueCases',

  // ── tax.ts ──────────────────────────────────────────────
  'taxProfiles',
  'taxYears',
  'taxFilings',
  'taxInstallments',
  'taxNotices',
  'indirectTaxAccounts',
  'indirectTaxPeriods',

  // ── nacp.ts ─────────────────────────────────────────────
  'nacpSubjects',
  'nacpCenters',
  'nacpExams',
  'nacpExamSessions',
  'nacpCandidates',
  'nacpSubmissions',
  'nacpIntegrityArtifacts',
  'nacpOutbox',
  'nacpSyncQueue',

  // ── zonga.ts ────────────────────────────────────────────
  'zongaCreators',
  'zongaContentAssets',
  'zongaReleases',
  'zongaRevenueEvents',
  'zongaWalletLedger',
  'zongaPayouts',
  'zongaOutbox',
  'zongaRoyaltySplits',

  // ── commerce.ts ─────────────────────────────────────────
  'commerceCustomers',
  'commerceOpportunities',
  'commerceQuotes',
  'commerceQuoteVersions',
  'commerceQuoteLines',
  'commerceOrders',
  'commerceOrderLines',
  'commerceInvoices',
  'commerceInvoiceLines',
  'commerceFulfillmentTasks',
  'commercePayments',
  'commerceCreditNotes',
  'commerceRefunds',
  'commerceDisputes',
  'commerceEvidenceArtifacts',
  'commerceSyncJobs',
  'commerceSyncReceipts',
  'commerceSuppliers',
  'commerceProducts',
  'commerceInventory',
  'commerceStockMovements',
  'commercePurchaseOrders',
  'commercePurchaseOrderLines',
  'commerceMandateAllocations',
  'commerceZohoSyncConfigs',
  'commerceZohoSyncRecords',
  'commerceZohoConflicts',
  'commerceZohoCredentials',

  // ── platform.ts ─────────────────────────────────────────
  'platformRequestMetrics',
] as const

/**
 * Set form for O(1) lookups at runtime.
 */
export const ORG_SCOPED_TABLE_SET: ReadonlySet<string> = new Set(ORG_SCOPED_TABLES)

/**
 * Type narrowing: names of all Org-scoped tables.
 */
export type OrgScopedTableName = (typeof ORG_SCOPED_TABLES)[number]

// ── Tables explicitly NOT Org-scoped ────────────────────────────────────────

/**
 * Tables that intentionally do NOT have entity_id.
 * Each exclusion must have a documented reason.
 */
export const NON_ORG_SCOPED_TABLES = [
  // Root entity table — id IS the Org
  { table: 'entities', reason: '`id` IS the Org identifier — root table' },
  // Global person registry — shared across Orgs
  { table: 'people', reason: 'Global person registry, linked to Orgs via entityRoles/entityMembers' },
  // FK-scoped via parent Org-scoped table
  { table: 'evidencePackArtifacts', reason: 'Scoped via pack_id FK → evidencePacks (Org-scoped)' },
  { table: 'closeTaskEvidence', reason: 'Scoped via task_id FK → closeTasks (Org-scoped)' },
  { table: 'qboTokens', reason: 'Scoped via connection_id FK → qboConnections (Org-scoped)' },
  { table: 'indirectTaxSummary', reason: 'Scoped via period_id FK → indirectTaxPeriods (Org-scoped)' },
  { table: 'aiRequestPayloads', reason: 'Scoped via request FK — large payloads stored separately' },
  // Global registries — not entity-specific
  { table: 'aiApps', reason: 'Global AI app registry' },
  { table: 'aiModels', reason: 'Global AI model registry' },
  { table: 'aiDeployments', reason: 'Global deployment configurations per environment' },
  { table: 'aiPrompts', reason: 'Global prompt library (versioned)' },
  { table: 'aiPromptVersions', reason: 'Versions of global prompts' },
  // Automation — system-level, not Org-scoped
  { table: 'automationCommands', reason: 'System-level automation dispatch (no Org context)' },
  { table: 'automationEvents', reason: 'System-level automation events (no Org context)' },
  // Partner-scoped tables — use partner_id, not entity_id
  { table: 'partners', reason: 'Partner portal — scoped by clerk_org_id, not entity_id' },
  { table: 'partnerUsers', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'partnerEntities', reason: 'Bridge table — has entity_id as varchar, not UUID FK' },
  { table: 'deals', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'commissions', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'certifications', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'assets', reason: 'Partner portal — global assets registry' },
  { table: 'apiCredentials', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'gtmRequests', reason: 'Partner portal — scoped by partner_id FK' },
  // Platform infrastructure — system-level, not Org-scoped
  { table: 'platformIsolationAudits', reason: 'System-level isolation audit results' },
  { table: 'platformProofPacks', reason: 'System-level governance proof packs' },
] as const

/**
 * Set of intentionally non-Org-scoped table names for quick lookups.
 */
export const NON_ORG_SCOPED_TABLE_SET: ReadonlySet<string> = new Set(
  NON_ORG_SCOPED_TABLES.map((t) => t.table),
)
