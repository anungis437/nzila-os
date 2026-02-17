# Justice-Equity Vertical — Technical Architecture

**Last Updated: February 2026**
**Platform:** ABR Insights
**Migration Complexity:** HIGH (132 Supabase tables, 10-12 weeks automated via Backbone)

---

## 1. Architecture Overview

ABR Insights is built on a modern serverless-first stack designed for scalability, security, and AI-native capabilities.

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  Next.js 14+ App Router (SSR/RSC) │ PWA Mobile Shell    │
├─────────────────────────────────────────────────────────┤
│                    Auth Layer                            │
│  Clerk (SSO, SAML, MFA) │ RBAC Middleware               │
├─────────────────────────────────────────────────────────┤
│                    API Layer                              │
│  Next.js Route Handlers │ tRPC │ REST API v1             │
├──────────────┬──────────────┬───────────────────────────┤
│  LMS Engine  │  AI Services │  Gamification Engine       │
│  Courses     │  GPT-4 Coach │  XP / Badges / Streaks     │
│  Assessments │  Semantic    │  Leaderboards              │
│  Certificates│  Search      │  Adaptive Progression      │
├──────────────┴──────────────┴───────────────────────────┤
│                    Data Layer                             │
│  Azure PostgreSQL (Drizzle ORM) │ pgVector │ Blob Storage│
├─────────────────────────────────────────────────────────┤
│                    Infrastructure                        │
│  Azure Container Apps │ Azure CDN │ GitHub Actions CI/CD  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Next.js 14+ App Router Architecture

### Route Structure

| Route Group | Purpose | Auth Level |
|-------------|---------|------------|
| `/(marketing)` | Public landing, pricing, blog | Public |
| `/(auth)` | Sign-in, sign-up, SSO callback | Public |
| `/(dashboard)` | Learner dashboard, courses, progress | Authenticated |
| `/(admin)` | Org admin, user management, reports | Admin role |
| `/(api)` | REST API, webhooks, integrations | API key / JWT |
| `/(tribunal)` | Case search, case detail, saved searches | Authenticated |

### Key Technical Decisions

- **React Server Components (RSC)** for data-heavy pages (course catalog, tribunal search results)
- **Server Actions** for mutations (course progress, assessment submissions, XP updates)
- **Streaming SSR** for AI-generated content (GPT-4 coach responses)
- **Parallel Routes** for admin dashboards (side-by-side analytics views)
- **Drizzle ORM** for type-safe database access across 132 tables

---

## 3. Azure OpenAI GPT-4 Integration

### Companion Prompt Library Architecture

The Companion Prompt Library (200+ prompts, copyright registered) powers all AI interactions:

| Component | Description |
|-----------|-------------|
| Prompt Registry | Versioned prompt storage (200+ prompts, categorized by course/topic) |
| Prompt Router | Selects optimal prompt based on learner context, course, and interaction type |
| Context Builder | Assembles learner profile, course progress, and conversation history |
| Safety Layer | Content filtering, bias detection, cultural sensitivity checks |
| Response Formatter | Structures GPT-4 output for UI rendering (markdown, citations, actions) |

### Prompt Routing Logic

```
Input → Context Builder → Prompt Router → Safety Pre-Check → GPT-4 API
                                                                   ↓
UI ← Response Formatter ← Safety Post-Check ← Raw Response
```

### Safety Guardrails

| Guardrail | Implementation |
|-----------|---------------|
| Content Filter | Azure Content Safety API (hate, violence, self-harm, sexual) |
| Bias Detection | Custom classifier trained on DEI-specific bias patterns |
| Cultural Sensitivity | Prompt-level instructions + post-response review |
| Hallucination Prevention | RAG-grounded responses with CanLII citation requirements |
| Rate Limiting | Per-user: 50 requests/hour, per-org: 500 requests/hour |
| PII Filtering | Regex + NER model to strip PII before prompt submission |

### Model Configuration

| Parameter | Value |
|-----------|-------|
| Model | `gpt-4` (Azure OpenAI, Canada East region) |
| Temperature | 0.3-0.7 (adaptive based on interaction type) |
| Max Tokens | 1,024 (coach responses), 2,048 (case analysis) |
| Fallback Model | `gpt-3.5-turbo` (cost optimization for simple queries) |
| Embedding Model | `text-embedding-3-large` (1536 dimensions for pgVector) |

---

## 4. pgVector Semantic Search — CanLII Case Indexing

### Embedding Pipeline

```
CanLII API → Raw Case Text → Chunking (512 tokens, 50 overlap)
    → text-embedding-3-large → pgVector Storage → Index (IVFFlat)
```

### Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `case_number` | TEXT | CanLII case identifier |
| `title` | TEXT | Case title |
| `jurisdiction` | TEXT | Province / Federal |
| `year` | INT | Decision year |
| `tribunal` | TEXT | Adjudicating body |
| `content_chunk` | TEXT | 512-token text chunk |
| `embedding` | VECTOR(1536) | text-embedding-3-large output |
| `metadata` | JSONB | Sector, outcome, grounds, remedy |

### Search Configuration

| Parameter | Value |
|-----------|-------|
| Index Type | IVFFlat (lists=100) |
| Distance Metric | Cosine similarity |
| Similarity Threshold | 0.78 (tuned for legal relevance) |
| Top-K Results | 10 (re-ranked by metadata relevance) |
| Hybrid Search | pgVector cosine + tsvector full-text (0.7/0.3 weight) |
| Refresh Cadence | Weekly incremental (new CanLII cases), quarterly full re-index |

---

