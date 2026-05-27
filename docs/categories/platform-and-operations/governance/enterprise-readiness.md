# Nzila OS — Enterprise Readiness Index

> Audit-grade enterprise readiness documentation for procurement, compliance, and governance review.

---

## Table of Contents

| #  | Domain                    | Document                                                              | Status     |
|----|---------------------------|-----------------------------------------------------------------------|------------|
| 1  | Architecture              | [ARCHITECTURE.md](../../ARCHITECTURE.md)                                 | Complete   |
| 2  | Governance                | [governance/](../governance/)                                         | Complete   |
| 3  | Compliance                | [Compliance Snapshots](../../packages/platform-compliance-snapshots/)    | Complete   |
| 4  | Evidence Systems          | [Evidence Pack](../../packages/platform-evidence-pack/)                  | Complete   |
| 5  | Supply Chain Integrity    | [SBOM Generator](../../scripts/generate-sbom.ts)                        | Complete   |
| 6  | Observability             | [Platform Observability](../../packages/platform-observability/)         | Complete   |
| 7  | Disaster Recovery         | [disaster-recovery.md](../ops/disaster-recovery.md)                          | Complete   |
| 8  | Incident Response         | [incident-response.md](../ops/incident-response.md)                         | Complete   |
| 9  | Verification Procedures   | [Verification](#9-verification-procedures)                              | Complete   |

---

## 1. Architecture

The platform architecture is documented in [ARCHITECTURE.md](../../ARCHITECTURE.md). Key properties:

- Monorepo with strict package boundaries
- Deterministic builds via lockfile-pinned dependencies
- ISO UTC timestamps across all subsystems
- Org-scoped terminology (never tenant)
- No `console.*` calls — structured logging only

---

## 2. Governance

All governance artefacts reside in [`governance/`](../governance/):

- **AI governance** — model cards, evaluation harness, bias reports
- **Business governance** — org policies, partner agreements
- **Corporate governance** — board reporting, corporate structure
- **Security governance** — threat models, penetration test reports
- **GA readiness** — general-availability checklists per vertical

---

## 3. Compliance

The compliance system produces deterministic, hash-chained snapshots:

- **Compliance snapshots** — `packages/platform-compliance-snapshots/`
- **Hash chain** — `packages/platform-hash-chain/`
- **Policy engine** — `packages/platform-policy-engine/`

Policy definitions live in [`ops/`](../ops/):

| Policy                | Path                           |
|-----------------------|--------------------------------|
| SLO                   | `ops/slo-policy.yml`           |
| Cost                  | `ops/cost-policy.yml`          |
| Dependencies          | `ops/dependency-policy.yml`    |
| Integration           | `ops/integration-policy.yml`   |
| Performance budgets   | `ops/perf-budgets.yml`         |

---

## 4. Evidence Systems

Evidence artefacts are reproducible and hash-verified:

| Component                   | Location                                           |
|-----------------------------|-----------------------------------------------------|
| Evidence pack generator     | `packages/platform-evidence-pack/`                  |
| Procurement proof           | `packages/platform-procurement-proof/`              |
| Build attestation           | `scripts/attest-build.ts`                           |
| Evidence reproducibility    | `scripts/reproduce-evidence.ts`                     |
| Attestation output          | `ops/security/build-attestation.json`               |

---

## 5. Supply Chain Integrity

Supply-chain integrity is enforced through:

| Check                       | Tool                                                |
|-----------------------------|-----------------------------------------------------|
| SBOM generation             | `scripts/generate-sbom.ts` (CycloneDX format)       |
| Build attestation           | `scripts/attest-build.ts` (ed25519 signed)           |
| Vulnerability policy        | `tooling/security/supply-chain-policy.ts`            |
| Dependency audit            | `.github/workflows/dependency-audit.yml`             |
| Trivy container scan        | `.github/workflows/trivy.yml`                        |
| Secret scanning             | `.github/workflows/secret-scan.yml`                  |

SBOM output: `ops/security/sbom.json`

---

## 6. Observability

Structured observability is provided by `packages/platform-observability/`:

- **Structured logger** — severity-levelled events with correlation
- **Correlation IDs** — audit correlation across request boundaries
- **Health checks** — subsystem health probes
- **Metrics** — counters, histograms, gauges
- **Spans** — distributed tracing primitives

Log structure:

```json
{
  "event": "string",
  "severity": "info | warn | error | fatal",
  "request_id": "uuid",
  "correlation_id": "uuid",
  "org_id": "string",
  "timestamp": "ISO 8601 UTC",
  "metadata": {}
}
```

---

## 7. Disaster Recovery

Full disaster recovery plan: [disaster-recovery.md](../ops/disaster-recovery.md)

Key targets:

| Metric | Target        |
|--------|---------------|
| RTO    | 4 hours       |
| RPO    | 1 hour        |

Verification: `pnpm exec tsx scripts/backup-verify.ts`

---

## 8. Incident Response

Full incident response plan: [incident-response.md](../ops/incident-response.md)

Severity levels:

| Level | Label      | Response target |
|-------|------------|-----------------|
| SEV-1 | Critical   | 15 minutes      |
| SEV-2 | High       | 1 hour          |
| SEV-3 | Medium     | 4 hours         |
| SEV-4 | Low        | 24 hours        |

Evidence packs are linked as forensic artefacts for post-incident review.

---

## 9. Verification Procedures

All verification commands and their purpose:

| Command                    | Purpose                                      |
|----------------------------|----------------------------------------------|
| `pnpm exec tsx tooling/build-env-check.ts`         | Validate Node, pnpm, lockfile, env vars       |
| `pnpm exec tsx scripts/generate-sbom.ts`      | Generate CycloneDX SBOM                      |
| `pnpm exec tsx scripts/attest-build.ts`       | Sign build attestation (ed25519)              |
| `pnpm exec tsx scripts/validate-procurement-pack.ts`      | Validate procurement pack completeness        |
| `pnpm exec tsx scripts/reproduce-evidence.ts` | Verify evidence reproducibility               |
| `pnpm exec tsx tooling/security-headers-check.ts`    | Check security headers (CSP, HSTS, etc.)      |
| `pnpm exec tsx scripts/backup-verify.ts`      | Verify backup integrity                       |
| `pnpm exec tsx scripts/platform-health-report.ts`      | Generate platform health report               |
| `pnpm contract-tests`     | Run architectural invariant tests             |
| `pnpm exec tsx scripts/demo-golden-path.ts`        | Run golden-path demo artefact generation       |

### Full Validation Sequence

```bash
pnpm exec tsx tooling/build-env-check.ts
pnpm exec tsx scripts/generate-sbom.ts
pnpm exec tsx scripts/validate-procurement-pack.ts
pnpm exec tsx scripts/reproduce-evidence.ts
pnpm exec tsx tooling/security-headers-check.ts
pnpm exec tsx scripts/platform-health-report.ts
pnpm exec tsx scripts/demo-golden-path.ts
```

Expected output:

```
✔ Environment validated
✔ SBOM generated
✔ Procurement pack valid
✔ Evidence reproducible
✔ Security headers valid
✔ Platform health report generated
✔ Demo artifacts generated
```

---

## CI Pipeline

The CI pipeline (`.github/workflows/ci.yml`) enforces all gates:

1. Lint & typecheck
2. Unit tests
3. Contract tests (architectural invariants)
4. AI eval gate
5. ML tooling gates
6. Schema drift detection
7. Red-team adversarial tests
8. Hash chain drift detection
9. **Enterprise hardening gate** — `verify:env`, `pnpm exec tsx scripts/generate-sbom.ts`, `pnpm exec tsx scripts/validate-procurement-pack.ts`, `verify:security`, `pnpm exec tsx scripts/platform-health-report.ts`
10. Ops pack validation

All gates must pass before merge to `main`.

---

*Generated for Nzila OS enterprise readiness assessment.*
