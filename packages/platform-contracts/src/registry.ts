/**
 * Nzila OS — Canonical App Registry
 *
 * This is the authoritative source of truth for all apps in the platform.
 * The control plane validates app compliance against these manifests.
 * No app may run in production without a valid entry here.
 *
 * Usage:
 *   import { APP_REGISTRY, getAppManifest } from '@nzila/platform-contracts/registry'
 */
import type { AppManifestInput } from './app-registry.js'
import { validateAppRegistry } from './app-registry.js'

/**
 * Registry entries omit fields that have Zod defaults (requiredRoles,
 * requiresBlobStorage, readinessPath, etc.). Helpers below cast to the
 * full output type after Zod fills in defaults during validation.
 */
const APP_REGISTRY_RAW: AppManifestInput[] = [
  // ── Production Apps ─────────────────────────────────────────────────────

  {
    id: 'union-eyes',
    name: 'UnionEyes',
    description: 'Labour and union management — claims, grievances, voting, dues, pensions',
    basePath: '/union-eyes',
    tier: 'PRODUCTION',
    appType: 'hybrid',
    iconToken: 'eye',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 10,
    owner: 'platform-core',
    packageName: '@nzila/union-eyes',
    devPort: 3002,
    domains: ['labour', 'governance', 'finance'],
    enabledCapabilities: [
      'auth', 'org-scope', 'evidence', 'telemetry',
      'canonical-events', 'canonical-reporting', 'health-check',
      'rate-limiting', 'webhooks',
    ],
    governanceRequirements: [
      { controlId: 'UE-01', name: 'Claims audit trail', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
      { controlId: 'UE-02', name: 'Grievance state transitions', mandatory: true, evidenceClass: 'audit-trail', retentionClass: '7_YEARS' },
      { controlId: 'UE-03', name: 'Voting integrity', mandatory: true, evidenceClass: 'hash-chain', retentionClass: 'PERMANENT' },
      { controlId: 'UE-04', name: 'Financial transactions audit', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID', 'AZURE_AD_TENANT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
      { provider: 'azure-blob', required: false, type: 'storage', envVars: ['BLOB_CONNECTION_STRING'] },
    ],
    reportingBindings: {
      entityTypes: ['claim', 'grievance', 'vote', 'member', 'contribution'],
      eventTypes: ['claim.created', 'claim.resolved', 'grievance.filed', 'vote.cast', 'payment.processed'],
      metricNames: ['claims_total', 'grievances_active', 'votes_cast', 'dues_collected'],
      emitsFinancialRecords: true,
      reportingEnabled: true,
    },
    healthBinding: {
      healthPath: '/api/health',
      readinessPath: '/api/health/ready',
      criticalDeps: ['postgresql', 'entra'],
      slo: { availabilityTarget: 99.9, latencyP99Ms: 2000 },
    },
    deployment: {
      containerImage: 'nzila/union-eyes',
      containerAppName: 'nzila-os-union-eyes',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: true,
      requiresBlobStorage: true,
    },
    policyBindings: ['data-retention', 'financial-audit', 'access-control'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'flow',
    name: 'Flow',
    description: 'Commerce engine — quotes, orders, invoices, fulfillment, Shopify/Zoho sync',
    basePath: '/flow',
    tier: 'PRODUCTION',
    appType: 'web-app',
    iconToken: 'shopping-cart',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 20,
    owner: 'platform-core',
    packageName: '@nzila/flow',
    devPort: 3003,
    domains: ['commerce', 'finance'],
    enabledCapabilities: [
      'auth', 'org-scope', 'evidence', 'telemetry',
      'canonical-events', 'canonical-reporting', 'feature-flags',
      'health-check', 'rate-limiting', 'webhooks',
    ],
    governanceRequirements: [
      { controlId: 'COM-01', name: 'Order audit trail', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
      { controlId: 'COM-03', name: 'Invoice reconciliation', mandatory: true, evidenceClass: 'audit-trail', retentionClass: '7_YEARS' },
      { controlId: 'COM-05', name: 'Payment processing audit', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
      { provider: 'stripe', required: false, type: 'payment', envVars: ['STRIPE_SECRET_KEY'] },
      { provider: 'shopify', required: false, type: 'erp', envVars: ['SHOPIFY_API_KEY'] },
      { provider: 'zoho', required: false, type: 'crm', envVars: ['ZOHO_CLIENT_ID'] },
    ],
    reportingBindings: {
      entityTypes: ['quote', 'order', 'invoice', 'product'],
      eventTypes: ['order.created', 'invoice.issued', 'payment.received', 'quote.submitted'],
      metricNames: ['orders_total', 'revenue_daily', 'invoice_outstanding'],
      emitsFinancialRecords: true,
      reportingEnabled: true,
    },
    healthBinding: {
      healthPath: '/api/health',
      readinessPath: '/api/health/ready',
      criticalDeps: ['postgresql', 'entra'],
      slo: { availabilityTarget: 99.9, latencyP99Ms: 1500 },
    },
    deployment: {
      containerImage: 'nzila/flow',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: true,
    },
    policyBindings: ['data-retention', 'financial-audit', 'integration-sync'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'console',
    name: 'Console',
    description: 'Business OS dashboard — finance, governance, equity, operations hub',
    basePath: '/console',
    tier: 'PRODUCTION',
    appType: 'web-app',
    iconToken: 'layout-dashboard',
    enabledByDefault: true,
    requiresOrgScope: true,
    navOrder: 1,
    owner: 'platform-core',
    packageName: '@nzila/console',
    devPort: 3001,
    domains: ['admin', 'finance', 'governance'],
    enabledCapabilities: [
      'auth', 'org-scope', 'telemetry', 'health-check',
      'canonical-reporting', 'feature-flags',
    ],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    reportingBindings: {
      entityTypes: ['organization'],
      eventTypes: ['org.settings.updated'],
      metricNames: [],
      emitsFinancialRecords: false,
      reportingEnabled: true,
    },
    healthBinding: {
      healthPath: '/api/health',
      readinessPath: '/api/health/ready',
      criticalDeps: ['postgresql', 'entra'],
    },
    deployment: {
      containerImage: 'nzila/console',
      containerAppName: 'nzila-os-console',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: true,
      requiresBlobStorage: true,
    },
    policyBindings: ['access-control'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'web',
    name: 'Web',
    description: 'Public marketing site and authentication entry point',
    basePath: '/',
    tier: 'PRODUCTION',
    appType: 'web-app',
    iconToken: 'globe',
    enabledByDefault: true,
    requiresOrgScope: false,
    navOrder: 0,
    showInNav: false,
    owner: 'platform-core',
    packageName: '@nzila/web',
    devPort: 3000,
    domains: ['marketing', 'auth'],
    enabledCapabilities: ['auth', 'health-check', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
    ],
    healthBinding: {
      healthPath: '/api/health',
      criticalDeps: ['entra'],
    },
    deployment: {
      containerImage: 'nzila/web',
      containerAppName: 'nzila-os-web',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: false,
    },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  // ── Pilot Apps ──────────────────────────────────────────────────────────

  {
    id: 'control-plane',
    name: 'Control Plane',
    description: 'Platform governance dashboard — compliance, architecture, audit timeline',
    basePath: '/control-plane',
    tier: 'PILOT',
    appType: 'web-app',
    iconToken: 'shield-check',
    enabledByDefault: false,
    requiredRoles: ['platform-admin'],
    requiresOrgScope: false,
    navOrder: 90,
    owner: 'platform-core',
    packageName: '@nzila/control-plane',
    devPort: 3010,
    domains: ['governance', 'platform'],
    enabledCapabilities: [
      'auth', 'telemetry', 'health-check',
      'canonical-reporting', 'feature-flags',
    ],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    healthBinding: {
      healthPath: '/api/health',
      criticalDeps: ['postgresql', 'entra'],
    },
    deployment: {
      containerImage: 'nzila/control-plane',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: true,
    },
    policyBindings: ['platform-governance'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'partners',
    name: 'Partners',
    description: 'B2B partner portal with entitlement-scoped access',
    basePath: '/partners',
    tier: 'PILOT',
    appType: 'web-app',
    iconToken: 'handshake',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 50,
    owner: 'platform-core',
    packageName: '@nzila/partners',
    devPort: 3004,
    domains: ['commerce', 'b2b'],
    enabledCapabilities: ['auth', 'org-scope', 'health-check', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    healthBinding: {
      healthPath: '/api/health',
      criticalDeps: ['postgresql', 'entra'],
    },
    deployment: {
      containerImage: 'nzila/partners',
      containerAppName: 'nzila-os-partners',
      environments: ['local', 'staging', 'production'],
      requiresDatabase: true,
    },
    policyBindings: ['access-control'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'cfo',
    name: 'CFO',
    description: 'Financial operations — Xero/QBO sync, bookkeeping, reconciliation',
    basePath: '/cfo',
    tier: 'PILOT',
    appType: 'web-app',
    iconToken: 'calculator',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 30,
    owner: 'platform-core',
    packageName: '@nzila/cfo',
    devPort: 3005,
    domains: ['finance'],
    enabledCapabilities: [
      'auth', 'org-scope', 'telemetry', 'health-check',
      'canonical-reporting', 'evidence',
    ],
    governanceRequirements: [
      { controlId: 'FIN-01', name: 'Financial sync audit', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
      { provider: 'xero', required: false, type: 'erp', envVars: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'] },
      { provider: 'quickbooks', required: false, type: 'erp', envVars: ['QBO_CLIENT_ID', 'QBO_CLIENT_SECRET'] },
    ],
    reportingBindings: {
      entityTypes: ['account', 'journal-entry', 'bank-transaction'],
      eventTypes: ['sync.completed', 'reconciliation.completed'],
      metricNames: ['sync_success_rate', 'reconciliation_delta'],
      emitsFinancialRecords: true,
      reportingEnabled: true,
    },
    healthBinding: {
      healthPath: '/api/health',
      criticalDeps: ['postgresql', 'entra'],
    },
    deployment: {
      containerImage: 'nzila/cfo',
      environments: ['local', 'staging'],
      requiresDatabase: true,
    },
    policyBindings: ['financial-audit', 'data-retention'],
    supportedOrgScopes: ['*'],
  },

  // ── Incubating Apps ─────────────────────────────────────────────────────

  {
    id: 'zonga',
    name: 'Zonga',
    description: 'Creator economy platform — media marketplace, events, ticketing, monetization',
    basePath: '/zonga',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'music',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 40,
    owner: 'zonga-team',
    packageName: '@nzila/zonga',
    devPort: 3006,
    domains: ['media', 'entertainment', 'finance'],
    enabledCapabilities: [
      'auth', 'org-scope', 'telemetry', 'health-check',
      'canonical-events', 'canonical-reporting', 'webhooks', 'evidence',
    ],
    governanceRequirements: [
      { controlId: 'ZON-01', name: 'Payout audit trail', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
      { controlId: 'ZON-02', name: 'Fee change audit', mandatory: true, evidenceClass: 'dual-control', retentionClass: '7_YEARS' },
      { controlId: 'ZON-03', name: 'Ticket validation integrity', mandatory: true, evidenceClass: 'audit-trail', retentionClass: '3_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
      { provider: 'stripe', required: true, type: 'payment', envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
    ],
    reportingBindings: {
      entityTypes: ['creator', 'content', 'event', 'ticket', 'subscription'],
      eventTypes: ['payout.initiated', 'ticket.purchased', 'subscription.started', 'content.published'],
      metricNames: ['revenue_daily', 'creators_active', 'tickets_sold', 'payout_volume'],
      emitsFinancialRecords: true,
      reportingEnabled: true,
    },
    healthBinding: {
      healthPath: '/api/health',
      criticalDeps: ['postgresql', 'entra', 'stripe'],
    },
    deployment: {
      containerImage: 'nzila/zonga',
      containerAppName: 'nzila-os-zonga',
      environments: ['local', 'staging'],
      requiresDatabase: true,
    },
    policyBindings: ['financial-audit', 'data-retention', 'creator-protection'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'agrimo',
    name: 'Agrimo',
    description: 'Agriculture SaaS — producer management, lots, batches, traceability',
    basePath: '/agrimo',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'wheat',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 60,
    owner: 'agri-team',
    packageName: '@nzila/agrimo',
    devPort: 3007,
    domains: ['agriculture', 'supply-chain'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry', 'canonical-events'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    reportingBindings: {
      entityTypes: ['producer', 'lot', 'batch', 'shipment'],
      eventTypes: ['lot.created', 'batch.certified', 'shipment.dispatched'],
      metricNames: ['lots_active', 'batches_certified'],
      emitsFinancialRecords: false,
      reportingEnabled: true,
    },
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: ['data-retention'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'trade',
    name: 'Trade',
    description: 'Import/export operations — cross-border trade management',
    basePath: '/trade',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'ship',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 65,
    owner: 'trade-team',
    packageName: '@nzila/trade',
    devPort: 3008,
    domains: ['trade', 'logistics'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'cora',
    name: 'Cora',
    description: 'Agriculture analytics dashboard',
    basePath: '/cora',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'bar-chart-3',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 61,
    owner: 'agri-team',
    packageName: '@nzila/cora',
    devPort: 3009,
    domains: ['agriculture', 'analytics'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: false },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'nacp-exams',
    name: 'NACP Exams',
    description: 'Exam management and scoring platform',
    basePath: '/nacp-exams',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'graduation-cap',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 70,
    owner: 'platform-core',
    packageName: '@nzila/nacp-exams',
    devPort: 3011,
    domains: ['education', 'assessment'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry'],
    governanceRequirements: [
      { controlId: 'NACP-01', name: 'Exam integrity audit', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: ['data-retention'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'weekone',
    name: 'WeekOne',
    description: 'Founder operating system — runway, pipeline, weekly brief',
    basePath: '/weekone',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'calendar',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 75,
    owner: 'platform-core',
    packageName: '@nzila/weekone',
    devPort: 3016,
    domains: ['founder-ops', 'finance'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'test-scaffold-gp',
    name: 'Test Scaffold GP',
    description: 'GP test scaffold — frozen reference implementation for governance pattern verification',
    basePath: '/test-scaffold-gp',
    tier: 'FROZEN',
    appType: 'web-app',
    iconToken: 'beaker',
    enabledByDefault: false,
    requiresOrgScope: false,
    navOrder: 99,
    owner: 'platform-core',
    packageName: '@nzila/test-scaffold-gp',
    devPort: 3017,
    domains: ['platform'],
    enabledCapabilities: ['auth'],
    governanceRequirements: [],
    integrationDependencies: [],
    deployment: { environments: ['local'], requiresDatabase: false },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'mobility',
    name: 'Mobility',
    description: 'Case management for immigration and mobility services',
    basePath: '/mobility',
    tier: 'INCUBATING',
    appType: 'web-app',
    iconToken: 'plane',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 55,
    owner: 'platform-core',
    packageName: '@nzila/mobility',
    devPort: 3012,
    domains: ['immigration', 'case-management'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'mobility-client-portal',
    name: 'Mobility Client Portal',
    description: 'Client-facing portal for mobility/immigration case tracking',
    basePath: '/mobility-portal',
    tier: 'EXPERIMENTAL',
    appType: 'web-app',
    iconToken: 'user',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 56,
    showInNav: false,
    owner: 'platform-core',
    packageName: '@nzila/mobility-client-portal',
    devPort: 3013,
    domains: ['immigration'],
    enabledCapabilities: ['auth', 'org-scope'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
    ],
    deployment: { environments: ['local'] },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },

  // ── Experimental Apps ───────────────────────────────────────────────────

  {
    id: 'abr',
    name: 'ABR',
    description: 'Automated benefit reporting and confidential insights',
    basePath: '/abr',
    tier: 'EXPERIMENTAL',
    appType: 'web-app',
    iconToken: 'file-search',
    enabledByDefault: false,
    requiresOrgScope: true,
    navOrder: 80,
    owner: 'platform-core',
    packageName: '@nzila/abr',
    devPort: 3014,
    domains: ['reporting', 'benefits'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry', 'evidence'],
    governanceRequirements: [
      { controlId: 'ABR-01', name: 'Confidential report sealing', mandatory: true, evidenceClass: 'hash-chain', retentionClass: '7_YEARS' },
    ],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: ['data-retention', 'confidentiality'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'platform-admin',
    name: 'Platform Admin',
    description: 'Internal platform administration (super-admin only)',
    basePath: '/platform-admin',
    tier: 'EXPERIMENTAL',
    appType: 'web-app',
    iconToken: 'settings',
    enabledByDefault: false,
    requiredRoles: ['super-admin'],
    requiresOrgScope: false,
    navOrder: 99,
    showInNav: false,
    owner: 'platform-core',
    packageName: '@nzila/platform-admin',
    devPort: 3015,
    domains: ['platform'],
    enabledCapabilities: ['auth', 'telemetry'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'entra', required: true, type: 'auth', envVars: ['AUTH_SECRET', 'AZURE_AD_CLIENT_ID'] },
    ],
    deployment: { environments: ['local'] },
    policyBindings: ['platform-governance'],
    supportedOrgScopes: ['*'],
  },

  {
    id: 'orchestrator-api',
    name: 'Orchestrator API',
    description: 'Platform orchestration API — workflow engine and job coordination',
    basePath: '/api/orchestrator',
    tier: 'EXPERIMENTAL',
    appType: 'api-service',
    iconToken: 'workflow',
    enabledByDefault: false,
    requiresOrgScope: true,
    showInNav: false,
    navOrder: 95,
    owner: 'platform-core',
    packageName: '@nzila/orchestrator-api',
    devPort: 4000,
    domains: ['platform', 'orchestration'],
    enabledCapabilities: ['auth', 'org-scope', 'telemetry', 'canonical-events', 'health-check'],
    governanceRequirements: [],
    integrationDependencies: [
      { provider: 'postgresql', required: true, type: 'storage', envVars: ['DATABASE_URL'] },
    ],
    healthBinding: {
      healthPath: '/health',
      criticalDeps: ['postgresql'],
    },
    deployment: { environments: ['local'], requiresDatabase: true },
    policyBindings: [],
    supportedOrgScopes: ['*'],
  },
]

/** Parsed registry with Zod defaults filled in. */
export { APP_REGISTRY_RAW as APP_REGISTRY }

// ── Lookup Helpers ──────────────────────────────────────────────────────────

export function getAppManifest(appId: string) {
  return APP_REGISTRY_RAW.find(m => m.id === appId)
}

export function getAppsByTier(tier: string) {
  return APP_REGISTRY_RAW.filter(m => m.tier === tier)
}

export function getAppsByDomain(domain: string) {
  return APP_REGISTRY_RAW.filter(m => m.domains?.includes(domain))
}

export function getAppsWithCapability(capability: string) {
  return APP_REGISTRY_RAW.filter(m => m.enabledCapabilities?.includes(capability as never))
}

export function getProductionApps() {
  return getAppsByTier('PRODUCTION')
}

// ── Registry Self-Validation ────────────────────────────────────────────────

/**
 * Validates the built-in app registry. Called at build time
 * by CI to prevent invalid manifests from merging.
 */
export function validateBuiltInRegistry(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  return validateAppRegistry(APP_REGISTRY_RAW)
}
