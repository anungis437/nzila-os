# Zonga (CongoWave) Legacy App — Comprehensive Inventory

**Source:** `C:\APPS\legacy\zonga\congowave_app_v1-main\`  
**Assessed:** 2026-02-24  
**Assessment docs claim:** "95/100 health score, production ready" (January 2026)

---

## 1. Directory Layout

```
congowave_app_v1-main/
├── backend/              # Django 5.0.1 / DRF REST API
│   ├── apps/             # 17 Django apps (see §3)
│   ├── config/           # Django settings (local / production)
│   ├── requirements/     # pip requirements (local.txt, production.txt)
│   ├── scripts/          # management helpers
│   ├── staticfiles/
│   └── manage.py
├── frontend/             # Next.js 16.1.4 / React 19.2.3 SPA
│   └── src/
│       ├── app/          # ~52 pages (App Router)
│       ├── components/   # ~36 UI components
│       ├── contexts/     # CurrencyContext
│       ├── hooks/        # useAuth, useSubscription, useLowBandwidthMode
│       ├── i18n/         # next-intl internationalisation
│       ├── lib/          # api/, cdn, pwa, security, sentry, utils
│       └── store/        # Zustand (auth, player)
├── infrastructure/       # Terraform + Azure setup scripts
├── nginx/                # Reverse-proxy config
├── docker-compose.yml    # Postgres 15, Redis 7, Elasticsearch 8.17, backend, frontend
├── docker-compose.microservices.yml
├── docker-compose.production.yml
├── docker-compose.scaling.yml
└── docs/                 # Extensive markdown docs
```

---

## 2. Tech Stack

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.1.4 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5.x |
| State | Zustand | 5.0.10 |
| Server state | TanStack React Query | 5.90.19 |
| HTTP | Axios | 1.13.2 |
| Forms | react-hook-form + zod | 7.71 / 4.3 |
| UI primitives | Radix UI + Tailwind CSS 4 + CVA + tailwind-merge | — |
| Styling | Tailwind CSS (PostCSS plugin) | 4.x |
| Animation | Framer Motion | 12.27 |
| Payments | Stripe React / stripe-js | 5.4 / 8.6 |
| Video/Audio | react-player 3.4, hls.js 1.6 | — |
| i18n | next-intl | 4.7 |
| QR | qrcode | 1.5 |
| Toasts | Sonner | 2.0 |
| Error tracking | Sentry (@sentry/nextjs) | 8.55 |
| Theming | next-themes | 0.4 |
| Testing | Jest + Testing Library, Playwright (e2e), Vitest (contract) | — |
| Linting | ESLint 9 + eslint-config-next | — |

### Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Django | 5.0.1 |
| API | Django REST Framework | latest |
| Language | Python | 3.13 |
| Database | PostgreSQL | 15 (Docker, port 15432) |
| Cache / Broker | Redis | 7 (port 6379) |
| Search | Elasticsearch | 8.17 |
| Task queue | Celery (Redis broker) | — |
| WSGI | Gunicorn (4 workers) | — |
| Storage | Azure Blob Storage | — |
| Payments | Stripe (server-side) | — |

### Infrastructure

| Concern | Tooling |
|---------|---------|
| Containers | Docker Compose (dev, prod, scaling, microservices) |
| IaC | Terraform (Azure) |
| Reverse proxy | Nginx |
| CI | GitHub Actions (`.github/`) |

---

## 3. Backend Django Apps (17)

| App | Purpose |
|-----|---------|
| `users` | Custom User model (email-based, UUID PK, roles) |
| `authentication` | JWT login/register, email verification, password reset |
| `organizations` | Artist/Venue/Church/Label profiles, members, followers, reviews |
| `content` | Tracks, Releases (Album/EP/Single), Videos, Playlists |
| `events` | Events (concerts, festivals, services), lineup |
| `ticketing` | Orders, Tickets, TicketTypes (tiers), PromoCode, check-in, transfers, waitlist |
| `payments` | Payment, Refund, Tip, Payout, Wallet, WalletTransaction, Plan, Subscription, Entitlement, CommissionConfig, PaymentAuditEvent |
| `royalties` | RightsHolder, TrackRights, RoyaltyStatement (splits & payouts) |
| `streaming` | AudioTranscode, VideoTranscode, DownloadedContent, CDNCache, DRM service |
| `media` | MediaFile upload (Azure Blob), chunked uploads |
| `analytics` | TrackPlay, EventView, VideoView, SearchQuery, TicketScan, DailyMetric, UserEngagement |
| `discovery` | Trending, personalised playlists, listening history, search |
| `ml` | Recommendation engine, fraud detection, user behaviour profiles |
| `notifications` | In-app notifications (mark read, unread count) |
| `realtime` | (placeholder/WebSocket support) |
| `governance` | (placeholder/admin governance) |
| `core` | Shared utilities |

---

## 4. Data Model — Key Entities

### User

- UUID PK, email-based login, roles: `listener | artist | organizer | admin`
- `stripe_customer_id`, `preferred_currency` (CAD default), `detected_country`
- `is_verified`, `is_staff`, `profile_image`, `bio`

### Organization

- Types: `artist | musician | painter | pastor | venue | church | label | promoter`
- KYC verification (`verification_status`, `id_document_url`)
- `follower_count`, `average_rating`, `total_reviews`
- Social links (JSON), location (JSON), specialties, languages

### Content

- **Release** — Album/EP/Single/Compilation with `cover_art_url`, `upc`, `release_date`
- **Track** — Belongs to Organization & optional Release; `audio_file_url` (Azure Blob), `cover_art_url`, `artists` (JSON), `featuring` (JSON), `genre`, `mood`, `language`, `duration_seconds`, `isrc`, `tags` (ArrayField), `lyrics`, `synced_lyrics` (JSON), `play_count`, visibility/status
- **Video** — Org-owned, `video_url`, `thumbnail_url`, `view_count`, `is_premium`
- **Playlist** — User-created, ordered tracks

### Events & Ticketing

- **Event** — Org-organized, typed (concert/festival/service/…), venue geo, lineup, capacity, waitlist
- **TicketType** — Price tiers per event; quantity management
- **Order** — Contains OrderItems → TicketTypes; statuses include `pending → paid → completed`
- **Ticket** — Individual ticket with QR, check-in, transfer support
- **PromoCode** — Percentage or fixed discount, usage limits

### Payments & Revenue

- **Payment** — Stripe-backed, `payment_intent_id`, fraud scoring, idempotency key
- **Refund** — Linked to Payment + Order, reason-coded
- **Tip** — From user to org (optionally linked to Track or Event)
- **Payout** — Periodic org payouts (Stripe Connect), breakdown: ticket_sales, tips, fees
- **Wallet** — Org balance tracking; WalletTransaction ledger
- **Plan** → **Subscription** → **Entitlement** (SaaS subscription layer)
- **CommissionConfig** — Platform fee configuration
- **PaymentAuditEvent** — Immutable audit log

### Royalties

- **RightsHolder** — Stripe Connect onboarding, tax ID, role (artist/songwriter/producer/…)
- **TrackRights** — Per-track split percentages, rights types (mechanical, performance, sync, master)
- **RoyaltyStatement** — Monthly calculated statements per rights holder

### Analytics

- TrackPlay, EventView, VideoView, SearchQuery, TicketScan
- DailyMetric (aggregated), UserEngagement

### ML

- Recommendation, FraudDetection, MLModel, UserBehaviorProfile

---

## 5. Auth Model

| Aspect | Implementation |
|--------|---------------|
| Strategy | JWT (access + refresh tokens) |
| Storage | `sessionStorage` (client-side) — keys: `congowave_access_token`, `congowave_refresh_token` |
| Refresh | Axios interceptor auto-refreshes on 401; queues pending requests |
| State | Zustand `useAuthStore` (also exposes `useAuth` hook) |
| Roles | `listener`, `artist`, `organizer`, `admin` — checked on frontend via `user.role` |
| User model | Custom `AbstractBaseUser` with `email` as USERNAME_FIELD |
| Registration | Email + password (password1/password2), optional name |
| Password reset | Token-based (uid + token flow) |
| Email verification | Backend endpoint exists (`/auth/verify-email/`) |

---

## 6. Background Jobs / Workers (Celery)

| Task file | Key tasks |
|-----------|-----------|
| `discovery/tasks.py` | `generate_daily_mixes_for_active_users`, `generate_discover_weekly_for_all` |
| `royalties/tasks.py` | `generate_monthly_royalty_statements`, `recalculate_statement` |
| `streaming/tasks.py` | `transcode_audio_track` (audio transcoding → Azure Blob, max 3 retries) |
| `ticketing/tasks.py` | `expire_orders` (periodic, cancels expired pending orders, releases inventory) |
| `ml/tasks.py` | `update_all_user_profiles`, `generate_daily_recommendations` |
| `governance/tasks.py` | (governance-related tasks) |

---

## 7. Integrations

| Integration | Usage | Notes |
|-------------|-------|-------|
| **Stripe** | Payments (PaymentIntents), Tips, Subscriptions, Payouts (Connect), Refunds, Billing Portal | Frontend uses `@stripe/react-stripe-js` + `loadStripe`; Backend creates intents, handles webhooks at `/payments/webhook/stripe/` |
| **Azure Blob Storage** | Media file storage (audio, video, cover art, profiles) | Upload flow: POST `/media/upload/` → Azure → get URL → use in entity creation. Chunked upload supported. |
| **Elasticsearch 8** | Full-text search, discovery, trending analytics | `ELASTICSEARCH_DSL_HOSTS` config |
| **Redis** | Celery broker, caching | Port 6379, separate DB for broker (DB 1) |
| **Sentry** | Error tracking & performance monitoring (frontend) | `@sentry/nextjs` 8.55 |
| **Azure (Terraform)** | Target deployment platform | `infrastructure/terraform/`, `setup-azure-simple.ps1` |
| **Resend** | Email service (verification, notifications) | Referenced in test scripts |

---

## 8. Risky Patterns & Technical Debt

### High Risk

| Pattern | Detail |
|---------|--------|
| **Tokens in sessionStorage** | Access + refresh tokens stored in `sessionStorage` — vulnerable to XSS. Should use httpOnly cookies. |
| **`error: unknown` without proper typing** | Auth store catches `error: unknown` then accesses `error.response?.data` without type narrowing (TS unsafe) |
| **Inconsistent API URL patterns** | Organization profile page uses raw paths like `/organizations/${id}/` (no `/api/v1/` prefix) alongside properly prefixed endpoints — will produce 404s or depend on proxy rewriting |
| **Duplicated User type** | `User` interface defined in both `store/auth.ts` AND `lib/api/types.ts` — can drift |
| **`print()` in Celery tasks** | Background tasks use `print()` instead of `logger` for error reporting (discovery, royalties) |

### Medium Risk

| Pattern | Detail |
|---------|--------|
| **31 `console.log/warn/error`** calls in frontend | Should be replaced with structured logger or removed |
| **Build size: 797 MB** | Unreasonably large Next.js build — likely includes unoptimized assets or unnecessary deps |
| **Hardcoded fallback currencies** | `CurrencyContext` has hardcoded USD/CAD/EUR/GBP fallback when API fails |
| **Global Zustand stores** | Auth & Player stores are global singletons — fine for SPA but makes SSR/testing harder |
| **No query-key factory consistency** | Some pages use `queryKeys.xxx`, others use inline string arrays (`['wallet-stats']`, `['analytics-overview']`) — cache invalidation bugs |
| **Direct `apiClient.get(...)` in pages** | Organization profile, analytics pages bypass the API layer and call `apiClient` directly with raw URLs instead of using the typed API modules |
| **Missing error boundaries** | Pages rely on TanStack Query error states but no React error boundaries visible |
| **`eslint --max-warnings=300`** | 300 lint warnings tolerated — indicates significant unresolved lint issues |

### Low Risk

| Pattern | Detail |
|---------|--------|
| **Type alias proliferation** | Many `// Alias` fields on types (e.g., `capacity` ↔ `total_capacity`, `date` ↔ `start_datetime`) — signals unstable backend contract |
| **JSON fields for structured data** | `artists`, `featuring`, `social_links`, `location`, `synced_lyrics` all stored as `JSONField` — no schema validation at DB level |
| **`is_active` + `deleted_at` soft-delete pattern** | Used inconsistently across models |

