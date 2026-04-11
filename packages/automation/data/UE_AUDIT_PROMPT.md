# UnionEyes Migration — Audit Checkpoint Prompt
*Generated: 2026-02-19 | Updated: 2026-02-19 (session 2) | Source: MIGRATION_DASHBOARD.md*

---

## Purpose

Use this prompt at the start of any new session to rapidly re-establish context on the UnionEyes migration. Paste it into the AI assistant or review it manually to confirm where UE stands and what to work on next.

---

## Audit Prompt

> **Context**: I'm working on the UnionEyes (UE) migration from a legacy Next.js + Supabase stack to Django + PostgreSQL. Below is the verified status as of 2026-02-19. Confirm you understand the current state, then tell me the exact next action to take.
>
> ---
>
> ### UE Migration Status — ~89% Complete (12.5/14 phases)
>
> **Completed Phases (10/14):**
>
> | # | Phase | Status | Evidence |
> |---|-------|--------|----------|
> | 1 | Analysis | ✅ 100% | 2/2 tasks, 2/2 gates |
> | 2 | Schema Extraction | ✅ 100% | 512/512 tables extracted |
> | 3 | Code Generation | ✅ 100% | 11 Django apps generated, 4/4 gates |
> | 4 | Dependency Mapping | ✅ 100% | 282/282 dependencies mapped, 3/3 gates |
> | 5 | Scaffold Population | ✅ 100% | 14/11 tasks (over-delivered), repo at `C:\APPS\nzila-union-eyes` |
> | 6 | Model Migration | ✅ 100% | 512 models, UUID PKs, 524 tables created in `nzila_union_eyes` |
> | 7 | Data Migration | ✅ 100% | 265/265 tables, 3,689 rows, 100% validation match |
> | 8 | Auth Migration | ✅ 100% | Clerk backend installed, live credentials configured, 3/3 gates |
> | 9 | Local Testing | ✅ 100% | Django 0 issues, PG connected, HTTP 200, 19 packages importable |
> | 10 | JWT & Webhook Testing | ✅ 95% | JWKS OK, health 200, no-token 403, RS256 flow verified, webhook HMAC verified |
> | 12 | Queue Migration | ✅ 100% | 5 BullMQ queues → Celery, Beat + Results wired, 4 Docker worker services |
>
> **Queue Migration Details (completed this session):**
> - 5 BullMQ queues → Celery tasks (notifications, analytics, core, billing)
> - `django-celery-beat` + `django-celery-results` added to `INSTALLED_APPS`, Beat schedule, `kombu.Queue` routing
> - `job-queue.ts` fully replaced with HTTP client — identical public API, zero callers broken
> - All admin job routes updated to Celery `TaskResult` shape
> - Docker Compose extended with 4 scoped worker services + `celery-beat`
> - Two bugs fixed in settings: duplicate `CELERY_RESULT_BACKEND`, malformed `CELERY_TASK_QUEUES`
>
> **Known gap (testing):** `GET /api/auth_core/me/` with a real Clerk Bearer JWT is blocked on obtaining `CLERK_WEBHOOK_SECRET` and running a live sign-in session.
>
> **Environment — ✅ Mostly wired for auth testing:**
> - ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` present in both envs
> - ✅ `DJANGO_API_URL=http://localhost:8000` added to `.env.local`
> - ✅ `DJANGO_SECRET_KEY` replaced (was placeholder)
> - ✅ `CLERK_JWKS_URL` + `CLERK_PUBLISHABLE_KEY` in `.env`
> - ⏳ **Missing `CLERK_WEBHOOK_SECRET`** in `.env` — blocks `POST /api/auth_core/webhooks/`
> - ⏳ **Missing `RESEND_API_KEY`** — blocks email sending
> - ⏳ **Missing `TWILIO_*`** — blocks SMS; `requirements.txt` has `twilio>=8.0.0` ready
>
> **Remaining Phases (2.5/14 — not started or in progress):**
>
> | # | Phase | Status | Blocking? |
> |---|-------|--------|----------|
> | 10 | JWT & Webhook Testing | 🟡 95% → 100% | **Needs CLERK_WEBHOOK_SECRET + live sign-in to close gap** |
> | 11 | API Migration | ⬜ 0% | **NEXT — 130+ routes to migrate** |
> | 13 | Testing | 🟡 40% | 2/5 tasks, 2/4 gates — unit + integration needed |
> | 14 | Deployment | ⬜ 0% | Azure Container Apps, staging then prod |
> | — | Cutover | ⬜ 0% | Final switch, legacy decommission |
>
> ---
>
> ### Infrastructure Context
>
> - **Source DB**: Azure PostgreSQL `unioneyes-staging-db` (Canada Central, PG 16, B2s)
> - **Target DB**: Local PostgreSQL `nzila_union_eyes` (524 tables, UUID PKs)
> - **Auth provider**: Clerk (`known-hagfish-67.clerk.accounts.dev`)
> - **Backend repo**: `C:\APPS\nzila-union-eyes\backend\`
> - **Start command**: `python manage.py runserver 8000`
> - **Branch**: `feature/backend-migration`
> - **Django apps (11)**: unions, grievances, bargaining, finance, compliance, auth_core, analytics, documents, communications, notifications, services
> - **Known gap**: `services` app has no models yet — intentional, part of API migration phase
>
> ### What's Immediately Next (Priority Order)
>
> 1. **Close the Auth Gap — Phase 10 → 100%** (CRITICAL, ~15 min once secrets obtained)
>    - Get `CLERK_WEBHOOK_SECRET` from Clerk Dashboard → add to `.env`
>    - Start Django (`python manage.py runserver 8000`) + Next.js simultaneously
>    - Sign in via Clerk → `GET /api/auth_core/me/` with real Bearer JWT
>    - **This one request closes the 95% → 100% gap and gives a working auth harness**
>    - Every Phase 11 API route can then be tested with real JWTs, not mocked tokens
>
> 2. **API Migration — Phase 11** (HIGH, ~2-3 weeks)
>    - Map all 130+ endpoints
>    - Generate DRF viewsets for business logic
>    - Write integration tests
>    - Migrate frontend API calls
>
> 3. **Local Testing — ABR** (HIGH, ~30-45 min)
>    - Install deps, run `python manage.py runserver 8001`
>    - Verify health endpoints, JWT, webhooks
>
> 4. **Testing — Phase 13** (MEDIUM)
>    - Unit + integration tests for migrated APIs
>    - E2E auth flow tests
>
> 5. **Deployment — Phase 14** (MEDIUM, ~1 week)
>    - Azure Container Apps (staging first)
>    - Production Clerk webhooks
>    - Load testing → blue-green cutover
>
> 6. **Obtain remaining secrets** (LOW — not blocking migration, only specific features)
>    - `RESEND_API_KEY` — email sending
>    - `TWILIO_*` — SMS notifications
>
> ---
>
> ### Azure Resources to Clean Up Post-Migration
>
> | Action | Resource Groups | Est. Savings |
> |--------|----------------|--------------|
> | 🔴 Delete now | `union-eyes-rg` (orphaned DB) | ~$25-50/mo |
> | 🔴 Delete after cutover | `unioneyes-staging-rg`, `unioneyes-prod-rg` | ~$50-100/mo |
> | 🔴 Delete (legacy predecessors) | `rg-union-claims-dev-4x25` + AKS managed RG | ~$85-200/mo |
> | 🟡 Keep until cutover | `unioneyes-prod-db` | — |
>
> ### Supabase
>
> | Project | Action |
> |---------|--------|
> | `union_eyes_app` (xryvcdbmljxlsrfanvrv) | 🟡 Keep until migration fully validated → delete |
>
> ---
>
> **Single most impactful next step:** Get `CLERK_WEBHOOK_SECRET`, start Django + Next.js simultaneously, sign in, and hit `GET /api/auth_core/me/`. That one end-to-end request closes Phase 10 (95% → 100%) and gives a working auth harness before starting any Phase 11 API work.
>
> **Confirm you understand the above and tell me: what is the exact next action to take?**

---

## How to Use

1. **New session**: Copy the "Audit Prompt" section above and paste it into the AI assistant.
2. **Mid-session checkpoint**: Re-read the "Remaining Phases" table to calibrate where you are.
3. **After completing a phase**: Update this file and `MIGRATION_DASHBOARD.md` simultaneously.

## File References

| Document | Path |
|----------|------|
| Migration Dashboard | `packages/automation/data/MIGRATION_DASHBOARD.md` |
| Next Steps Roadmap | `packages/automation/NEXT_STEPS.md` |
| Auth Implementation | `packages/automation/data/AUTH_IMPLEMENTATION_SUMMARY.md` |
| UE Audit Report (JSON) | `packages/automation/data/ue-audit-report.json` |
| UE Scaffold Guide | `tech-repo-scaffold/vertical-apps/union-eyes-scaffold.md` |
| Clerk Setup (UE) | `C:\APPS\nzila-union-eyes\backend\CLERK_SETUP_COMPLETE.md` |
| Session Summary | `packages/automation/SESSION_SUMMARY.md` |
