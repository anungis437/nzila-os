# Auditor's Guide — Nzila OS

> If you are performing a compliance audit, security review, or governance
> assessment of Nzila OS, start here.

---

## Audit Surface

Nzila OS provides five categories of verifiable evidence:

| Category | What You Get | How to Verify |
|----------|-------------|---------------|
| **Evidence packs** | Per-action tamper-evident bundles (hash-chained, Azure Blob sealed) | Hash-chain verification: any altered record breaks the chain |
| **Compliance snapshots** | Point-in-time compliance state (deterministic, hash-chained) | Reproduce via `pnpm exec tsx packages/platform-validation/src/run-all.ts` |
| **Build attestation** | Ed25519-signed build provenance | Verify signature against published public key |
| **SBOM** | CycloneDX software bill of materials | `scripts/generate-sbom.ts` → `ops/security/sbom.json` |
| **Procurement pack** | Signed ZIP bundle (security + data + ops + governance + sovereignty) | 5-step verification in [procurement-pack.md](../governance/procurement-pack.md) |

---

## Governance Controls

### Architecture Enforcement (automated, CI-blocking)

| Control | Script | What It Checks |
|---------|--------|---------------|
| Layer boundaries | `architecture-layer-check.ts` | No app→app coupling, no upward dependencies |
| Domain-core standard | `app-domain-core-check.ts` | Domain code uses canonical packages |
| Platform surface model | `platform-surface-model-check.ts` | Platform services match declared surfaces |
| Platform contracts | `platform-contract-check.ts` | Contract tests pass (5,000+ invariants) |
| Registry consistency | `registry-consistency-check.ts` | `platform/registry/` JSON matches reality |
| Control-plane coherence | `control-plane-coherence-check.ts` | Control-plane wiring matches declarations |
| **Platform adoption** | `platform-adoption-gate.ts` | All 15 apps adopt shell, schema, workflow, observability |
| Governance gate | `validate-governance-gate.ts` | 8 governance packages present (fail-closed, no skip flags) |
| App gold standard | `app-gold-standard-check.ts` | Health, metrics, evidence, policy, tests, docs |

**Composite command**: `pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts` runs all architecture gates.

### Governance Data

| Artefact | Location |
|----------|----------|
| Corporate policies | `governance/corporate/governance/` (24+ policies) |
| AI governance | `governance/ai/` + [AI Platform Contract](../architecture/AI_PLATFORM_CONTRACT.md) |
| Security policies | `governance/security/` + [SECURITY.md](../../SECURITY.md) |
| GA readiness | `governance/ga/ga-check.json` + [GA_CHECK_REPORT.md](../../governance/ga/GA_CHECK_REPORT.md) |
| Control manifests | `tooling/governance/validate-control-manifests.ts` (CM-001 through CM-009) |

---

## Evidence Pipeline

The evidence pipeline follows a three-phase governed workflow:

```
Ingestion Phase → FSM Phase → Evidence Phase
     │                │              │
     ▼                ▼              ▼
  Validate &       State machine    Seal evidence,
  normalize data   transitions      hash-chain,
  (schema-core)    (fsm-core)       store to Blob
```

**Package**: `@nzila/governed-workflow` — `executeGovernedWorkflow()` is the
single entry point. Every workflow produces a `GovernedWorkflowRecord` with:

- Ingestion result (validated input + schema version)
- FSM trace (every state transition with timestamps)
- Evidence artefact (sealed, hash-verified, stored)

---

## Security Controls

### Supply Chain

| Control | Mechanism |
|---------|-----------|
| Dependency audit | `dependency-audit.yml` — automated CVE scanning |
| Vulnerability policy | `supply-chain-policy.ts` — fail-closed, waiver-based |
| Secret scanning | Gitleaks + TruffleHog on every commit |
| Container scanning | Trivy with CRITICAL severity threshold |
| SBOM | CycloneDX format, generated on every release |

### Authentication & Authorization