---

## 9. What's Worth Extracting vs Discarding

### EXTRACT (high value — port into Nzila)

| Asset | Why | Migration notes |
|-------|-----|-----------------|
| **Data models & schema** | Well-designed entity relationships (User → Org → Content → Payments → Royalties) | Port Django models → Drizzle/Prisma schemas. UUID PKs align with our convention. |
| **Payments domain** | Complete Stripe integration: PaymentIntents, Tips, Subscriptions, Payouts, Wallets, Refunds, Audit log, Commission config | Extract business logic from Django views/serializers → TypeScript services in `commerce-*` packages |
| **Royalties domain** | Rights holders, track splits, monthly statement generation | Port to `commerce-services` or dedicated package. Celery tasks → BullMQ jobs. |
| **Ticketing domain** | Order → TicketType → Ticket pipeline with QR, check-in, transfer, promo codes, waitlist | Port to `commerce-services`. Order expiration task → BullMQ scheduled job. |
| **API endpoint map** | `endpoints.ts` is a clean single-source registry of all 90+ API routes | Useful as migration checklist; rewrite against new API |
| **TypeScript types** | `types.ts` (796 lines) — comprehensive frontend type definitions matching backend serializers | Review and adopt as base types (remove alias duplication) |
| **Content model** | Track, Release, Video, Playlist with Azure Blob integration | Maps directly to our `os-core` / `blob` packages |
| **Analytics schema** | TrackPlay, EventView, DailyMetric, UserEngagement tracking | Port to our analytics package |
| **i18n setup** | `next-intl` configuration for multi-language support | Evaluate vs our i18n approach |

