# NzilaOS Claim Verification Report

> Generated: 2026-05-04T01:55:09.188Z

## Summary

| Status | Count |
|--------|-------|
| ✅ implemented | 21 |
| 🟡 partial | 1 |
| 📄 docs-only | 0 |
| 🗺️ roadmap | 0 |
| 🔴 unsupported | 0 |

## PARTIAL (1)

### CFG-001: Zod-validated config with fail-fast at startup
- **Category:** Configuration
- **Source:** ARCHITECTURE.md
- **Status:** partial
- **Evidence:** packages/config
- **Notes:** Zod validation not confirmed

## IMPLEMENTED (21)

### SEC-001: Org-level tenant isolation with row-level security
- **Category:** Security
- **Source:** ARCHITECTURE.md, procurement-pack.md
- **Status:** implemented
- **Evidence:** packages/db/src/schema (org_id columns), packages/platform-isolation

### SEC-002: Azure Key Vault for secrets management
- **Category:** Security
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/secrets

### SEC-003: Secret scanning in CI (Gitleaks + TruffleHog)
- **Category:** Security
- **Source:** procurement-pack.md
- **Status:** implemented
- **Evidence:** .github/workflows, package.json#secret-scan

### AUD-001: Tamper-evident audit trails with hash-chaining
- **Category:** Audit
- **Source:** ARCHITECTURE.md, procurement-pack.md
- **Status:** implemented
- **Evidence:** packages/evidence, packages/platform-proof, hash-chain code

### AUD-002: Evidence packs with sealed artifacts for procurement
- **Category:** Audit
- **Source:** procurement-pack.md, evidence-packs.md
- **Status:** implemented
- **Evidence:** packages/platform-evidence-pack, packages/platform-procurement-proof

### AI-001: AI control plane with per-app profiles and budget enforcement
- **Category:** AI
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/ai-core, packages/platform-governed-ai

### AI-002: ML registry with versioned model activation and approval workflows
- **Category:** AI
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/ml-core, packages/ai-registry

### OBS-001: Structured telemetry with OpenTelemetry and request correlation
- **Category:** Observability
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/otel-core, packages/platform-observability

### DATA-001: Data retention enforcement with audit logging
- **Category:** Data
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/data-lifecycle

### GOV-001: Centralized RBAC/authorization policy engine
- **Category:** Governance
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-policy-engine

### GOV-002: Partner entitlements as data (no hardcoded defaults)
- **Category:** Governance
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/db/src/schema (partner_entities), packages/org

### GOV-003: SBOM generation and build attestation
- **Category:** Governance
- **Source:** procurement-pack.md
- **Status:** implemented
- **Evidence:** package.json#generate:sbom, package.json#attest:build

### FIN-001: QuickBooks Online sync with reconciliation
- **Category:** Finance
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/qbo

### FIN-002: Stripe payment processing with reconciliation
- **Category:** Finance
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/payments-stripe

### PLAT-001: Platform ontology with typed entity taxonomy
- **Category:** Platform
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-ontology

### PLAT-002: Entity graph with cross-domain relationship tracking
- **Category:** Platform
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-entity-graph

### PLAT-003: Event fabric for cross-domain event routing
- **Category:** Platform
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-event-fabric

### PLAT-004: Semantic search across platform data
- **Category:** Platform
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-semantic-search

### PLAT-005: Governed AI with policy controls and compliance
- **Category:** Platform
- **Source:** ARCHITECTURE.md
- **Status:** implemented
- **Evidence:** packages/platform-governed-ai

### TEST-001: Contract tests covering org isolation, authz, stack authority
- **Category:** Testing
- **Source:** ALIGNMENT_REPORT.md
- **Status:** implemented
- **Evidence:** tooling/contract-tests/, package.json#contract-tests

### COMP-001: Compliance snapshots for point-in-time auditing
- **Category:** Compliance
- **Source:** procurement-pack.md
- **Status:** implemented
- **Evidence:** packages/platform-compliance-snapshots
