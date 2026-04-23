# 10 — FAQ

_Trust Center · Last revised: 2026-04-24_

Buyer-facing answers. For the procurement-grade short answers, see
[`AUTH_PROCUREMENT_QA.md`](../sales-kit/AUTH_PROCUREMENT_QA.md).

## Identity and access

### Where is our member data stored?
Microsoft Azure, Canada Central (Toronto). Cross-border residency is
disabled in the production data plane.

### Do you support SSO?
Yes — Microsoft Entra ID via OAuth/OIDC. Each organisation can choose
to make SSO the only sign-in method (`requireSso = true`).

### Do you support multi-factor authentication?
Yes — TOTP authenticator-app codes (Microsoft Authenticator, 1Password,
Google Authenticator, Authy). Users enroll themselves at
`/<locale>/settings/mfa`. Admins can require MFA by role
(typically `admin`, `coo`, `app_owner`, `platform_admin`).

### Can we run passwordless?
Yes — magic-link sign-in works without a password, and SSO works
without a password. An organisation can disable local password auth
entirely (`allowLocalAuth = false`).

### How do invites work?
An admin sends an invite to an email address with a chosen role. The
recipient gets a one-time, hashed-at-rest 256-bit token by email and
accepts at `/invite/accept?token=…`. The role on the invite cannot be
overridden by the recipient.

### How are sessions revoked?
Suspending, deprovisioning, or password-reset events nullify
`auth_user_sessions.expires_at` for every active session of that user
in a single SQL update. The next request from that browser is logged
out instantly.

### What if an employee leaves suddenly?
Call `deprovisionUser({targetUserId, actorUserId, reason})`. All
sessions die immediately, the row is soft-deleted from org-scoped
queries, organisation memberships are retained for audit, and the
event is written to `auth_audit_log`.

### What happens if a steward loses their phone?
- Recovery codes (10 single-use codes generated at enrollment) let them sign in once and re-enroll.
- If they have lost the recovery codes too, an admin disables MFA for them; the user re-enrolls on their next login.

### Are auth events audited?
Every event — signup, login success/failure, magic-link request,
magic-link consumption, invite create/accept, MFA enrollment / challenge
success / challenge failure / disable, lifecycle change, policy change
— writes a row to `user_management.auth_audit_log` with actor, target,
IP, user-agent, and reason. The write is best-effort and never blocks
the auth flow.

## Data and privacy

### Do you train AI models on our data?
No. AI features run on Azure OpenAI inside the same Canadian Azure
tenant. Customer data is not used to train any model published outside
the tenant.

### Is the AI making decisions for us?
No. Every AI output is advisory, surfaced with a confidence score, and
requires human confirmation. The recommendations engine produces one of
six categorical labels — there is no language model in the inference
path.

### Can two organisations on Union Eyes see each other's data?
No. Every grievance, member, and evidence row carries an
`organization_id`; PostgreSQL row-level security enforces isolation at
the database layer; the precedent-search engine throws a hard
`CrossOrgPrecedentLeakError` if a cross-org candidate sneaks in.

### What about backups?
See [`vendor-risk-pack/backup-restore-summary.md`](../vendor-risk-pack/backup-restore-summary.md).

## Compliance

### Are you SOC 2 certified?
No. SOC 2 Type II is on the roadmap with no scheduled audit window.
We say so explicitly. We do not market against a control we do not
hold.

### Have you had a third-party penetration test?
Not yet. Internal static analysis (Snyk, Trivy, dependency audit) runs
on every CI/CD build; results are recorded in the security workflow
artefacts.

### Are you ISO 27001 certified?
No. ISO 27001 is roadmap, post-SOC 2.

### Do you align with PIPEDA?
Yes, by design — Canadian-only hosting, residency lock, contract terms
that recognise PIPEDA, and a written DPA available on request.

### Can we get a DPA?
Yes — see [`vendor-risk-pack/dpa.md`](../vendor-risk-pack/dpa.md) or
email [privacy@unioneyes.app](mailto:privacy@unioneyes.app).

## Operations

### What email service sends MFA recovery, magic links, and invites?
Resend. Subprocessor list is at
[`vendor-risk-pack/subprocessor-list.md`](../vendor-risk-pack/subprocessor-list.md).
Email-delivery failures are themselves audited — we will know if your
admins did not receive an MFA enrollment email.

### Where do you log errors?
Sentry, with PII-redaction filters configured at the SDK level.

### Can we self-host?
Not today. Single-tenant Azure deployments inside your tenant are
negotiable on enterprise contracts.

### Where is the source of truth for my organisation's auth policy?
`user_management.org_auth_policies`, surfaced at
`/<locale>/admin/auth-policy` for any user with role ≥ `admin`.

## What if you find a vulnerability?

Email [security@unioneyes.app](mailto:security@unioneyes.app). We
acknowledge within 24 hours and target 72-hour patch for critical
issues. Coordinated disclosure preferred. Full policy:
[SECURITY.md](https://github.com/anungis437/nzila-os/blob/main/SECURITY.md).
# Trust Center FAQ

## 1) Where is the platform hosted?
Current operating environment is in Azure Canada Central for the primary staging production-like setup.

## 2) Do you pass secrets during image builds?
Not in the hardened deploy flows. Runtime secrets are injected at deployment/runtime; build now uses non-sensitive placeholders.

## 3) Do you have SOC 2 today?
No. SOC 2 Type II is a roadmap item and is intentionally not represented as achieved.

## 4) How do you handle incidents?
Through detection, triage, containment, remediation, and post-incident review. Current 30-day incident count is 0 in ops snapshot.

## 5) Can you provide uptime evidence?
Current uptime exporter artifact is not yet automated in-repo; this is listed as `source_needed` in ops metrics.

## 6) Is AI autonomous in critical decisions?
No. AI outputs are advisory and intended to remain under human authority.

## 7) Who do we contact for diligence?
Commercial and security contacts are listed in `09-contact-and-sla.md`.