| Control | Implementation |
|---------|---------------|
| Password hashing | Argon2id (OWASP parameters) |
| Session management | Opaque tokens in `auth_user_sessions` table |
| Account lockout | 5 failed attempts → 15-minute lockout |
| SSO | Optional Microsoft Entra ID (OAuth2/OIDC) |
| RBAC | 5 roles: Platform Admin, Studio Admin, Ops, Analyst, Viewer |
| Org isolation | Row-level org scoping — enforced at code, DB, and CI levels |

### Data Protection

| Control | Implementation |
|---------|---------------|
| PII redaction | Structured logger with automatic PII field scrubbing |
| Encryption at rest | Azure-managed keys (Blob, DB, Key Vault) |
| Encryption in transit | TLS 1.2+ enforced |
| Retention | Configurable per-entity retention policies with audit logging |
| Breach notification | 72-hour notification policy documented |

---

## Verification Commands

An auditor with repository access can independently verify:

```bash
# Run all architecture gates
pnpm exec tsx scripts/architecture-layer-check.ts && pnpm exec tsx scripts/app-domain-core-check.ts && pnpm exec tsx scripts/platform-surface-model-check.ts && pnpm exec tsx scripts/platform-authority-check.ts && pnpm exec tsx scripts/platform-contract-check.ts && pnpm exec tsx scripts/registry-consistency-check.ts && pnpm exec tsx scripts/control-plane-coherence-check.ts && pnpm exec tsx scripts/platform-adoption-gate.ts

# Run all governance checks
pnpm exec tsx tooling/ga-check/ga-check.ts && pnpm contract-tests && pnpm inventory:check && pnpm exec tsx scripts/check-brand-leakage.ts && pnpm exec tsx scripts/validate-product-catalog.ts && pnpm exec tsx scripts/validate-portfolio.ts && pnpm exec tsx scripts/validate-canonical-truth.ts && pnpm exec tsx scripts/validate-truth-authority.ts && pnpm exec tsx scripts/validate-auth-authority.ts && pnpm exec tsx scripts/validate-ga-state.ts && pnpm exec tsx scripts/validate-workspace-links.ts && pnpm exec tsx scripts/validate-release-strict.ts && pnpm exec tsx scripts/generate-commercial-traction.ts

# Run platform adoption gate (shell, schema, workflow, observability)
pnpm exec tsx scripts/platform-adoption-gate.ts

# Validate control manifests (CM-001 through CM-009)
pnpm exec tsx tooling/governance/validate-control-manifests.ts

# Generate SBOM
pnpm exec tsx scripts/generate-sbom.ts

# Run contract tests (5,000+ invariants)
pnpm contract-tests

# Reproduce evidence pack
pnpm exec tsx scripts/reproduce-evidence.ts

# Full validation suite
pnpm exec tsx packages/platform-validation/src/run-all.ts
```

---

## Key Documents

| Document | Purpose | Path |
|----------|---------|------|
| Enterprise Readiness | Full audit index | [enterprise-readiness.md](../governance/enterprise-readiness.md) |
| Architecture | System design | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Security | Security posture | [SECURITY.md](../../SECURITY.md) |
| Auth Architecture | Dual auth model | [AUTH_ARCHITECTURE.md](../architecture/AUTH_ARCHITECTURE.md) |
| Change Policy | Change management | [CHANGE_POLICY.md](../governance/CHANGE_POLICY.md) |
| Vulnerability Disclosure | Responsible disclosure | [vulnerability-disclosure-policy.md](../governance/vulnerability-disclosure-policy.md) |
| App Gold Standard | Per-app compliance baseline | [APP_GOLD_STANDARD.md](../governance/APP_GOLD_STANDARD.md) |
| Adoption Gate | Platform mandate enforcement | [platform-adoption-gate.ts](../../scripts/platform-adoption-gate.ts) |

---

## Next Steps

| Goal | Link |
|------|------|
| Buyer's view | [01-buyer.md](01-buyer.md) |
| Operator's view | [02-operator.md](02-operator.md) |
| Full architecture | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Procurement pack | [procurement-pack.md](../governance/procurement-pack.md) |
