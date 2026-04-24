# Union Eyes — Security One-Pager

_For procurement, IT, privacy officers, and union executives._
_Last revised: 2026-04-24._

> **One-page version below; an expanded section follows for due diligence.**

---

## TL;DR

| Concern | What we do |
|---|---|
| **Data residency** | Microsoft Azure Canada Central (Toronto). Cross-border transfer disabled in production. |
| **Sign-in options** | Microsoft Entra SSO **and** local password **and** magic-link. Each org chooses which to allow. |
| **MFA** | TOTP authenticator-app codes. Self-enroll. Admins can require MFA by role. 10 single-use recovery codes. |
| **Org-level access policy** | Admins control per-org: SSO required, invite-only, allowed email domains, MFA-by-role, password reset on/off. |
| **Lifecycle** | Suspend / reactivate / deprovision. Each revokes every active session immediately and is audited. |
| **Risk monitoring** | Every login risk-scored. New device or privileged role triggers MFA step-up. Brute-force attempts soft-lock the account. |
| **Audit** | 25+ event types written to an append-only log with actor, target, IP, user-agent, and reason. |
| **Encryption** | TLS 1.3 in transit; AES-256 at rest; AES-256-GCM column-level for MFA secrets; Argon2id for passwords and recovery codes. |
| **AI** | Advisory-only; runs in same Canadian Azure tenant; no public-model training on customer data. |
| **Procurement** | DPA, subprocessor list, vendor risk pack available on request. PIPEDA-aligned. |

**Not yet:** SOC 2 Type II (roadmap), third-party penetration test (planned), ISO 27001 (post-SOC 2).
We say so explicitly so you do not have to ask.

---

## Expanded version

## 1. Canadian hosting + encryption

| Layer | Standard |
|---|---|
| Hosting | Microsoft Azure, Canada Central (Toronto). Production data plane has cross-border residency disabled. |
| Data at rest | AES-256 (Azure Storage Service Encryption). |
| Data in transit | TLS 1.3, HSTS, `upgrade-insecure-requests`. |
| Secrets | Azure Key Vault. No secrets in source code or env files. |
| MFA secrets | AES-256-GCM column-level encryption inside the database. Key from `AUTH_MFA_ENCRYPTION_KEY` env (preferred) or derived from `AUTH_SECRET`. |
| Passwords | Argon2id with OWASP-recommended parameters. |
| Recovery codes | Argon2id-hashed; original values shown once and never again. |
| Evidence packages | HMAC-SHA256 cryptographic seals (non-repudiation). |

## 2. SSO + local auth + passwordless

Each organisation can enable any combination of:

- **Microsoft Entra ID SSO** (OAuth/OIDC via NextAuth v5). Auto-provisions a user row on first login.
- **Email + password** (Argon2id, 24-hour opaque server-side session).
- **Magic-link** (single-use 256-bit token, 15-minute TTL, sent via Resend).

An org can disable local passwords entirely (`allowLocalAuth = false`),
make SSO mandatory (`requireSso = true`), or restrict passwordless and
signup to an email-domain allowlist.

## 3. MFA for privileged roles

- **Factor**: TOTP (RFC 6238) — works with Microsoft Authenticator, 1Password, Google Authenticator, Authy.
- **Self-enroll**: at `/<locale>/settings/mfa`. QR code + manual secret + recovery codes shown once.
- **Required by role**: org admins set `mfaRequiredForRoles` to a list — typically `admin`, `coo`, `app_owner`, `platform_admin`. Login fails closed for anyone in those roles who has not enrolled.
- **Step-up on risk**: even users not normally requiring MFA are challenged on a new device, new IP, or after suspicious activity.
- **Recovery**: 10 single-use codes. Lost-device path: an admin disables MFA, user re-enrolls.

## 4. Org-scoped access controls

The role hierarchy is `app_owner > coo > admin > chief_steward > steward > member`. Roles are organisation-scoped — there is no global admin who can read another tenant's case data.

`PostgreSQL` row-level security enforces isolation at the database
layer, not just in the application. The precedent-search engine throws
a hard `CrossOrgPrecedentLeakError` if a candidate row sneaks in from
another organisation.

## 5. Lifecycle controls

| Action | Effect |
|---|---|
| Suspend | Reversible block. All active sessions of the user revoked atomically. Audited. |
| Reactivate | Lifts the block. Existing credentials still work; MFA enrollment retained. |
| Deprovision | Terminal off-boarding. Soft-deleted from org-scoped queries. Sessions revoked. Audit history retained. |

