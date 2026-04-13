---
title: Security & Privacy Overview
description: How Nzila Ventures protects your data, enforces access controls, and maintains compliance across its platform ecosystem.
category: Security
order: 1
date: 2026-02-01
---

## Our Security Philosophy

Security is not a feature — it is a foundational property of every system we build. Nzila applies a **defence-in-depth** model: controls are layered at the identity, network, database, application, and evidence layers so that no single failure compromises the whole.

> All security controls are automated, version-controlled, and continuously verified by CI. Human gate-keeping alone is not sufficient.

---

## Identity & Access Controls

### Authentication

All user sessions are managed through **Nzila Platform Auth** (Entra ID + local sessions). Key guarantees:

- Multi-factor authentication (TOTP, passkeys) enforced for privileged roles
- Short-lived JWTs — no long-lived tokens in cookies or local storage
- Session revocation propagates to all devices within seconds

### Role-Based Access Control (RBAC)

Nzila uses a four-tier role model across all platforms:

| Role | Description | Scope |
|------|-------------|-------|
| `viewer` | Read-only access to org data | Org-scoped |
| `member` | Standard contributor permissions | Org-scoped |
| `admin` | Full management within an org | Org-scoped |
| `compliance-officer` | Access to sensitive compliance data with mandatory justification logging | Org-scoped + audited |

Platform super-admin capabilities are isolated to internal tooling and are never exposed through public APIs.

### Org Isolation

Every record in the database is **scoped to an Org**. Row-Level Security (RLS) policies at the PostgreSQL layer enforce that queries can never return data belonging to a different org — even if application-layer code is misconfigured.

```sql
-- Example RLS policy (simplified)
CREATE POLICY org_isolation ON events
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

---

## Data Protection

### Encryption at Rest

- All databases: AES-256 encryption at the storage layer (Azure infrastructure default)
- Sensitive PII fields (e.g., reporter identities in ABR): additional **AES-256-GCM** application-layer encryption with keys stored in Azure Key Vault

### Encryption in Transit

- TLS 1.3 enforced on all external endpoints
- Internal service communication uses mTLS where applicable
- HSTS headers with 1-year max-age on all public domains

### Data Minimisation

API responses are filtered by serialiser allowlists. No endpoint returns fields it was not explicitly configured to expose. Sensitive fields (PII, vault identifiers, session metadata) are excluded by default even if present in the underlying model.

---

## Audit & Immutability

Every write operation emits an audit event that is:

1. **Hash-chained** — each entry includes a SHA-256 hash of its payload plus the hash of the previous entry, forming a tamper-evident chain
2. **Append-only** — database triggers (`BEFORE UPDATE / BEFORE DELETE`) raise an exception on any mutation attempt
3. **Retained** — audit tables are never truncated; archival is additive only

Audit integrity is verified on every CI run via contract tests.

---

## Vulnerability Management

### Continuous Scanning

| Tool | What it scans | Failure threshold |
|------|--------------|-------------------|
| **Gitleaks** | Secrets in code history | Any secret = FAIL |
| **TruffleHog** | Secrets in commits + blobs | Any verified secret = FAIL |
| **Trivy** | Container image + filesystem CVEs | CRITICAL severity = FAIL |
| **pnpm audit / pip-audit** | Dependency vulnerabilities | CRITICAL severity = FAIL |

All scans run on every pull request. No `|| true` bypass is permitted on blocking gates.

### SBOM

A Software Bill of Materials (CycloneDX format) is generated for every release and stored as a CI artefact for 365 days. This enables rapid impact assessment when new CVEs are published.

---

## Responsible Disclosure

If you discover a security vulnerability in any Nzila platform, please report it responsibly:

- **Email:** security@nzilaventures.com
- **Response SLA:** Initial acknowledgement within 48 hours; triage within 7 days
- We do not pursue legal action against good-faith researchers operating within our disclosure policy

We ask that you do not publicly disclose vulnerabilities until a fix has been deployed and you have received confirmation from our security team.
