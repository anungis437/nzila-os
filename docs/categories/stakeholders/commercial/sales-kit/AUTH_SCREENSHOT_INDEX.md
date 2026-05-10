# Auth Screenshot Index — Union Eyes Sales Kit

_Last revised: 2026-04-24._

This index lists the **real shipped UI** that demonstrates Union Eyes'
enterprise auth maturity. Every screen in this index points at a route
that exists in the current main branch. No mockups. No marketing
mock-ups. No fictional admin consoles.

If a screenshot does not yet exist on disk, follow the
[capture runbook](#capture-runbook) below — it produces deterministic,
buyer-safe images using Playwright.

## Screen index

| # | Screen | Route | Demonstrates | Used in | Buyer takeaway |
|---|---|---|---|---|---|
| 1 | Login (multi-method) | `/login` | Email + password, magic-link, "Continue with Microsoft" all rendered conditionally per org policy | Demo, pilot proposal, website | "We can fit your IT model — SSO, password, or passwordless." |
| 2 | Magic-link request | `/login` (after clicking "Email me a sign-in link") | Passwordless flow; neutral success message (no enumeration) | Demo, pilot proposal | "Your members can sign in without managing yet another password." |
| 3 | Magic-link landing | `/magic-link/verify` | Token verification, single-use enforcement, redirect into the app | Demo (rarely shown), procurement screenshot pack | "Tokens are single-use and short-lived." |
| 4 | MFA enrollment — QR + secret | `/<locale>/settings/mfa` (initial state) | QR code, manual secret, 10 recovery codes shown once | Demo, pilot proposal, website | "Two-factor is a 30-second self-enroll." |
| 5 | MFA enrollment — verify code | `/<locale>/settings/mfa` (after `Enable two-factor`) | 6-digit code field; recovery-code "I've saved them" checkbox | Demo, procurement | "Recovery codes are shown exactly once and stored hashed." |
| 6 | MFA settings — enabled state | `/<locale>/settings/mfa` (post-enrollment) | Status panel, last-used timestamp, "Disable" button | Demo, procurement | "Users can manage their own factor without raising a ticket." |
| 7 | Login MFA challenge | `/login` (after correct password when MFA required) | 6-digit prompt, "Use a recovery code" toggle, cancel link | Demo, pilot proposal, procurement | "Step-up happens automatically — no separate portal." |
| 8 | Admin auth policy — methods | `/<locale>/admin/auth-policy` | Toggle row for `allowLocalAuth`, `allowMagicLink`, `allowSso`, `requireSso`, `requireInvite`, `passwordResetAllowed` | Demo, pilot proposal, procurement, website | "Org admins set the policy. No tickets to vendor." |
| 9 | Admin auth policy — domain allowlist | `/<locale>/admin/auth-policy` | `allowedEmailDomains` text input | Demo, procurement | "Restrict signup to your verified domains in one field." |
| 10 | Admin auth policy — role MFA | `/<locale>/admin/auth-policy` | `mfaRequiredForRoles` chip toggles for member / steward / chief_steward / admin / coo / app_owner / platform_admin | Demo, pilot proposal, procurement, website | "Force MFA on the roles that need it — leave members unfriction'd." |
| 11 | Invite acceptance | `/invite/accept?token=…` | Pre-filled email, role display, name + password fields | Demo, procurement | "Onboarding new staff is a one-click email." |
| 12 | Account locked / soft-lockout state | `/login` (after 5 failed attempts) | Generic "contact your administrator" message | Procurement | "Brute force is rate-limited; messaging does not leak account existence." |
| 13 | Audit log query result | (psql or admin terminal — captured as monospace code block, not a UI) | `SELECT … FROM user_management.auth_audit_log` showing real event types | Procurement, due diligence | "Every action is recorded. Here is the schema." |

## Capture runbook

We do not commit binary screenshots into the public docs (license,
size, drift). Instead, we capture them on demand via Playwright when
preparing a buyer pack.

### Prerequisites

- Local dev stack running: `pnpm dev:union-eyes` (or `pnpm dev`).
- Demo seed loaded: `pnpm tsx apps/union-eyes/scripts/seed-union-eyes-demo.ts`.
- Test org admin: `demo-admin@unioneyes.app` / password from `.env.local` `DEMO_ADMIN_PASSWORD`.
- Test member with MFA enabled: `demo-mfa@unioneyes.app`.

### Capture procedure

For each row in the index above:

1. Sign in as the appropriate persona (admin or member).
2. Navigate to the listed route.
3. Bring the page into the deterministic state listed in the
   "Demonstrates" column (e.g. for #5, click "Enable two-factor"
   first).
4. Use the browser dev tools to set viewport to **1440 × 900**
   (standard buyer-pack ratio) and run a full-page screenshot.
5. Save as `auth-NN-<short-name>.png` in
   `docs/commercial/sales-kit/screenshots/` (folder created on first
   capture; `.gitignore` policy TBD per release).

### Optional: Playwright scripted capture

A reusable Playwright script lives at:

```
tooling/screenshots/auth-screenshots.spec.ts   (placeholder path - create when first needed)
```

Run with:

```
pnpm exec playwright test tooling/screenshots/auth-screenshots.spec.ts
```

It logs in as both personas, walks through the 13 screens above, and
emits PNGs into `docs/commercial/sales-kit/screenshots/`. Re-run before
each pilot proposal so the images stay current with shipped UI.

### Buyer-safe rules

- **Anonymise everything.** Use seed-data emails (`demo-…@unioneyes.app`) only. Never use a real customer's data, name, grievance ID, or organisation logo.
- **Remove personal email addresses from the audit-log screenshots.** Replace `usr_…` IDs with redacted placeholders if necessary.
- **No fake admin consoles.** If a feature is roadmap (e.g. admin UI for suspend/deprovision), do not include a screenshot of it. The procurement Q&A pack discloses these gaps in writing.
- **Use the actual current branding.** No upscaled logos, no marketing mock-up frames.

## What to put on the website

Of the 13 screens, the **website-safe** subset is:

- 1 (Login multi-method)
- 4 (MFA enrollment — QR + secret)
- 8 (Admin auth policy — methods)
- 10 (Admin auth policy — role MFA)

These four convey "enterprise-ready" without exposing internal
admin paths or audit-log structure.

## What to put in the pilot proposal PDF

Add to the website-safe list:

- 7 (Login MFA challenge)
- 11 (Invite acceptance)

That gives a procurement reviewer a complete picture: how users sign
in, how MFA works, how admins control policy, how onboarding flows.

## What to put in the procurement / due-diligence pack

Everything (1–13). Buyers doing due diligence want to see the audit
log schema and the lockout messaging.
