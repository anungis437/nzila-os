# Trust Visual Pack — Union Eyes

> Procurement-ready visual summary of the Union Eyes trust posture. Use as a one-page handout, an appendix in the buyer deck, or as IT-review pre-read.

**Source-of-truth:** [`trust-center/`](../trust-center/), [`vendor-risk-pack/`](../vendor-risk-pack/), [`UNION_EYES_SECURITY_ONE_PAGER.md`](../UNION_EYES_SECURITY_ONE_PAGER.md)

---

## A. One-Page Trust Summary

### Union Eyes — Security & Trust at a Glance

| Pillar | What we ship today | Evidence |
|---|---|---|
| **Hosting** | Microsoft Azure Canada Central. No member data leaves Canada. | [data-flow-summary.md](../vendor-risk-pack/data-flow-summary.md) |
| **Encryption** | TLS 1.2+ in transit; AES-256 at rest (Azure Storage, PostgreSQL, Key Vault). | [trust-center/01](../trust-center/01-security-overview.md) |
| **Identity** | Email/password (Argon2id), passwordless magic-link, optional Microsoft Entra SSO. Per-org admin policy. | [trust-center/11](../trust-center/11-identity-and-access-management.md) |
| **Multi-factor auth** | TOTP (RFC 6238) self-enrolment with AES-256-GCM secret encryption + Argon2id recovery codes. Enforceable by role. | [packages/platform-auth/mfa](../../../packages/platform-auth/src/mfa/) |
| **Single sign-on** | Microsoft Entra ID (Azure AD). Per-org `requireSso` switch. SAML/Okta on roadmap. | [trust-center/04](../trust-center/04-access-control-model.md) |
| **Lifecycle controls** | Invite → active → suspended → deprovisioned. Session revocation on suspend. | [trust-center/04](../trust-center/04-access-control-model.md) |
| **Audit log** | Append-only `auth_audit_log` with 25+ event types. Org-scoped queryable. | [trust-center/11](../trust-center/11-identity-and-access-management.md) |
| **Risk monitoring** | Velocity, geolocation-stub, soft-lockout after 5 failed attempts (15-min). Step-up on elevated risk. | [packages/platform-auth/risk](../../../packages/platform-auth/src/risk/) |
| **Data isolation** | Org-scoped at the type-system level. Cross-org reads raise runtime errors. | [trust-center/04](../trust-center/04-access-control-model.md) |
| **Backups & restore** | Daily PITR (Azure PG flexible server, 7-day window). Quarterly restore drills documented. | [backup-restore-summary.md](../vendor-risk-pack/backup-restore-summary.md) |
| **Incident response** | 24×7 monitoring; severity matrix Critical 1h ack / 24h resolve. | [trust-center/09](../trust-center/09-contact-and-sla.md) |
| **Subprocessors** | Microsoft Azure (Canada), Resend (transactional email, US/EU). Updates 30 days in advance. | [subprocessor-list.md](../vendor-risk-pack/subprocessor-list.md) |
| **AI governance** | Advisory only. Every recommendation requires human override. Org-scoped precedents. | [`UNION_EYES_COGNITION_ROI.md`](../UNION_EYES_COGNITION_ROI.md) |

### What we do **not** claim today

- ❌ SOC 2 — engaged, audit not yet scheduled
- ❌ ISO 27001 — post-SOC 2
- ❌ Independent penetration test — planned
- ❌ Public SCIM endpoints — foundation columns shipped, public API deferred
- ❌ WebAuthn / FIDO2 — TOTP shipped, passkeys on roadmap
- ❌ SAML / Okta SSO — Entra only today

> Procurement defensibility = saying what we *don't* have, on the record.

---

## B. 5-Slide Trust Appendix (procurement leave-behind)

### Slide T1 — Trust Architecture in 60 Seconds

**Title:** Union Eyes runs on Microsoft Azure Canada Central with controls scoped to each tenant.

**Bullets:**

- Single-region: Canada Central, Toronto. Failover Canada East (Quebec).
- Network: private vNet, app-to-DB on private endpoint, no public PG.
- Secrets: Azure Key Vault, customer-specific MEK on the federation/national plan.
- Identity: per-org admin policy controls every method, with an append-only audit trail.

**Speaker notes:** Lead with hosting + Canadian sovereignty. Most union procurement teams clear immediately on this slide.

### Slide T2 — Identity & Access Controls (the "IT slide")

**Title:** Per-organisation admin policy, enforced server-side.

**Bullets:**

- Methods: password (Argon2id), magic-link, Entra SSO. Enable/disable per org.
- MFA: TOTP self-enrol; required-by-role; recovery codes (Argon2id-hashed).
- Account lockout: 5 failed attempts → 15-min lockout. Risk-based step-up.
- Lifecycle: invite, suspend, deprovision; session revocation on suspend.
- Audit: 25+ event types in `auth_audit_log`. Exportable.

**Speaker notes:** Show real screenshot of `/<locale>/admin/auth-policy`.

### Slide T3 — Data Protection & Privacy

**Title:** Canadian data, encrypted in transit and at rest, with a published data flow.

**Bullets:**

