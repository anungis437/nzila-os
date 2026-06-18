# SOC 2 Control Mapping — Nzila OS

> Maps SOC 2 2017 Trust Services Criteria (TSC) Common Criteria CC1–CC9 to
> existing Nzila OS controls. Each row links a criterion to its
> implementation, evidence source, and current readiness.

**Legend** —
✅ Implemented & evidenced ·
🟡 Implemented, evidence partial ·
🔴 Gap (see [`gap-log.md`](./gap-log.md))

## CC1 — Control Environment

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC1.1 Integrity & ethics | Code of Conduct, contributor agreements | `CONTRIBUTING.md`, `SECURITY.md` | ✅ |
| CC1.2 Board oversight | Governance councils, decision logs | `governance/`, `docs/categories/decision-records/` | 🟡 (formal board minutes pending) |
| CC1.3 Org structure | Team charter, CODEOWNERS | `CODEOWNERS`, `docs/categories/platform-and-operations/team-structure.md` | ✅ |
| CC1.4 Competency | Training records | — | 🔴 (no formal training tracker) |
| CC1.5 Accountability | Role definitions, on-call rotations | `governance/`, runbooks | 🟡 |

## CC2 — Communication & Information

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC2.1 Internal information | Decision records, ADRs | `docs/categories/decision-records/` | ✅ |
| CC2.2 Internal communication | Slack-equivalent + standups | — | 🟡 (process documented, evidence ad-hoc) |
| CC2.3 External communication | Trust page, DPA, vendor questionnaire | `apps/veridian-site/app/trust/`, `docs/categories/platform-and-operations/governance/dpa-template.md` | ✅ |

## CC3 — Risk Assessment

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC3.1 Specify objectives | Charter, OKRs | `docs/` | 🟡 |
| CC3.2 Identify risks | Risk register | `governance/risk-register.md` (if present) | 🟡 |
| CC3.3 Fraud risk | AI boundary enforcement, audit trail | `tooling/contract-tests/ai-boundary-*`, `apps/union-eyes/lib/audit-logger.ts` | ✅ |
| CC3.4 Change assessment | PR review + contract tests | `.github/workflows/`, `tooling/contract-tests/` | ✅ |

## CC4 — Monitoring

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC4.1 Ongoing monitoring | CI gates, governance audit | `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts`, `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts` | ✅ |
| CC4.2 Deficiency communication | Issue tracker, retro logs | GitHub Issues, `governance/` | 🟡 |

## CC5 — Control Activities

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC5.1 Selection of controls | Contract tests as invariant gates | `tooling/contract-tests/` | ✅ |
| CC5.2 Technology controls | RLS, RBAC, middleware org guards | `apps/union-eyes/db/`, `apps/union-eyes/lib/auth/`, 238 RLS policies | ✅ |
| CC5.3 Policies & procedures | Runbooks, governance docs | `docs/categories/platform-and-operations/` | ✅ |

## CC6 — Logical & Physical Access

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC6.1 Logical access | Argon2id passwords, MFA, RBAC | `apps/union-eyes/lib/auth/`, `apps/union-eyes/db/schema/` | ✅ |
| CC6.2 User registration | Provisioning workflows | `apps/union-eyes/app/api/admin/` | 🟡 |
| CC6.3 Role-based access | Per-org RBAC | `apps/union-eyes/lib/auth/rbac.ts` | ✅ |
| CC6.4 Restricts physical access | Azure Canada Central — Microsoft attestation | Azure SOC 2 / ISO reports | ✅ (inherited) |
| CC6.5 Decommissions assets | Azure-managed | Azure attestation | ✅ (inherited) |
| CC6.6 Restricts logical access | Network isolation, VPN | Azure NSG configs | 🟡 |
| CC6.7 Restricts info movement | Signed URLs, scoped tokens | `apps/union-eyes/lib/storage/`, planned PR-040 | 🟡 |
| CC6.8 Prevents unauthorized software | Trivy, dependabot, signed releases | `.github/workflows/security-*.yml` | ✅ |

## CC7 — System Operations

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC7.1 Detection of vulnerabilities | Trivy, secret scan, SBOM | CI logs | ✅ |
| CC7.2 Monitoring of system | Structured logs + correlation IDs | `apps/union-eyes/backend/observability/`, OS-core telemetry | ✅ (Django parity shipped May 2026) |
| CC7.3 Evaluation of security events | Audit log + hash chain | `apps/union-eyes/lib/audit-logger.ts`, `apps/union-eyes/lib/evidence-export.ts` | ✅ |
| CC7.4 Incident response | Runbooks | `docs/categories/platform-and-operations/runbooks/` | 🟡 |
| CC7.5 Recovery | Backup + restore procedures | Azure-managed; pilot DR runbook pending | 🟡 |

## CC8 — Change Management

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC8.1 Authorized changes | Branch protection, CODEOWNERS, PR reviews | `.github/`, repo settings | ✅ |

## CC9 — Risk Mitigation

| Criterion | Control | Evidence | Status |
|-----------|---------|----------|--------|
| CC9.1 Business disruption mitigation | Backup, multi-zone | Azure-managed | 🟡 |
| CC9.2 Vendor management | Vendor questionnaire, DPA | `docs/categories/platform-and-operations/governance/` | ✅ |

## Availability, Confidentiality, Privacy

| Category | Control | Evidence | Status |
|----------|---------|----------|--------|
| A1.1 Capacity | Resource monitoring + explicit thresholds | Azure metrics + `docs/compliance/soc2/capacity-scaling-thresholds.md` | ✅ |
| A1.2 Backups | Azure-managed backups | Azure attestation | ✅ (inherited) |
| C1.1 Confidentiality | TLS 1.3, AES-256-at-rest, HMAC seal | Azure, `apps/union-eyes/lib/evidence-export.ts` | ✅ |
| C1.2 Disposal | Data retention policy | `docs/categories/platform-and-operations/governance/data-retention.md` (if present) | 🟡 |
| P1–P8 Privacy | PIPEDA-aware DPA, no-training AI | `docs/categories/platform-and-operations/governance/dpa-template.md` | ✅ |
