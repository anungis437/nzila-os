import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // Apps
      'apps/abr',
      'apps/cfo',
      'apps/console',
      'apps/flow',
      'apps/orchestrator-api',
      'apps/partners',
      'apps/union-eyes',
      'apps/web',
      'apps/nacp-exams',
      'apps/zonga',
      'apps/agrimo',
      'apps/cora',
      // Packages
      'packages/ai-core',
      'packages/ai-sdk',
      'packages/blob',
      'packages/db',
      'packages/ml-core',
      'packages/ml-sdk',
      'packages/commerce-core',
      'packages/pricing-engine',
      'packages/commerce-state',
      'packages/commerce-audit',
      'packages/commerce-db',
      'packages/commerce-events',
      'packages/commerce-evidence',
      'packages/commerce-governance',
      'packages/commerce-services',
      'packages/commerce-integration-tests',
      'packages/commerce-observability',
      'packages/platform-commerce-org',
      'packages/nacp-core',
      'packages/zonga-core',
      'packages/zonga-economics',
      'packages/zonga-events',
      'packages/zonga-rights',
      'packages/zonga-payments',
      'packages/zonga-growth',
      'packages/zonga-intelligence',
      'packages/zonga-control-plane',
      'packages/os-core',
      'packages/payments-stripe',
      'packages/platform-export',
      'packages/platform-metrics',
      'packages/platform-performance',
      'packages/platform-isolation',
      'packages/platform-proof',
      'packages/platform-ops',
      'packages/data-lifecycle',
      'packages/qbo',
      'packages/fx',
      'packages/tax',
      'packages/tools-runtime',
      'packages/ui',
      // Integration platform
      'packages/integrations-core',
      'packages/integrations-calendar',
      'packages/integrations-pension',
      'packages/integrations-db',
      'packages/integrations-runtime',
      'packages/comms-email',
      'packages/comms-sms',
      'packages/comms-push',
      'packages/chatops-slack',
      'packages/chatops-teams',
      'packages/crm-hubspot',
      'packages/webhooks',
      // Agri packages
      'packages/agri-core',
      'packages/agri-db',
      'packages/agri-events',
      'packages/agri-forecasting',
      'packages/agri-intelligence',
      'packages/agri-provenance',
      'packages/agri-reporting',
      'packages/agri-supply-chain',
      'packages/agri-sync-contracts',
      'packages/agri-traceability',
      'packages/agri-adapters',
      // Agrimo packages
      'packages/agrimo-core',
      'packages/agrimo-intelligence',
      // Platform hardening packages
      'packages/platform-cost',
      'packages/platform-deploy',
      // Platform moat packages
      'packages/platform-policy-engine',
      'packages/platform-procurement-proof',
      'packages/platform-marketplace',
      'packages/platform-assurance',
      'packages/platform-rfp-generator',
      'packages/platform-utils',
      // New gap-fill packages
      'packages/platform-rum',
      'packages/ai-registry',
      // Platform OS packages
      'packages/platform-ontology',
      'packages/platform-entity-graph',
      'packages/platform-event-fabric',
      'packages/platform-knowledge-registry',
      'packages/platform-data-fabric',
      'packages/platform-decision-graph',
      'packages/platform-context-orchestrator',
      'packages/platform-semantic-search',
      'packages/platform-governed-ai',
      'packages/platform-reasoning-engine',
      'packages/platform-cognition-core',
      'packages/platform-growth-os',
      'packages/platform-org-resolver',
      'packages/ue-cognition',
      // Platform observability
      'packages/platform-observability',
      // Mobility packages
      'packages/mobility-core',
      'packages/mobility-programs',
      'packages/mobility-compliance',
      'packages/mobility-ai',
      'packages/mobility-family',
      'packages/mobility-case-engine',
      'packages/integrations-hubspot',
      'packages/integrations-m365',
      'packages/integrations-whatsapp',
      'packages/org',
      // Mobility apps
      'apps/mobility',
      'apps/mobility-client-portal',
      // Remaining apps
      'apps/trade',
      'apps/platform-admin',
      // Platform validation
      'packages/platform-validation',
      // Tooling
      'tooling/openapi-gen',
      // Contract tests (architectural invariants)
      'tooling/contract-tests',
      // Governance & AI intelligence packages
      'packages/platform-governance',
      'packages/platform-intelligence',
      'packages/platform-ai-query',
      'packages/platform-anomaly-engine',
      'packages/platform-agent-workflows',
      'packages/platform-ai-governance',
      // Change management
      'packages/platform-change-management',
      // Environment architecture
      'packages/platform-environment',
      'packages/platform-feature-flags',
      // Decision engine
      'packages/platform-decision-engine',
      'packages/decision-core',
      'packages/nar',
      'packages/decision-intelligence',
      'packages/decision-intelligence-engine',
      'packages/decision-evidence',
      'packages/governance-rationale',
      'packages/continuity-analysis',
      'packages/institutional-intelligence',
      'packages/policy-intelligence',
      // AI contract types
      'packages/platform-ai-contract',
      // Control Plane
      'apps/control-plane',
      // Governance packages
      'packages/observability',
      'packages/audit',
      'packages/sage-core',
      'packages/ai-control',
      'packages/contracts',
      'packages/events',
      'packages/governance',
      'packages/security',
      'packages/enforcement',
      // CFO packages
      'packages/cfo-core',
      'packages/cfo-intelligence',
      // Services
      'services/media-worker',
      // CUPE vocabulary
      'packages/cupe-vocabulary',
      // UE AI Assistant
      'packages/ue-assistant',
      // E2E platform proof tests
      'tests/e2e/platform',
      // Platform unification packages
      'packages/platform-contracts',
      'packages/platform-auth',
      'packages/platform-shell',
      'packages/platform-notifications',
      'packages/platform-billing',
      // Intelligence layer
      'packages/intelligence',
      // Workload Intelligence Layer
      'packages/workload-intelligence',
      // CLC Decision Intelligence Layer
      'packages/clc-decision-intelligence',
      // CLC Executive Intelligence Layer
      'packages/clc-executive-intelligence',
      // FSM & Ingestion core
      'packages/fsm-core',
      'packages/ingestion-core',
      // Onboarding & Pilot mode
      'packages/onboarding-core',
      'packages/pilot-mode',
      // Schema core
      'packages/schema-core',
      // Governed workflow
      'packages/governed-workflow',
      // System boundary tests
      'tests/system',
      // Proof scripts unit tests
      'scripts/proof',
      // Finance capability layer
      'packages/finance-core',
      'packages/finance-ledger',
      'packages/finance-compliance',
      'packages/finance-governance',
      'packages/finance-analytics',
      'packages/finance-identity',
    ],
  },
})
