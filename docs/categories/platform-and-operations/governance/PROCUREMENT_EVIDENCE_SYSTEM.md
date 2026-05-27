# Procurement Evidence System

> End-to-end evidence collection, validation, and export for enterprise procurement.

## Overview

The Procurement Evidence System enables Nzila OS to generate auditable evidence packs for enterprise procurement processes (RFPs, SOC 2, ISO 27001, vendor assessments). Every claim is backed by verifiable evidence.

## Architecture

```
App Endpoints        Platform Packages         Outputs
─────────────        ─────────────────         ───────
/api/evidence/export → platform-evidence-pack → Evidence Pack JSON
/api/health          → platform-observability  → Health Status
/api/metrics         → platform-observability  → Operational Metrics
policy-enforcement   → platform-policy-engine  → Policy Audit Trail
governance:check     → platform-governance     → Compliance Report
```

## Evidence Pack Structure

Each app exports evidence via `GET /api/evidence/export`:

```json
{
  "app": "flow",
  "version": "0.1.0",
  "generated_at": "2025-01-15T10:30:00Z",
  "git_commit": "abc123def",
  "build_timestamp": "2025-01-15T10:00:00Z",
  "sbom": {
    "format": "CycloneDX",
    "ref": "/sbom.json"
  },
  "policy_checks": [
    {
      "policy": "quote_generation",
      "result": "pass",
      "timestamp": "2025-01-15T10:29:00Z"
    }
  ],
  "compliance": {
    "level": "full",
    "checks_passed": 6,
    "checks_total": 6
  }
}
```

## Evidence Categories

### 1. Software Supply Chain

- **SBOM**: CycloneDX Software Bill of Materials
- **Dependency Audit**: Vulnerability scanning via Snyk and Trivy
- **Build Attestation**: Cryptographic attestation of build artifacts
- **Reproducible Builds**: Evidence of deterministic build output

### 2. Security Controls

- **Policy Engine**: All sensitive operations enforced through platform-policy-engine
- **Approval Workflows**: Threshold-based approvals for high-value operations
- **Audit Trail**: Complete record of policy evaluations and decisions
- **Secret Scanning**: Automated detection of credentials in code

### 3. Operational Maturity

- **Health Endpoints**: Every app exposes /api/health
- **Metrics Collection**: Standardized metrics (request_count, error_rate, latency_ms)
- **Observability**: Structured logging and tracing
- **SLO Monitoring**: Service level objective tracking

### 4. Testing & Quality

- **Unit Tests**: Vitest-based test suites (no `--passWithNoTests`)
- **E2E Tests**: Playwright end-to-end specifications
- **Contract Tests**: Cross-package API contract validation
- **Type Safety**: Full TypeScript coverage with strict mode

### 5. Governance

- **Compliance Checks**: 6-point app compliance validation
- **Drift Detection**: Automated compliance drift via CI/CD
- **Governance Timeline**: Timestamped audit of all governance events
- **AI Governance**: Model registry, prompt versioning, decision logging

## Validation Commands

| Command | Purpose |
|---------|---------|
| `pnpm exec tsx scripts/governance-check.ts` | Validate app compliance (6-point check) |
| `pnpm exec tsx scripts/validate-procurement-pack.ts` | Validate procurement pack completeness |
| `pnpm exec tsx packages/platform-validation/src/run-all.ts` | Run all validation suites |
| `pnpm exec tsx scripts/generate-sbom.ts` | Generate Software Bill of Materials |
| `pnpm exec tsx scripts/attest-build.ts` | Create build attestation |
| `pnpm exec tsx scripts/reproduce-evidence.ts` | Verify evidence reproducibility |

## Per-App Evidence Endpoints

| App | Endpoint | Status |
|-----|----------|--------|
| flow | `/api/evidence/export` | ✅ Active |
| cfo | `/api/evidence/export` | ✅ Active |
| partners | `/api/evidence/export` | ✅ Active |
| web | `/api/evidence/export` | ✅ Active |
| union-eyes | `/api/evidence/export` | ✅ Active |
| console | `/api/evidence/export` | ✅ Active |

## CI/CD Integration

### Evidence Collection (Daily)

- SBOM generation
- Policy evaluation snapshot
- Health endpoint verification
- Metrics collection

### Compliance Reporting (Weekly)

- SOC 2 Type II evidence compilation
- ISO 27001 control mapping
- Governance compliance report
- Drift detection summary

### Procurement Pack Generation

```bash
pnpm exec tsx scripts/validate-procurement-pack.ts
```

Generates a complete procurement evidence package suitable for enterprise vendor assessment.
