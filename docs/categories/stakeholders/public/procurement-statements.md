# Union Eyes — Approved Procurement Statements

> **Classification:** Buyer-shareable  
> **Generated from:** `apps/union-eyes/maturity.json`, `reports/dr/`, `ops/compliance/`  
> **Last Updated:** 2026-04-24  
> **Purpose:** Approved language for security questionnaires, RFPs, procurement forms,
> and IT governance reviews. Every statement maps to a verifiable artifact.

---

## How to Use This Document

Use these statements verbatim in procurement responses. Do not expand or
soften the caveats — they are intentional and protect both parties.
If a statement does not yet apply, do not use it.

Requests for supporting evidence should be directed to partnership@.

---

## Business Continuity

> **Statement BC-01:**
> Union Eyes maintains a quarterly disaster recovery drill cadence with
> published runbooks (`docs/union-eyes/dr/`), a reproducible drill script
> (`pnpm exec tsx scripts/db/restore-drill.ts`), and a structured evidence artifact program
> (`reports/dr/`). The first evidence-mode drill was completed on 2026-04-24.
>
> **Statement BC-02:**
> Recovery Time Objective (RTO) is documented as ≤ 4 hours. This target is
> backed by Azure PITR, Infrastructure-as-Code for full environment rebuild, and
> a 90-day container registry. Live staging measurement is scheduled for 2026-Q2.
> We will not claim a measured RTO until it is tested.
>
> **Statement BC-03:**
> Recovery Point Objective (RPO) is documented as ≤ 1 hour. Azure PostgreSQL
> Flexible Server Continuous PITR (Write-Ahead Log streaming) provides an
> architectural RPO approaching the last committed transaction. The 1-hour
> figure is a conservative operational target that accounts for detection and
> declaration time.
>
> **Statement BC-04:**
> Database backups are retained for 35 days (PITR) with geo-redundant storage
> (Azure RA-GRS) and 90 days for pg_dump full backups. Evidence packs are
> retained for 7 years in geo-redundant immutable blob storage.

---

## Data Security

> **Statement DS-01:**
> All data is isolated at the database layer using PostgreSQL Row-Level
> Security (RLS). Cross-tenant data access is architecturally impossible
> from a correctly provisioned query — the database enforces the boundary
> independently of the application layer.
>
> **Statement DS-02:**
> Evidence packs are sealed with AES-256 HMAC at the time of export. The
> seal is verified on every download. Tampering is detectable and creates an
> immutable audit event.
>
> **Statement DS-03:**
> All audit events are written to a hash-chained append-only table
> (`audit_events`). Each event stores `hash` and `prev_hash` fields that
> form a cryptographic chain. Deletion or reordering of audit events is
> detectable.
>
> **Statement DS-04:**
> Data residency: primary in Azure Canada Central; geo-redundant secondary in
> Canada East. No data is processed or stored outside Canada except where
> explicitly agreed.
>
> **Statement DS-05:**
> All data is encrypted at rest (AES-256, Azure-managed) and in transit
> (TLS 1.2 minimum). Secrets are stored in Azure Key Vault with 90-day
> auto-rotation and purge protection.

---

## Identity & Access

> **Statement IA-01:**
> Authentication is enforced via Microsoft Entra ID (Azure AD) with
> mandatory Single Sign-On. Username/password bypass is not available.
>
> **Statement IA-02:**
> Multi-factor authentication is enforced via Entra policy for all users.
> There is no MFA exception path.
>
> **Statement IA-03:**
> User provisioning and deprovisioning is managed via SCIM through Entra.
> Deprovisioned accounts lose access immediately.
>
> **Statement IA-04:**
> Role-based access control is enforced across five tiers: member, steward,
> LRO, officer, admin. Permissions are non-overlapping and defined in
> `docs/pilot/cupe/CUPE_RBAC_MATRIX.md`.
>
> **Statement IA-05:**
> Privileged access reviews are performed quarterly. Attestation artifacts
> are stored in `reports/compliance/access-review/`. The framework was
> activated in 2026-Q2.

---

## Development Security

> **Statement DEV-01:**
> Every pull request passes: Gitleaks secret scan, CodeQL SAST, Trivy SCA,
> and automated lint/typecheck/unit tests. Secrets cannot be merged to `main`
> without triggering CI failure.
>
> **Statement DEV-02:**
> A CycloneDX Software Bill of Materials (SBOM) is generated on every
> release and attached as a CI artifact.
>
> **Statement DEV-03:**
> Pre-commit hooks (Lefthook) enforce Gitleaks, lint, and typecheck on every
> developer commit before it can leave the local machine.
>
> **Statement DEV-04:**
> Dependencies are audited weekly via Dependabot. Dynamic application security
> testing (DAST) runs weekly.

---

## Compliance

> **Statement COMP-01:**
> SOC 2 Type I is targeted for Q3 2026. Current self-assessed readiness against
> Trust Services Criteria is 95%. No SOC 2 certificate has been issued.
>
> **Statement COMP-02:**
> ISO 27001:2022 is targeted for Q2 2027. Current self-assessed readiness
> against Annex A controls is 92%. No ISO 27001 certificate has been issued.
>
> **Statement COMP-03:**
> We do not claim certifications we have not received. All compliance targets
> are dated milestones tracked in `ops/compliance/CERTIFICATION_ROADMAP.md`.

---

## Transparency

> **Statement TR-01:**
> We publish our maturity gaps and target closure dates in
> `apps/union-eyes/maturity.json`. This file is the authoritative source
> of truth for product maturity and is committed to the repository.
>
> **Statement TR-02:**
> We share full procurement evidence packages (DR runbooks, access review
> attestations, maturity JSON, CAPE audit report) directly under NDA for
> enterprise reviews.

---

_Statements generated 2026-04-24 · Artifacts map to `reports/`, `docs/`, `ops/compliance/`_