These are service-layer functions today; an admin HTTP UI is on the
near-term roadmap.

## 6. Risk-based login monitoring

| Tier | Trigger | Action |
|---|---|---|
| Low | Recognised IP + UA, no recent failures, non-privileged role | Continue |
| Medium | New device / IP, or role ∈ {admin, coo, app_owner, platform_admin} | Force MFA challenge |
| High | ≥ 3 failed logins in 15 minutes from same IP or account | Soft-lockout (generic failure) |

Risk tier is appended to the `login_success` audit row.

Conservative first pass: no geolocation / impossible-travel / device
fingerprinting. We document this rather than imply they exist.

## 7. Audit logs

Every authentication and lifecycle event writes a row to
`user_management.auth_audit_log` with `actor_user_id`,
`target_user_id`, `organization_id`, `ip_address`, `user_agent`,
`metadata` (JSONB), and `created_at`. The write is best-effort and
never blocks the auth flow.

Event types (incomplete list): `signup`, `login_success`,
`login_failed`, `account_locked`, `magic_link_requested`,
`magic_link_consumed`, `invite_created`, `invite_accepted`,
`mfa_enroll_started`, `mfa_enrolled`, `mfa_challenge_issued`,
`mfa_challenge_succeeded`, `mfa_challenge_failed`, `mfa_disabled`,
`user_suspended`, `user_reactivated`, `user_deprovisioned`,
`auth_policy_changed`, `email_delivery_failed`.

## 8. Procurement readiness

| Document | Status |
|---|---|
| Data Processing Addendum (DPA) | Available — [`vendor-risk-pack/dpa.md`](./vendor-risk-pack/dpa.md) |
| Subprocessor list | Published — [`vendor-risk-pack/subprocessor-list.md`](./vendor-risk-pack/subprocessor-list.md) |
| Architecture diagram | Published — [`vendor-risk-pack/architecture-diagram.md`](./vendor-risk-pack/architecture-diagram.md) |
| Data flow summary | Published — [`vendor-risk-pack/data-flow-summary.md`](./vendor-risk-pack/data-flow-summary.md) |
| Backup / restore summary | Published — [`vendor-risk-pack/backup-restore-summary.md`](./vendor-risk-pack/backup-restore-summary.md) |
| Incident response summary | Published — [`vendor-risk-pack/incident-response-summary.md`](./vendor-risk-pack/incident-response-summary.md) |
| Off-boarding / export process | Published — [`vendor-risk-pack/export-offboarding-process.md`](./vendor-risk-pack/export-offboarding-process.md) |
| Trust Center | [`trust-center/`](./trust-center/) |
| Procurement Q&A pack | [`sales-kit/AUTH_PROCUREMENT_QA.md`](./sales-kit/AUTH_PROCUREMENT_QA.md) |
| PIPEDA alignment | In place. Canadian-only data plane. |
| SOC 2 Type II | Roadmap, no scheduled audit window. |
| Third-party penetration test | Planned, not yet scheduled. |
| ISO 27001 | Roadmap, post-SOC 2. |

## Subprocessors

| Subprocessor | Purpose | Region |
|---|---|---|
| Microsoft Azure | Hosting, compute, storage, AI | Canada Central |
| Sentry | Error monitoring (PII redaction enabled) | EU / US (telemetry only) |
| Resend | Transactional email (magic link, invite, password reset, MFA-related notifications) | Message metadata only |
| Stripe | Org billing | No member data |

## Responsible disclosure

Security issues: [security@unioneyes.app](mailto:security@unioneyes.app).
24-hour acknowledgement, 72-hour patch target for critical issues.

Full security policy: [SECURITY.md](https://github.com/anungis437/nzila-os/blob/main/SECURITY.md).

---

**Companion documents**

- Trust Center: [`trust-center/`](./trust-center/)
- Procurement Q&A pack: [`sales-kit/AUTH_PROCUREMENT_QA.md`](./sales-kit/AUTH_PROCUREMENT_QA.md)
- Access modes (commercial-friendly): [`UNION_EYES_ACCESS_MODES.md`](./UNION_EYES_ACCESS_MODES.md)
- Auth model (technical): [`../security/UNION_EYES_AUTH_MODEL.md`](../security/UNION_EYES_AUTH_MODEL.md)
