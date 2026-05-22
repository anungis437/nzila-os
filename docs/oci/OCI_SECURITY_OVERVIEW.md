# OCI Security Overview

**ARTIFACT TYPE:** Institutional Doctrine — Procurement Disclosure
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**INTENDED READER:** institutional procurement, governance counsel, IT security review
**PARENT DOCTRINE:** [docs/doctrine/DOCTRINE.md](../doctrine/DOCTRINE.md)

> This document describes the security posture under which OCI
> operates. It is written for institutional reviewers — procurement,
> governance counsel, and IT security — who require a plain account
> of where data lives, who can reach it, and how access is governed.

---

## Hosting and residency

OCI institutional runtime is hosted in Microsoft Azure, in the
Canada Central region (Toronto), under the resource group
`nzila-canada-staging-rg` for staging deployments and an equivalent
`nzila-canada-${env}-rg` pattern for each environment.

Data residency for Canadian institutional pilots is Canadian by
default. Cross-border processing, where it occurs (for example, model
inference for hosted reasoning), is documented in
[OCI Data Handling](./OCI_DATA_HANDLING.md) and is bounded by
contract.

---

## Identity and authentication

Institutional users authenticate through one of two paths, at the
institution's choice:

- **Microsoft Entra ID single sign-on.** Recommended for institutions
  that already operate Entra-managed identity. The OCI platform is
  registered as an Entra application (tenant
  `5082b8be-b04d-4a13-b61c-b6397670177b`, application
  `b7b0cb9a-110d-4bf4-baa7-d936d7450181`) and resolves group
  membership through the institution's Entra directory.
- **Platform-managed email and password.** Argon2id password hashing
  (OWASP-recommended parameters). Opaque session tokens, stored in
  the `auth_user_sessions` table, communicated via the `nzila_session`
  cookie. Lockout after five failed attempts for fifteen minutes.

Both paths are mediated by `@nzila/platform-auth`. Session
resolution prefers the platform session cookie, with Entra JWT as
the documented fallback. Either path can be disabled per institution
on request.

---

## Secrets and key management

Application secrets — database credentials, authentication
secrets, Entra client secrets, third-party API keys — are stored in
Azure Key Vault (`nzila-staging-kv` for staging; equivalent vaults
per environment). No secret is committed to source control.
Container apps reference secrets through managed identity, not
through environment variables containing secret material at rest.

Rotation cadence:

- Entra client secret: two-year rotation, calendar-tracked.
- Database credentials: rotated on operator change or annually,
  whichever is sooner.
- Session signing material: rotated on application boundary changes
  or annually.

---

## Application boundary

Institutional users reach OCI through Azure Container Apps in the
Canada Central environment (`nzila-canada-staging-env`). The
runtime surface includes:

- the institutional web application,
- the institutional console,
- the partner intake surface,
- the continuity portal (where pilot scope includes member
  surfaces),
- a Django sidecar carrying the authoritative case and continuity
  data model.

Each application is deployed as a container image from the
institutional container registry (`nzilacanadaacr.azurecr.io`).
Public ingress is HTTPS-only. The Django sidecar requires
authenticated requests for all institutional endpoints; only a
small set of health endpoints (for example
`/api/auth_core/health/`) is reachable without authentication.

---

## Data storage

Institutional data is stored in Azure Database for PostgreSQL
Flexible Server (`nzila-staging-db` for staging). The database is
accessed through the porsager/postgres driver under Drizzle ORM.
Backups are managed by the Azure Flexible Server backup mechanism;
retention is environment-specific and documented in the operations
runbook supplied to each institution.

Document storage is handled by Azure Blob Storage
(`nzilacanadastore`) under separate containers for backups,
documents, exports, media, and evidence. Each container's access
policy is private by default; signed URLs are time-bounded and
audit-logged.

---

## Audit posture

Institutional actions of consequence — case state changes,
governance interpretations, stewardship reassignments, document
emissions — are written to a structured audit record. Audit
records are append-only by convention and reviewable by the
institution's governance liaison.

Audit records contain the action, the actor, the institutional
context, and a timestamp. They do not contain individual productivity
measures, behavioural inferences, or attention tracking.

---

## Reasoning and AI boundaries

OCI's use of language models is constrained by an explicit boundary
documented in [OCI AI Boundary](./OCI_AI_BOUNDARY.md). In summary:

- No autonomous reasoning. All AI-assisted outputs are reviewer-led
  under human oversight.
- No behavioural analytics. No scoring of individuals.
- No untraced inference. Every AI-assisted output is recorded with
  its provenance and is reviewable.

Where hosted model inference is used (Azure OpenAI resources in
East US and East US 2 for the staging environment), the inference
boundary is documented in [OCI Data Handling](./OCI_DATA_HANDLING.md).

---

## Vulnerability management

- Source dependencies are audited continuously through the
  repository's dependency audit workflow.
- Container images are scanned against critical-severity findings on
  build through Trivy. Known false positives are documented in
  `.trivyignore`.
- Security advisories with active patches are applied within the
  cadence documented in [SECURITY.md](../../SECURITY.md) at the
  repository root.
- Penetration test cadence for the institutional runtime is annual,
  delivered by an independent firm, summary available to the
  institution under NDA.

---

## Incident response

Security incidents are handled under a documented process:

1. Detection and containment within the affected service boundary.
2. Notification to the institutional sponsor within twenty-four
   hours of confirmation, regardless of confirmed impact.
3. Written incident report to the institution within ten business
   days of resolution.
4. Post-incident review, with the institution invited to attend.

Notification cadence may be tightened by contract.

---

## What institutional procurement can expect from this document

This Security Overview is the public-facing institutional
disclosure. Procurement reviewers requiring deeper artifacts may
request, under NDA:

- the current architecture diagram,
- the most recent penetration test summary,
- the current SBOM for runtime images,
- the data-handling addendum specific to the institution's scope.

These artifacts are supplied during procurement, not during
activation. Activation presumes procurement is resolved.

---

## Cross-references

- [OCI Privacy Position](./OCI_PRIVACY_POSITION.md)
- [OCI Data Handling](./OCI_DATA_HANDLING.md)
- [OCI AI Boundary](./OCI_AI_BOUNDARY.md)
- [OCI Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)
- [SECURITY.md](../../SECURITY.md) — repository-level security policy
