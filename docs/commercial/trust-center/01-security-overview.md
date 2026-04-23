# 01 — Security Overview

_Trust Center · Last revised: 2026-04-24_

Union Eyes is a member-data system used by unions and union-adjacent
organizations to track grievances, members, evidence, and elections. It
is operated by Nzila as a Canadian SaaS.

This page is the executive summary. Detailed pages cover each area.

## What we protect

- Grievance files and case notes
- Member rosters and contact data
- Evidence packages (photos, documents, audio transcripts)
- Election and ratification records
- Steward and executive accounts

## How we protect it (short version)

| Layer | Control |
|---|---|
| Hosting | Microsoft Azure Canada Central (Toronto). Cross-border residency disabled in production. |
| Transport | TLS 1.3 with HSTS and `upgrade-insecure-requests`. |
| Storage | AES-256 at rest (Azure Storage Service Encryption) plus column-level encryption for two-factor secrets. |
| Authentication | Argon2id local passwords, Microsoft Entra SSO, magic-link sign-in, optional TOTP MFA. |
| Authorisation | Role-based, organisation-scoped. PostgreSQL row-level security on case data. |
| Lifecycle | Suspend / reactivate / deprovision flows revoke every active session immediately and write an audit row. |
| Risk monitoring | Every login is risk-scored. New device, new IP, or privileged role triggers an MFA step-up. Repeated failures soft-lock the account. |
| Audit | Every authentication and case event written to an append-only log with actor, target, IP, user-agent, and reason. |
| AI | Advisory-only, org-scoped, runs in the same Canadian Azure tenant; no public-model training on customer data. |

## What we do not claim

- We do **not** hold an active SOC 2 attestation. SOC 2 Type II is on
  the roadmap with no scheduled audit window.
- We have **not** completed a third-party penetration test. Internal
  static analysis (Snyk, Trivy, dependency audit) runs on every CI/CD
  build.
- We are **not** ISO 27001 certified. ISO 27001 is roadmap, post-SOC 2.

We list these so you do not have to ask.

## Where to look next

- For the model of who gets in and how → [04 — Access control model](./04-access-control-model.md)
- For the full identity stack → [11 — Identity and access management](./11-identity-and-access-management.md)
- For procurement-style Q&A → [`AUTH_PROCUREMENT_QA.md`](../sales-kit/AUTH_PROCUREMENT_QA.md)
- For the one-page printable summary → [`UNION_EYES_SECURITY_ONE_PAGER.md`](../UNION_EYES_SECURITY_ONE_PAGER.md)

## Contact

Security issues: [security@unioneyes.app](mailto:security@unioneyes.app)
24-hour acknowledgement, 72-hour patch target for critical issues.
# Security Overview

## Controls in Place

- Encryption at rest and in transit (TLS + platform encryption).
- Role-based access enforcement in application services.
- Security headers on internal apps (`X-Robots-Tag: noindex` added in prior ops pass).
- Supply-chain and vulnerability scanning workflows present in CI.
- Audit/evidence packaging capabilities for regulated workflows.

## Secret Handling Posture

- Runtime-only secret injection is the target state.
- Build-time secret passing has been hardened in deploy workflows in this pass.
- See `docs/security/secrets-hardening-report.md`.

## Assurance Boundaries

- SOC 2 Type II: roadmap item, not currently claimed as achieved.
- External penetration test: readiness package available; independent assessment pending.

## Sources

- `docs/commercial/claims-ledger.md`
- `.github/workflows/secret-scan.yml`
- `docs/security/secrets-hardening-report.md`
