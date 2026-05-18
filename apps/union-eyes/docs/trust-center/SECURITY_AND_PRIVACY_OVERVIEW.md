# Union Eyes — Security and Privacy Overview

> **Audience:** Procurement reviewers, security assessors, institutional buyers.
> **Scope:** Public-safe summary of Union Eyes security controls and data privacy posture.
> **Caveats:** This document uses language such as "is designed to," "supports," and "provides evidence of."
> No claim represents a formal certification unless a certification document is explicitly referenced.

---

## 1. Authentication and Access Control

Union Eyes is designed with server-side authentication enforcement as its primary security boundary.

- **Role-based access control (RBAC):** All dashboard routes and API handlers are protected by
  server-side auth wrappers (`withRoleAuth`, `withMinRole`). Roles include member, steward,
  staff, executive, governance, and admin.
- **Session-based authentication:** Sessions are managed server-side and are not reliant solely
  on client-side token storage.
- **Org-scoped data access:** All data queries are scoped to the requesting organisation's
  identifier. No cross-tenant data access is permitted without explicit governance approval.

*Supporting evidence:*
- `docs/security/AUTH_REALITY_AUDIT.md` — authentication layer audit findings
- `lib/auth/with-role-auth.ts` — server-side role enforcement implementation

---

## 2. Secret and Credential Management

Union Eyes is designed to prevent secret leakage into source code and build artifacts.

- Secrets are managed through environment variables and are not committed to the repository.
- A pre-commit secret scanning gate (`gitleaks`) is active on all commits.
- The `narrative:check` CI gate validates that no credentials appear in documentation.

*Supporting evidence:*
- `docs/security/SECRET_MANAGEMENT_VALIDATION.md` — secrets posture validation evidence

---

## 3. Rate Limiting and Abuse Prevention

A layered rate limiting system is active in the middleware layer.

- IP-based rate limiting is applied at the middleware boundary before requests reach handlers.
- Role-sensitive routes have tighter rate limit thresholds than public routes.
- Rate limit configuration is declarative and auditable.

*Supporting evidence:*
- `middleware.ts` — runtime middleware entry point
- `lib/api/rate-limit.ts` — layered rate limiting implementation

---

## 4. Data Privacy

Union Eyes is designed to support the data minimisation and access control requirements
applicable to labour relations and union member data.

- Member data is accessible only to authenticated users with the appropriate role.
- No member data is exposed through public routes without explicit governance approval.
- Audit events related to member data access are classified and retained.

---

## 5. Incident Response

An incident response drill has been conducted and documented.

*Supporting evidence:*
- `docs/security/INCIDENT_DRILL_REPORT.md` — incident response rehearsal results
- `docs/security/BACKUP_RESTORE_VALIDATION.md` — disaster recovery validation evidence

---

## 6. Security Posture Summary

| Control | Status |
|---------|--------|
| Server-side RBAC | ✅ Present — see `AUTH_REALITY_AUDIT.md` |
| Secret scanning CI gate | ✅ Present — gitleaks pre-commit hook |
| Layered rate limiting | ✅ Present — see `middleware.ts` |
| Org-scoped data isolation | ✅ Present — see `ORG_SCOPE_AUDIT.md` |
| Incident drill evidence | ✅ Present — see `INCIDENT_DRILL_REPORT.md` |
| DR / backup validation | ✅ Present — see `BACKUP_RESTORE_VALIDATION.md` |

---

*See also: [GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md](./GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md)*
