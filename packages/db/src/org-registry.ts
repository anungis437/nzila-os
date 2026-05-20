/**
 * Nzila OS — Org-Scoped Table Registry
 *
 * The single source of truth for which tables require org_id (Org) scoping.
 * Every table listed here MUST have an `org_id` column, and every table
 * in the schema that HAS an `org_id` column MUST be listed here.
 *
 * Contract test `org-scoped-registry.test.ts` enforces bidirectional consistency:
 *   - If a table has org_id but isn't in the registry → CI fails.
 *   - If a table is in the registry but lacks org_id → CI fails.
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
 * Exhaustive list of Drizzle table export names that require Org (org_id) scoping.
 *
 * Table names here are the **TS export names** from `@nzila/db/schema`,
 * matching the camelCase identifiers used in app code. The underlying
 * DB column is always `org_id`.
 *
 * Tables NOT in this list are either:
 *   - Global (e.g., `people`, `aiApps`, `aiModels`)
 *   - Scoped via FK to an Org-scoped parent (e.g., `evidencePackArtifacts` → `evidencePacks`)
 *   - Partner-scoped (e.g., `partners`, `deals` — use `partner_id`, not `org_id`)
 */
export const ORG_SCOPED_TABLES = [
  // ── orgs.ts ─────────────────────────────────────────
  'orgRoles',
  'orgMembers',

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
  'founderTimeLogs',
  'weeklyFocusTargets',
  'treasurySnapshots',
  'runwayAssumptions',
  'executionInitiatives',
  'executiveDecisions',
  'decisionScorebacks',
  'executiveAgentRuns',
  'executiveAgentInsights',
  'executiveAgentActions',

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

  // ── ai-governance.ts ────────────────────────────────────
  'aiGovernanceDecisionLog',

  // ── decision-events.ts ──────────────────────────────────
  // Control Plane authority decision ledger (immutable, hash-chained).
  'decisionEvents',

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
  'zongaCreatorAccounts',
  'zongaPayoutPreviews',
  'zongaPlaylists',
  'zongaListeners',
  'zongaListenerFollows',
  'zongaListenerFavorites',
  'zongaListenerPlaylistSaves',
  'zongaListenerActivity',
  'zongaEvents',
  'zongaTicketTypes',
  'zongaTicketPurchases',
  'zongaModerationCases',
  'zongaIntegritySignals',
  'zongaNotifications',
  'zongaWallets',
  'zongaWalletTransactions',
  'zongaPaymentIntents',
  'zongaPaymentWebhookEvents',
  'zongaTranscodeJobs',
  'zongaStreamingSessions',
  'zongaQueueJobs',
  'zongaUserFollows',
  'zongaUserActivity',
  'zongaSharedContent',
  'zongaRecommendationCache',
  'zongaCreatorAnalytics',
  'zongaEventbriteConnections',
  'zongaPodcasts',
  'zongaPodcastEpisodes',

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
  'commerceOrgSettings',
  'commerceOrgQuotePolicies',
  'commerceOrgPaymentPolicies',
  'commerceOrgSupplierPolicies',
  'commerceOrgCatalogPolicies',
  'commerceOrgBrandingConfigs',
  'commerceOrgCommunicationTemplates',

  // ── platform.ts ─────────────────────────────────────────
  'platformRequestMetrics',
  'platformIntegrationConnections',
  'platformIntegrationDeliveries',
  'platformIntegrationDlqEntries',
  'platformCostEvents',
  'platformCostRollups',
  'platformCostBudgetBreaches',
  'platformRateLimitThrottles',

  // ── pilot-metrics.ts ───────────────────────────────────
  'pilotDefinitions',
  'pilotMetricEvents',
  'pilotMetricRollups',
  'pilotHealthScores',
  'pilotAlerts',
  'pilotAlertRules',
  'pilotAlertEscalations',

  // ── trade.ts ────────────────────────────────────────────
  'tradeParties',
  'tradeListings',
  'tradeListingMedia',
  'tradeDeals',
  'tradeQuotes',
  'tradeFinancingTerms',
  'tradeShipments',
  'tradeDocuments',
  'tradeCommissions',
  'tradeEvidenceArtifacts',
  'tradeVehicleListings',
  'tradeVehicleDocs',

  // ── mobility.ts ──────────────────────────────────────────
  'mobilityFirms',
  'mobilityAdvisors',
  'mobilityClients',
  'mobilityFamilyMembers',
  'mobilityPrograms',
  'mobilityCases',
  'mobilityCaseTasks',
  'mobilityDocuments',
  'mobilityComplianceEvents',
  'mobilityCommunications',
  'mobilityAiOutputs',
  'mobilityAuditLog',

  // ── agri.ts ──────────────────────────────────────────────
  'agriProducers',
  'agriCooperatives',
  'agriCrops',
  'agriHarvests',
  'agriLots',
  'agriLotContributions',
  'agriInspections',
  'agriWarehouses',
  'agriBatches',
  'agriBatchAllocations',
  'agriShipments',
  'agriShipmentMilestones',
  'agriPaymentPlans',
  'agriPayments',
  'agriCertifications',
  'agriTraceabilityLinks',
  'agriEvidenceArtifacts',
  'agriForecasts',
  'agriPriceSignals',
  'agriRiskScores',

  // ── commerce.ts (new SaaS tables) ───────────────────────
  'commerceQuoteApprovals',
  'commerceQuoteRevisions',
  'commercePaymentRequirements',
  'commercePaymentTracking',
  'commercePaymentEvents',
  'commerceShareLinks',
  'commerceTimelineEvents',
  'commerceShopifyCredentials',
  'commerceShopifySyncRecords',

  // ── itsm.ts (ITSM + Command Center) ─────────────────────
  'itsmQueues',
  'itsmSlas',
  'itsmContracts',
  'itsmTickets',
  'itsmTicketEvents',
  'itsmAssets',
  'itsmProblems',
  'itsmChanges',
  'itsmApprovals',
  'opsClients',
  'itsmKbArticles',
  'commandAlerts',
  'revenueEvents',
  'renewalTasks',
  'productHealthSnapshots',
  'founderPriorities',

  // ── executive.ts (Founder Focus Engine) ──────────────────
  'executiveRecommendations',
  'executivePrioritySnapshots',

  // ── trustcore.ts (TrustCore — Law 25 compliance) ─────────
  'trustcorePrivacyPrograms',
  'trustcoreDataAssets',
  'trustcorePias',
  'trustcoreIncidents',
  'trustcoreDsrRequests',
  'trustcoreConsentRecords',
  'trustcoreVendors',
  'trustcoreEvidenceEvents',
  'trustcoreComplianceSnapshots',
  'trustcorePolicies',
  'trustcoreReminders',
  'trustcoreSubscriptions',
  'trustcoreLeads',
  'trustcoreRisks',
  'trustcoreRiskReviews',
  'trustcoreRiskMitigations',

  // ── trustcore.ts (TrustOps v1 — restructuring mandates) ─────────
  'trustopsMandates',
  'trustopsCreditors',
  'trustopsProofsOfClaim',
  'trustopsMandateStageHistory',

  // ── healthcare-surveys.ts ─────────────────────────────────────
  'healthcareSurveys',
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
 * Tables that intentionally do NOT have org_id.
 * Each exclusion must have a documented reason.
 */
export const NON_ORG_SCOPED_TABLES = [
  // Root entity table — id IS the Org
  { table: 'orgs', reason: '`id` IS the Org identifier — root table' },
  // Global person registry — shared across Orgs
  { table: 'people', reason: 'Global person registry, linked to Orgs via orgRoles/orgMembers' },
  // FK-scoped via parent Org-scoped table
  { table: 'evidencePackArtifacts', reason: 'Scoped via pack_id FK → evidencePacks (Org-scoped)' },
  { table: 'closeTaskEvidence', reason: 'Scoped via task_id FK → closeTasks (Org-scoped)' },
  { table: 'qboTokens', reason: 'Scoped via connection_id FK → qboConnections (Org-scoped)' },
  { table: 'indirectTaxSummary', reason: 'Scoped via period_id FK → indirectTaxPeriods (Org-scoped)' },
  { table: 'aiRequestPayloads', reason: 'Scoped via request FK — large payloads stored separately' },
  // Global registries — not Org-specific
  { table: 'aiApps', reason: 'Global AI app registry' },
  { table: 'aiModels', reason: 'Global AI model registry' },
  { table: 'aiDeployments', reason: 'Global deployment configurations per environment' },
  { table: 'aiPrompts', reason: 'Global prompt library (versioned)' },
  { table: 'aiPromptVersions', reason: 'Versions of global prompts' },
  // Automation — system-level, not Org-scoped
  { table: 'automationCommands', reason: 'System-level automation dispatch (no Org context)' },
  { table: 'automationEvents', reason: 'System-level automation events (no Org context)' },
  // Partner-scoped tables — use partner_id, not org_id
  { table: 'partners', reason: 'Partner portal — scoped by clerk_org_id, not org_id' },
  { table: 'partnerUsers', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'partnerEntities', reason: 'Bridge table — has org_id as varchar, not UUID FK' },
  { table: 'deals', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'commissions', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'certifications', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'assets', reason: 'Partner portal — global assets registry' },
  { table: 'apiCredentials', reason: 'Partner portal — scoped by partner_id FK' },
  { table: 'gtmRequests', reason: 'Partner portal — scoped by partner_id FK' },
  // Platform infrastructure — system-level, not Org-scoped
  { table: 'platformIsolationAudits', reason: 'System-level isolation audit results' },
  { table: 'platformProofPacks', reason: 'System-level governance proof packs' },
  { table: 'platformDeploymentProfiles', reason: 'System-level deployment profile configurations (no Org context)' },
  { table: 'idempotencyCache', reason: 'System-level idempotency cache — keyed by composite key containing orgId' },
  // Decision/audit pipeline tables — system or cross-org scope (no org_id column)
  { table: 'auditRecords', reason: 'Uses organization_id (text) and supports cross-org audit ingestion/export' },
  { table: 'decisionAggregates', reason: 'Uses organization_id (text) for aggregate analytics windows, not org_id UUID scoping' },
  { table: 'decisionPipelineCheckpoints', reason: 'Global pipeline cursor/state table (one row per pipeline)' },
  { table: 'decisionPipelineRuns', reason: 'Global run log table with optional organization_id for org-specific replays' },
  { table: 'pipelineAlerts', reason: 'Global operational alert table emitted by pipeline infrastructure' },
  // ── healthcare-surveys.ts — FK-scoped via survey_id → healthcareSurveys ─
  { table: 'healthcareSurveyResponses', reason: 'Scoped via survey_id FK → healthcareSurveys (Org-scoped); anonymous responses — no direct org_id' },
  { table: 'healthcareSurveyInsights', reason: 'Scoped via survey_id FK → healthcareSurveys (Org-scoped)' },
  { table: 'healthcareSurveyTemplates', reason: 'Global template library — not org-specific' },
  // ── zonga.ts (no org_id) ────────────────────────────────
  { table: 'zongaReleaseTracks', reason: 'Scoped via release_id FK → zongaReleases (Org-scoped)' },
  { table: 'zongaPlaylistItems', reason: 'Scoped via playlist_id FK → zongaPlaylists (Org-scoped)' },
  // ── ai-governance.ts (no org_id) ────────────────────────
  { table: 'aiGovernanceModels', reason: 'Global AI governance model registry — not Org-specific' },
  { table: 'aiGovernancePromptVersions', reason: 'Global prompt versioning for governance — not Org-specific' },
  { table: 'aiGovernanceReviewFlags', reason: 'Scoped via decision_id FK → aiGovernanceDecisionLog (Org-scoped)' },
  // ── exec-data.ts (Founder Focus internal tables — no org_id) ─
  { table: 'jobPostings', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'jobApplications', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'customerOnboardingMilestones', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'budgetLines', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'csAccounts', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'securityFindings', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'securityWaivers', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'erpInvoices', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  // ── grants.ts (Internal Founder Focus tables — no org_id) ────
  { table: 'grants', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  { table: 'grantReports', reason: 'Internal Founder Focus tracking — not multi-tenant' },
  // ── executive.ts (FK-scoped via recommendation_id) ────────────
  { table: 'executiveRecommendationFeedback', reason: 'Scoped via recommendation_id FK → executiveRecommendations (Org-scoped)' },
  { table: 'executiveRecommendationOutcomes', reason: 'Scoped via recommendation_id FK → executiveRecommendations (Org-scoped)' },
] as const

/**
 * Set of intentionally non-Org-scoped table names for quick lookups.
 */
export const NON_ORG_SCOPED_TABLE_SET: ReadonlySet<string> = new Set(
  NON_ORG_SCOPED_TABLES.map((t) => t.table),
)
