# Zonga Auth & RBAC Audit

> **Report type:** Security hardening audit  
> **Generated:** 2025-Q2  
> **Scope:** Authentication, authorisation, and role-based access control across the Zonga platform

---

## Executive Summary

The Zonga auth and RBAC surface was audited against OWASP ASVS Level 2 requirements. All critical access control boundaries are implemented and verified. No high-severity gaps remain open.

---

## Auth Stack

| Component | Implementation | Status |
|-----------|---------------|--------|
| Session auth | `@nzila/platform-auth` — Argon2id + PG sessions | ✅ Verified |
| Entra SSO (optional) | NextAuth + Azure AD with `platform-auth` JWT fallback | ✅ Verified |
| Session cookie | `nzila_session` — HttpOnly, Secure, SameSite=Lax | ✅ Verified |
| Token storage | Server-side `auth_user_sessions` table, opaque token | ✅ Verified |
| Account lockout | 5 failed attempts → 15-min lockout | ✅ Verified |
| Password hashing | Argon2id (OWASP parameters) | ✅ Verified |

---

## RBAC Boundaries

| Role | Scope | Enforced via |
|------|-------|-------------|
| `admin` | Full org access | `withOrgScope` middleware + DB role column |
| `label_manager` | Label analytics and rights | Route-level auth guards |
| `creator` | Own catalogue and payouts | Row-level data scoping |
| `viewer` | Read-only dashboard | No write APIs exposed |

All API routes under `/api/` require a valid session. Routes handling financial data additionally require `admin` or `label_manager` role verification.

---

## Findings

### Closed Findings

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| ZONGA-AUTH-01 | High | Missing org scope check on label export endpoint | Fixed — `withOrgScope` added to `/api/analytics/label-export/route.ts` |
| ZONGA-AUTH-02 | Medium | Session cookie missing `Secure` flag in dev | Fixed — flag conditional on `NODE_ENV` |
| ZONGA-AUTH-03 | Low | Verbose error messages on login failure | Fixed — generic "Invalid credentials" returned |

### Open Findings

None at audit date.

---

## Recommendations

- Continue quarterly RBAC review as new routes are added
- Enforce automated lint rule for unauthenticated API routes
- Enable Entra Conditional Access for admin-role actions in production

---

*Audit conducted by Nzila platform-security team. Next review: 2025-Q4.*
