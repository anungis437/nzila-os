# Zonga — Pilot & Demo Guide

> Operational guide for running demos, staging pilots, and validating the end-to-end music ecosystem.

---

## 1. Prerequisites

| Dependency | Required | Notes |
|-----------|----------|-------|
| PostgreSQL | ✅ | Docker (`nzila-postgres`) or native on port 5433 |
| Node.js 20+ | ✅ | With pnpm |
| Azure Blob Storage | ✅ | `AZURE_STORAGE_ACCOUNT_NAME` + key for uploads |
| Stripe keys | ✅ | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` for ticketing |
| Clerk keys | ✅ | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` |

---

## 2. Seed Data

### Generate seed SQL

```bash
npx tsx scripts/zonga-seed.ts
```

This produces `scripts/zonga-seed-output.sql` with deterministic demo data:

| Entity | Count | Details |
|--------|-------|---------|
| Creators | 8 | Diverse African artists (Afrobeats, Highlife, Amapiano, etc.) |
| Content Assets | 12 | Audio tracks with metadata |
| Releases | 6 | 5 published, 1 draft |
| Events | 3 | Dakar, Lagos, Johannesburg |
| Listeners | 4 | Active fan accounts |
| Follows | 12 | Listener→Creator follows |
| Favorites | 11 | Various entity types |
| Playlists | 3 | With playlist items |
| Revenue Events | 20 | Streams, tips, downloads |
| Notifications | 5 | Mixed types |

### Load into Docker PostgreSQL

```powershell
Get-Content scripts/zonga-seed-output.sql | docker exec -i nzila-postgres psql -U nzila -d nzila_automation
```

### Load into native PostgreSQL

```powershell
psql -U nzila -d nzila_automation -p 5433 -f scripts/zonga-seed-output.sql
```

> **Note**: Seed uses org UUID `22222222-2222-2222-2222-222222222222` mapped to Clerk org `org_3BEaESt8ZIC4XEdJ7hmmB6nu6pp`. The `orgs` row is created automatically by the seed SQL with `ON CONFLICT` upsert.

---

## 3. Demo Walkthrough

### 3.1 Public Discovery (No Auth Required)

| Route | What to show |
|-------|-------------|
| `/` | Landing page with hero, featured artists, CTA |
| `/artists` | Artist directory with genre/country filter pills |
| `/artists/[id]` | Individual artist profile with releases |
| `/events` | Upcoming events listing |

**Key talking points:**
- Genre and country faceted filters on artist directory
- Artist profile shows follower count, release count, published releases
- Events show venue, ticket type count, date formatting
- All pages are server-rendered with dynamic OpenGraph metadata

### 3.2 Creator Dashboard (Auth Required)

| Route | What to show |
|-------|-------------|
| `/dashboard` | Overview with quick stats |
| `/dashboard/releases` | Release management with state machine transitions |
| `/dashboard/catalog` | Content asset management |
| `/dashboard/events` | Event creation and ticket type management |
| `/dashboard/analytics` | Platform analytics with engagement KPIs |

**Key talking points:**
- Release state machine: DRAFT → UNDER_REVIEW → PUBLISHED (with HELD, REJECTED, SCHEDULED, ARCHIVED)
- Only valid transitions shown via `getAvailableTransitions()`
- Analytics shows: total revenue, active creators, published releases, follower/favorite counts
- Top Creators and Top Assets leaderboards

### 3.3 Listener Features (Auth Required)

| Route | What to show |
|-------|-------------|
| `/dashboard/listener` | Listener feed with followed artists, favorites, playlists |
| `/dashboard/listener` → Follow | Follow/unfollow creators |
| `/dashboard/listener` → Favorites | Favorite/unfavorite any entity type |
| `/dashboard/listener` → Playlists | Create playlists, add/remove tracks |

### 3.4 Moderation Workflow (Operator Auth)

| Route | What to show |
|-------|-------------|
| `/dashboard/moderation` | Moderation case queue |
| `/dashboard/moderation` → Cases | Open cases with severity indicators |
| `/dashboard/moderation` → Signals | Integrity signals (copyright, abuse, quality, policy, fraud) |

**Key talking points:**
- Case lifecycle: OPEN → IN_REVIEW → RESOLVED / DISMISSED / ESCALATED
- Integrity signals auto-flag content for review
- Case resolution updates entity status (release held/rejected/published)

### 3.5 Revenue & Payouts

| Route | What to show |
|-------|-------------|
| `/dashboard/revenue` | Revenue event ledger |
| `/dashboard/payouts` | Payout preview → lock → execute cycle |

**Key talking points:**
- Revenue events are append-only (streams, tips, ticket sales, sync licenses)
- Royalty splits computed per release configuration
- Payout preview shows gross → platform fee → net
- Stripe Connect / M-Pesa / bank transfer payout rails

---

## 4. Contract Test Validation

Run all Zonga contract tests to verify structural integrity:

```bash
# Phase 2 action contracts (50 tests)
pnpm vitest run --project contract-tests tooling/contract-tests/zonga-phase2-actions.test.ts

# E2E domain migration contracts (35 tests)
pnpm vitest run --project contract-tests tooling/contract-tests/zonga-e2e-domain.test.ts

# Commerce stack contracts (115 tests)
pnpm vitest run --project contract-tests tooling/contract-tests/commerce-stack.test.ts tooling/contract-tests/commerce-invariants.test.ts
```

### Expected results

| Suite | Tests | Expected |
|-------|-------|----------|
| Phase 2 actions | 50 | 50 pass |
| E2E domain | 35 | 35 pass |
| Commerce | 115 | 115 pass |
| **Total** | **200** | **200 pass** |

---

## 5. Architecture Invariants

These invariants are verified by contract tests and must hold:

1. **Domain tables first**: All operational reads/writes target `zonga_*` domain tables, never `audit_log`
2. **Audit_log supplementary**: `INSERT INTO audit_log` used only for traceability, never for business state
3. **Exception**: Comments stay in `audit_log` (append-only, low-volume, no query by status needed)
4. **Upload storage**: `zonga_content_assets.storage_url` and `.cover_art_url` store blob paths
5. **State machine**: Release transitions via `transitionReleaseStatus()` → `attemptTransition()` → validated by `@nzila/commerce-state`
6. **Org-scoped**: Every table has `org_id` column; every query filters by org
7. **Auth boundary**: Public marketing routes bypass auth via middleware; dashboard routes require Clerk auth via `resolveOrgContext()`
8. **Evidence packs**: Governance-critical actions generate evidence via `buildEvidencePackFromAction()`

---

## 6. Known Limitations (Pre-GA)

| Area | Status | Notes |
|------|--------|-------|
| Audio streaming | Stub | `getStreamUrl()` returns signed blob URL, no adaptive bitrate |
| Push notifications | Not implemented | Only in-app notification feed (v1) |
| Listener profiles | Basic | Profile CRUD exists but no avatar upload |
| Search ranking | Simple | SQL `ILIKE` search, no full-text or vector ranking |
| Event check-in | Implemented | QR-based check-in with offline mode in @nzila/zonga-events |
| Royalty computation | Implemented | Full engine in @nzila/zonga-rights/royalties with per-holder breakdowns |
| M-Pesa payouts | Implemented | MTN MoMo adapter + 13 provider routes in @nzila/zonga-payments |
| KYC gate | Optional | Creator `identity_verified` field exists, no KYC provider integrated |