- Member data: Canada Central only. Backups: Canada Central + Canada East PITR.
- Encryption: TLS 1.2+, AES-256.
- Subprocessors: Azure (CA), Resend (email; PII = email address only).
- Retention: configurable per org. Hard delete on contract end + 90-day archive.
- Access: role-based, org-scoped, audit-logged.

**Speaker notes:** Hand the buyer the [DPA template](../vendor-risk-pack/dpa.md) on this slide.

### Slide T4 — Operational Security

**Title:** Backups, monitoring, incident response — published SLAs.

**Bullets:**

- Backups: daily PITR (7-day window), quarterly restore drill.
- Monitoring: 24×7 automated + business-hours human on-call.
- Incident severity: Critical 1h ack / 24h resolve · High 4h / 5d · Medium 1bd / 30d · Low 5bd / best-effort.
- Notification: customer security contact within 24h of any confirmed breach.

**Speaker notes:** Pair with [`incident-response-summary.md`](../vendor-risk-pack/incident-response-summary.md).

### Slide T5 — What We Don't Claim (the credibility slide)

**Title:** What's shipped vs. what's roadmap. On the record.

**Bullets:**

- ✅ Today: encryption, MFA, SSO (Entra), lifecycle, audit, Canadian hosting.
- ⏳ Roadmap: SOC 2 audit, ISO 27001, independent pen test, WebAuthn, public SCIM, SAML SSO.
- 🚫 Not in scope (Phase 1): cross-org analytics, automated outreach, biometric auth.
- Every commitment is in writing. We lose more deals by overpromising than by being honest.

**Speaker notes:** This slide closes more procurement reviews than any other. Use it.

---

## C. Screenshot Plan — Real UI Only

> No fake mockups. Every screenshot is a real shipped route. Capture runbook lives in [`AUTH_SCREENSHOT_INDEX.md`](../sales-kit/AUTH_SCREENSHOT_INDEX.md).

### Trust-pack screenshot subset (5 images)

| # | Screen | Route | Demonstrates | Buyer takeaway |
|---|---|---|---|---|
| T-1 | Login methods | `/login` | Password + magic-link + SSO surfaced based on org policy | "Login behaves like our IT policy says" |
| T-2 | MFA self-enrolment | `/<locale>/settings/mfa` | TOTP QR + recovery codes | "Members can self-serve MFA" |
| T-3 | Org auth policy | `/<locale>/admin/auth-policy` | Methods, role-MFA, domain allowlist, SSO-required toggle | "Admin controls live in the product" |
| T-4 | Invite acceptance | `/invite/accept` | Invite-only join flow | "Strangers cannot create accounts" |
| T-5 | Executive analytics | `/<locale>/(dashboard)/analytics` | Backlog, fairness, disengaged count | "Trust delivers measurable ops outcomes" |

### Capture rules (buyer-safe)

- Viewport `1440 × 900`; PNG only; filename `auth-NN-<short>.png`.
- Anonymise emails (`steward@local-1234.union.example`).
- No real customer data; use the seeded demo org `Local 1234`.
- Redact `usr_…` IDs in audit-log captures.
- Captures live in `docs/commercial/sales-kit/screenshots/` (gitignored; built per release).

---

## D. Buyer Objection Answers

> Three answers an IT Director or COO can paste into an internal review email.

### "How secure is this?"

> Union Eyes runs on Microsoft Azure Canada Central. All member data is encrypted in transit (TLS 1.2+) and at rest (AES-256). Authentication supports password (Argon2id), passwordless magic-link, and Microsoft Entra SSO, with per-organisation admin controls and TOTP MFA enforceable by role. Every authentication event is written to an append-only audit log with 25+ event types. Backups run daily with point-in-time recovery; we publish severity-based incident SLAs (Critical 1h ack / 24h resolve). We are pre-SOC 2; the controls themselves are documented and review-ready in the trust center.

### "Can our IT approve this?"

> Yes — and the procurement evidence is pre-packaged. We provide a DPA, subprocessor list, data-flow diagram, backup/restore summary, incident-response summary, access-control model, and identity-and-access-management deep-dive. SSO is Microsoft Entra (your existing tenant); no separate identity store required. The DPA has been used by Canadian unions and accommodates standard CCQ and CUPE legal language. Average IT review cycle on the pilot tier: 5–10 business days.

### "How do you offboard users?"

> Three states beyond active: **invite revoked** (token invalidated, no audit trail removed); **suspended** (login blocked, all sessions revoked within seconds, all audit history retained); **deprovisioned** (login blocked, PII cleared on the user record, foreign keys preserved for audit defensibility). All transitions write to the auth audit log. For SSO-managed users, removal from the Entra group cuts access on the user's next session refresh. Public SCIM endpoints are on the roadmap; the foundation columns and lifecycle service functions are already shipped — admin UI and bulk operations are accessible today via API.

---

## E. How to use this pack

| Buyer moment | Asset to send |
|---|---|
| 5 minutes after the demo | One-page trust summary (Section A) |
| Pre-IT-review email | Sections A + B + D |
| Procurement starts vendor file | Trust-Center index + DPA + subprocessor list |
| IT pushback on auth | Section D answer #1 + screenshots T-1, T-2, T-3 |
| Privacy officer review | Sections A + B (Slide T3) + DPA |
| Executive readout | Section A only |
