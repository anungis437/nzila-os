# Union Eyes — 45-Minute Demo Script

_Owner: Sales / Customer Success Engineering. Last revised: 2026-04-24._

This is the standard 45-minute buyer demo. It extends the 30-minute
cognition demo (`UNION_EYES_AI_DEMO_SCRIPT.md`) with a 3-minute trust
segment up front and 12 minutes for Q&A and pilot framing at the end.

> **Persona:** VP of Sales **or** Customer Success Engineer with the
> demo seed loaded. Sign in as a **chief steward** of the demo org.
> Have a **second tab** ready, signed in as an **org admin**, for the
> trust segment.

## Cold-open (0:00 – 0:30)

> "Most union software treats grievances like helpdesk tickets and
> stewards like inboxes. Union Eyes treats your local like an
> **operating system**. I'm going to show you 5 capability modules in
> 30 minutes — and before we start, 3 minutes on how we keep your
> members' data safe, because that is the question your IT director
> will ask first."

## Trust segment (0:30 – 3:30)

**Goal:** by minute 3:30 the buyer should believe Union Eyes is
enterprise-safe to pilot today, without waiting for SOC 2.

### 0:30 – 1:00 — Login flexibility (Screen #1)

1. Open `/login` in the second tab (logged-out browser).
2. Point at the three buttons: "Sign in", "Email me a sign-in link", "Continue with Microsoft".
3. **Speaker note:** "Three sign-in methods. Each organisation chooses which to allow. Your IT team can run SSO-only on day one and you do not have to teach members yet another password."

### 1:00 – 1:45 — MFA setup (Screens #4, #6)

1. Sign in as the demo admin.
2. Navigate to `/<locale>/settings/mfa`.
3. Click **Enable two-factor**. Show the QR code + manual secret + 10 recovery codes.
4. **Speaker note:** "30-second enroll, any authenticator app. The 10 recovery codes are single-use and shown exactly once. The secret itself is AES-256 encrypted at rest. Org admins can require MFA per role — typically all admins and executives — and the system fails closed if a privileged user has not enrolled."

### 1:45 – 2:45 — Org policy controls (Screens #8, #9, #10)

1. Navigate to `/<locale>/admin/auth-policy`.
2. Walk through the toggles in order: `allowLocalAuth`, `allowMagicLink`, `allowSso`, `requireSso`, `requireInvite`, `passwordResetAllowed`, `allowedEmailDomains`, `mfaRequiredForRoles`.
3. Toggle `mfaRequiredForRoles` on for `admin` and `coo` and click Save.
4. **Speaker note:** "Your org admin owns this. No support ticket. No vendor email. Every change writes to the audit log with actor, IP, and timestamp. Need to lock down to SSO-only? Two clicks. Need to restrict signup to `@yourunion.ca` only? One field."

### 2:45 – 3:15 — Offboarding lifecycle

1. Open a terminal pre-loaded with the lifecycle helper script (or the SQL view of `users` for the demo org).
2. Show the four lifecycle states: `active`, `pending_invite`, `suspended`, `deprovisioned`.
3. Run a `suspendUser` example for a demo user; show the audit row appearing in `auth_audit_log`.
4. **Speaker note:** "Steward leaves abruptly? One call deprovisions them, kills every active session within the same SQL transaction, and writes an audit row with the reason. Their organisation membership stays in the database — for the audit trail — but they cannot log in."

### 3:15 – 3:30 — Risk monitoring closer

1. Switch to the audit log query in the second terminal.
2. Run the query that filters `event_type IN ('login_failed','mfa_challenge_failed','login_soft_lockout')` for the last 24 h.
3. **Speaker note:** "Every login is risk-scored. New device or privileged role triggers automatic MFA step-up. Three failed attempts in 15 minutes from the same IP soft-lock the account with a generic message — no enumeration. Today the risk engine uses device-and-role signals; geolocation is roadmap and we say so out loud."

## Module 1 — Grievance Trajectory Intelligence (3:30 – 8:30)

_(Cognition demo content; see `UNION_EYES_AI_DEMO_SCRIPT.md` minute 2–7.)_