## 5. Gamification Engine Schema (18 Tables)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_xp` | XP accumulation per learner | user_id, total_xp, level, updated_at |
| `xp_transactions` | Granular XP events | user_id, source, amount, multiplier, created_at |
| `badges` | Badge definitions | id, name, description, icon_url, tier |
| `user_badges` | Earned badges per learner | user_id, badge_id, earned_at, course_id |
| `streaks` | Daily learning streaks | user_id, current_streak, longest_streak, last_active |
| `leaderboards` | Org/global leaderboard snapshots | id, scope, period, rankings (JSONB) |
| `leaderboard_entries` | Individual leaderboard positions | leaderboard_id, user_id, rank, xp |
| `challenges` | Team/individual challenges | id, type, target, start_date, end_date |
| `challenge_participants` | Challenge enrollment | challenge_id, user_id, progress |
| `achievements` | Complex multi-step achievements | id, name, criteria (JSONB) |
| `user_achievements` | Unlocked achievements | user_id, achievement_id, unlocked_at |
| `difficulty_settings` | Adaptive difficulty per learner | user_id, course_id, difficulty_level |
| `progression_curves` | Adaptive XP curve definitions | level, xp_required, unlock_features |
| `rewards` | Redeemable rewards catalog | id, name, cost_xp, type |
| `user_rewards` | Redeemed rewards | user_id, reward_id, redeemed_at |
| `engagement_metrics` | Daily engagement aggregates | user_id, date, sessions, time_spent |
| `notifications_gamification` | Gamification-triggered notifications | user_id, type, message, read |
| `seasonal_events` | Time-limited gamification events | id, name, start, end, multiplier |

### XP Calculation Formula

```
XP = base_xp × difficulty_multiplier × streak_bonus × event_multiplier

Where:
  base_xp = action-dependent (lesson: 10, quiz: 25, assessment: 50, case study: 30)
  difficulty_multiplier = 1.0 + (difficulty_level × 0.15)  [range: 1.0–2.5]
  streak_bonus = min(1.0 + (current_streak × 0.05), 2.0)  [caps at 2x]
  event_multiplier = seasonal_events.multiplier or 1.0      [range: 1.0–3.0]
```

### Adaptive Difficulty Curve

| Level | XP Required | Cumulative XP | Unlocks |
|-------|------------|---------------|---------|
| 1 | 0 | 0 | Basic courses |
| 2 | 100 | 100 | Tribunal search |
| 3 | 250 | 350 | AI coach deeper mode |
| 5 | 600 | 1,350 | Advanced courses |
| 8 | 1,200 | 4,350 | Case study creation |
| 10 | 2,000 | 8,350 | CE credit courses |
| 15 | 5,000 | 23,350 | Expert badge, mentor role |

---

## 6. Clerk Auth — Enterprise SSO

| Feature | Configuration |
|---------|--------------|
| Auth Methods | Email/password, Google, Microsoft, Apple |
| Enterprise SSO | SAML 2.0 (Okta, Azure AD, OneLogin) |
| MFA | TOTP, SMS (required for admin roles) |
| RBAC Roles | Learner, Manager, OrgAdmin, SuperAdmin |
| Session Management | 24h active, 7d refresh, force-logout capability |
| Webhooks | User created/updated/deleted → sync to PostgreSQL |

---

## 7. Backbone Migration Plan

### Migration Scope

| Metric | Value |
|--------|-------|
| Source | Supabase (PostgreSQL) |
| Target | Azure PostgreSQL Flexible Server |
| Tables | 132 |
| Complexity | HIGH |
| Estimated Duration | 10-12 weeks (automated via Backbone) |
| ORM | Drizzle (schema generation from migration) |

### Migration Phases

| Phase | Duration | Scope |
|-------|----------|-------|
| Phase 1: Schema Analysis | Week 1-2 | Automated schema extraction, dependency mapping |
| Phase 2: Schema Migration | Week 3-4 | DDL migration, index creation, constraint validation |
| Phase 3: Data Migration | Week 5-7 | Full data transfer, pgVector index rebuild |
| Phase 4: Application Layer | Week 8-9 | Drizzle schema generation, API endpoint migration |
| Phase 5: Auth Migration | Week 10 | Supabase Auth → Clerk migration (user accounts) |
| Phase 6: Validation | Week 11-12 | Integration testing, performance benchmarks, cutover |

---

## 8. Azure Infrastructure

| Service | Purpose | SKU / Config |
|---------|---------|-------------|
| Azure Container Apps | Next.js hosting (auto-scale) | Consumption plan, min 1 / max 10 replicas |
| Azure PostgreSQL Flexible | Primary database (132 tables + pgVector) | General Purpose, D4s_v3, 128GB storage |
| Azure OpenAI | GPT-4 + embeddings | Canada East, 60K TPM quota |
| Azure Cognitive Services | Content Safety API | Standard tier |
| Azure Blob Storage | Course media (video, PDF, images) | Hot tier, LRS, CDN-fronted |
| Azure CDN | Static assets + media delivery | Standard Microsoft tier |
| Azure Application Insights | APM, logging, custom metrics | Connected to Container Apps |
| Azure Key Vault | Secrets management | Standard tier |
| GitHub Actions | CI/CD pipeline | Self-hosted runners (optional) |

### Estimated Monthly Infrastructure Cost

| Service | Monthly Cost (CAD) |
|---------|--------------------|
| Container Apps | $150-$400 |
| PostgreSQL Flexible | $300-$500 |
| Azure OpenAI | $200-$800 (usage-dependent) |
| Blob Storage + CDN | $50-$150 |
| Monitoring + Key Vault | $30-$50 |
| **Total** | **$730-$1,900** |
