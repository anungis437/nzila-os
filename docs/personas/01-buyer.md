# Buyer's Guide — Nzila OS

> If you are evaluating Nzila OS for procurement, partnership, or integration,
> start here.

---

## What is Nzila OS?

Nzila OS is the internal operating system for Nzila Digital Ventures. It
powers every product line — agriculture, commerce, trade, finance, case
management — through a single audited platform with tamper-evident evidence,
org-scoped multi-tenancy, and automated compliance gates.

For a full business overview see [README.business.md](../../README.business.md).

---

## Evidence & Proof

| Artefact | Description | Location |
|----------|-------------|----------|
| Procurement Pack | Signed, verifiable ZIP with security, data, ops, governance, sovereignty proofs | [procurement-pack.md](../governance/procurement-pack.md) |
| Evidence Packs | Per-action tamper-evident bundles (hash-chained, Azure Blob sealed) | [evidence-packs.md](../architecture/evidence-packs.md) |
| Build Attestation | Ed25519-signed build provenance + SBOM | [SBOM & attestation](../governance/enterprise-readiness.md#5-supply-chain-integrity) |
| Compliance Snapshots | Deterministic, hash-chained compliance point-in-time records | [compliance-snapshots.md](../architecture/compliance-snapshots.md) |

---

## Security Posture

| Control | How It Works |
|---------|-------------|
| Dependency scanning | Automated on every PR + weekly (Snyk, Trivy, CodeQL) |
| Supply-chain integrity | CycloneDX SBOM + Ed25519 build attestation |
| Secret scanning | Gitleaks + TruffleHog on every commit |
| Container scanning | Trivy with CRITICAL severity threshold |
| Vulnerability policy | Fail-closed gate — no unwaived CRITICAL/HIGH vulns ship |
| Penetration testing | Documented plan in [pentest-plan.md](../governance/pentest-plan.md) |
| Secure coding | Training programme in [secure-coding-training.md](../governance/secure-coding-training.md) |

For full details see [SECURITY.md](../../SECURITY.md) and the
[Enterprise Readiness Index](../governance/enterprise-readiness.md).

---

## Governance & Compliance

| Domain | Documentation |
|--------|--------------|
| Corporate governance | Board continuity, succession, cap table, SAFE mechanics — `governance/corporate/` |
| AI governance | Model cards, budget caps, evaluation harness, no-shadow-AI enforcement — [AI Platform Contract](../architecture/AI_PLATFORM_CONTRACT.md) |
| Change management | Formal change requests, approval workflows, change calendar — [Change Policy](../governance/CHANGE_POLICY.md) |
| Data lifecycle | Retention policies, 72-hour breach notification, org-scoped isolation |
| Financial controls | QBO sync, Stripe reconciliation, tax calendar — CFO app |

---

## Architecture (executive summary)

| Property | Detail |
|----------|--------|
| Monorepo | 170+ packages, strict layer boundaries, deterministic lockfile builds |
| Multi-tenancy | Organisation-scoped — no global data, no cross-org leakage |
| Platform shell | All internal apps share NzilaAppShell (auth, nav, org picker, telemetry) |
| Observability | Full OpenTelemetry stack — traces, metrics, SLO burn-rate alerting |
| Schema validation | Zod-based domain schemas via `@nzila/schema-core` — 13 domain modules |
| Evidence pipeline | Ingestion → FSM → Evidence sealed workflow via `@nzila/governed-workflow` |
| CI gates | 12+ automated checks block deployment on any failure (no skip flags) |

For the full technical architecture see [ARCHITECTURE.md](../../ARCHITECTURE.md).

---

## Verification Procedure

To independently verify a procurement pack:

1. Download the pack ZIP from the Proof Center (`/api/proof-center/export`)
2. Retrieve the Ed25519 public key (`/api/proof-center/public-key`)
3. Verify the signature on `MANIFEST.json`
4. Hash-check every file against the manifest
5. Confirm the `keyId` matches expected signing identity

Full procedure: [Procurement Pack docs](../governance/procurement-pack.md).

---

## Next Steps

| Goal | Link |
|------|------|
| Deep technical evaluation | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Governance audit | [Enterprise Readiness Index](../governance/enterprise-readiness.md) |
| Operator's view | [02-operator.md](02-operator.md) |
| Auditor's view | [03-auditor.md](03-auditor.md) |