## Module 2 — Steward Workload Balancer (8:30 – 13:30)

_(See cognition script minute 7–12.)_

## Module 3 — Member Disengagement Risk (13:30 – 18:30)

_(See cognition script minute 12–17.)_

## Module 4 — Precedent Memory Engine (18:30 – 23:30)

_(See cognition script minute 17–22.)_

## Module 5 — Executive Health Summary (23:30 – 28:30)

_(See cognition script minute 22–27.)_

## KPI snapshot + close (28:30 – 33:00)

_(See cognition script minute 27–30; extended slightly for 45-minute slot.)_

## Pilot framing (33:00 – 38:00)

> "Here is what a pilot looks like."

1. Show the pilot offer summary from `pilot-offer-cupe.md`.
2. Walk through:
   - Week 1: read-only dashboard live on real data.
   - Week 2–4: MFA + admin policy enabled for your nominated admins.
   - Day 30: KPI baseline finalised; first executive summary delivered.
   - Day 60: phase-2 write-back recommendations live.
3. **Speaker note:** "Everything you saw — including the trust controls — is shipping in production today. Nothing in the demo was mocked. The 30-day pilot uses your real org with the auth controls already enabled."

## Q&A defensives (38:00 – 45:00)

Use the procurement Q&A pack as the answer source:
[`AUTH_PROCUREMENT_QA.md`](./AUTH_PROCUREMENT_QA.md).

| Buyer question | One-liner answer |
|---|---|
| "Are you SOC 2?" | "No — and we say so on the trust center. SOC 2 Type II is roadmap. Today: PIPEDA-aligned Canadian hosting, Argon2id passwords, AES-256 secrets at rest, 25+ event types in an append-only audit log." |
| "Do you support our IdP?" | "Microsoft Entra today. SAML / Okta on enterprise. We can run SSO-only with `requireSso = true` so your IdP is the only path." |
| "What if a steward leaves?" | "One call to `deprovisionUser`. Sessions die in the same transaction. Audit row written. Their org membership stays for evidence." |
| "What if our admin loses their phone?" | "Recovery codes (10 issued at enrollment) let them sign in once. If those are lost, another admin disables MFA for them; they re-enroll on next login." |
| "Can two unions on your platform see each other's data?" | "No. Org-scoped at the application layer, PostgreSQL row-level security at the database layer, and the precedent engine throws a hard `CrossOrgPrecedentLeakError` if a cross-org candidate sneaks in." |
| "How fast can we start?" | "Read-only dashboard in 1 day. MFA-required for admins same day. KPI baseline in 30 days. Phase-2 in 60 days." |
| "What about AI risk?" | "All AI is advisory, runs in the same Canadian Azure tenant, and never trains a public model on your data. Recommendations are categorical — there is no language model in the inference path." |

## Demo prep checklist

- [ ] Demo seed loaded (`pnpm tsx apps/union-eyes/scripts/seed-union-eyes-demo.ts`)
- [ ] Tab 1: chief steward, dashboard cognition view open
- [ ] Tab 2: org admin, `/admin/auth-policy` open
- [ ] Tab 3: terminal with `psql` connected to the demo DB, audit-log query pre-pasted
- [ ] Tab 4: API client (Insomnia / curl) with `/api/cognition/kpis?windowDays=30` pre-pasted
- [ ] Phone with authenticator app loaded (for MFA enrollment demo)
- [ ] Browser dev tools closed, viewport at 1440 × 900
- [ ] Slack / Teams notifications muted

## Related documents

- 30-minute cognition-only script: [`../UNION_EYES_AI_DEMO_SCRIPT.md`](../UNION_EYES_AI_DEMO_SCRIPT.md)
- Procurement Q&A: [`./AUTH_PROCUREMENT_QA.md`](./AUTH_PROCUREMENT_QA.md)
- Screenshot index: [`./AUTH_SCREENSHOT_INDEX.md`](./AUTH_SCREENSHOT_INDEX.md)
- Trust center: [`../trust-center/`](../trust-center/)
- Pilot offer (CUPE example): [`../pilot-offer-cupe.md`](../pilot-offer-cupe.md)