### ADAPT (useful patterns, needs rework)

| Asset | Why adapt | What to change |
|-------|-----------|----------------|
| **Auth flow** | JWT refresh logic is solid | Move tokens to httpOnly cookies; replace Zustand auth store with server-side session |
| **React Query patterns** | Good use of `queryKeys`, `useMutation`, optimistic updates | Standardise key factories; eliminate inline string keys |
| **Upload flow** | Chunked upload to Azure Blob is valuable | Integrate with our `blob` package; add progress tracking |
| **Player component + store** | Full audio player with queue, shuffle, repeat, volume | Port Zustand store to our player package; replace raw `<audio>` with proper audio service |
| **Currency system** | Multi-currency with user preference, server-synced | Merge with our `commerce-core` currency handling |
| **Celery tasks** | Good task definitions for royalties, transcoding, recommendations | Rewrite as BullMQ workers in our `automation` package |

### DISCARD (low value or superceded)

| Asset | Why discard |
|-------|-------------|
| **Django backend entirely** | We're on Node/TypeScript; porting Python → TS is cleaner than wrapping |
| **Axios HTTP client** | We use `fetch` or `ky`; the interceptor pattern is useful but axios is unnecessary |
| **Framer Motion animations** | Evaluate per-component; many are decorative. Our Radix/Tailwind approach may suffice |
| **Elasticsearch integration** | Evaluate whether our search needs require ES or if PostgreSQL full-text + our existing approach works |
| **ML app (recommendation/fraud)** | Placeholder-quality ML models; our `ml-core`/`ml-sdk` packages are more mature |
| **`react-player` dependency** | HLS.js + native `<audio>` / `<video>` is lighter and already in use |
| **797 MB build artifacts** | Investigate and fix; likely dev-only bloat |
| **300+ ESLint warnings** | Don't port the tech debt; enforce strict linting from day one |
| **Duplicative Docker Compose variants** | Consolidate into our existing Docker setup |
| **Extensive docs & assessment reports** | Reference only; don't copy MD files into Nzila repo |

---

## 10. Summary Statistics

| Metric | Value |
|--------|-------|
| Frontend TSX files | 96 |
| Frontend pages | ~52 |
| Frontend UI components | ~36 |
| Backend Python files | 255 |
| Backend Django apps | 17 |
| Backend model files | 16 |
| Backend view files | 17 |
| API endpoints | 90+ |
| Celery task files | 6 |
| DB tables (estimated) | ~40+ |
| `console.*` calls in frontend | 31 |
| ESLint max-warnings | 300 |
| Build size | 797 MB |
| Frontend dependencies | 35 prod + 11 dev |
