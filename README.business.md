# Nzila OS — Business Overview

> **Nzila OS is the operating system behind every Nzila Digital Ventures business line.**
> One platform, one identity, one audit trail — across agriculture, commerce, trade, finance, case management, professional exams, and the executive office that runs them all.

Nzila OS is **not a SaaS product we sell**. It is the internal operating fabric that every Nzila venture runs on. Customers experience a Nzila product (Agrimo, Flow, UnionEyes, Zonga, etc.); the company experiences Nzila OS — a single backbone for identity, data, governance, evidence, AI, and decision-making.

---

## At a glance

| | |
|---|---|
| **17 production apps** | Customer-facing products + internal control surfaces |
| **170+ shared packages** | 57 platform-* primitives + 113 domain libraries |
| **8,000+ contract tests** | Architectural invariants enforced on every commit |
| **47 CI/CD workflows** | Governance, security, deployment, compliance |
| **5 governance gates** | Dependency audit, secret scan, CodeQL, Trivy, AI red-team |
| **One auth authority** | `@nzila/platform-auth` (Argon2id passwords + optional Entra SSO) |
| **One audit substrate** | Hash-chained, evidence-sealed, residency-scoped |

---

## What makes Nzila OS different

### 1. Everything is audited — and the audit can prove itself
Every meaningful action — a payment approval, a regulatory filing, a contract close, an executive decision — is recorded in a tamper-evident audit chain. Mutating a past record breaks the hash chain and is detected the next time governance gates run.

### 2. Evidence packs, not screenshots
For high-stakes business events (contract completions, compliance attestations, terminal decisions), Nzila OS bundles supporting documents, actor identity, timestamps, and a cryptographic seal into an immutable **evidence pack** stored in Azure Blob with WORM semantics. Auditors get a verifiable artifact, not a folder of PDFs.

### 3. Org-scoped by construction
There is no "default" org, no global data, no cross-tenant leakage. Org isolation is enforced in the schema, in row-level security, in the API guards, and re-verified by ~250 contract tests on every PR. New tables that don't declare an `org_id` (or an explicit FK-scoped exemption) fail CI.

### 4. AI under governance
Every AI / ML capability is bounded by a **per-app AI profile**: budget caps, model allow-list, prompt versioning, drift monitoring, red-team adversarial tests. No app calls a model provider directly — all inference flows through `@nzila/platform-governed-ai` so spend, content, and risk are observable in one place.

### 5. The executive office is in the loop
A new **Executive Operating System** (Founder Focus Engine, Chief of Staff, Treasury, Collections, RevOps, Reliability, Security, Hiring, PMO, and a learning loop that scores recommendation outcomes) runs on the same Nzila OS substrate as the customer-facing products. The same audit, the same RBAC, the same evidence pipeline.

---

## Customer-facing product lines

### Agriculture — Agrimo + Cora
Two-surface agricultural operating system for Sub-Saharan supply chains: **Agrimo** runs field operations, **Cora** runs the intelligence on top of them.

- **Agrimo** (field operations) — dual-stack Next.js + Django platform managing the full agricultural supply chain: producer onboarding, harvest & lot tracking, production management, warehouse intake/dispatch, logistics, certifications, mobile-money payouts, and farm-to-buyer traceability with hash-verified evidence sealing. Packages: `agri-core`, `agri-db`, `agri-intelligence`, `agri-supply-chain`, `agri-traceability`, `agri-forecasting`.
- **Cora** (intelligence dashboard) — read-only analytics companion surfacing yield forecasting, price signals, risk & resilience scoring, cooperative performance, and supply-chain impact traceability. Built for co-op managers, buyers, and funders who need insight without write access to field data.

### Commerce — Flow
Multi-vertical commerce operating system spanning the full order-to-cash and procure-to-pay lifecycle. State-machine-driven workflows, configurable pricing engine, and automated commerce-governance checks on every mutation.

- **Order lifecycle** — quotes → orders → invoices → payments with strict FSM enforcement
- **Inventory & production** — inventory management, production tracking, purchase orders, supplier management
- **Pricing engine** — configurable rules, multi-currency, vertical-specific pricing
- **Integrations** — Shopify, Zoho, WhatsApp, plus the legacy ShopMoiÇa quoting bridge
- **Compliance** — full audit trail on every commerce mutation, automated governance gates before release

Dashboard surfaces: orders, quotes, invoices, products, inventory, clients, suppliers, purchase orders, payments, production, analytics, integrations.

### Trade
Cross-border trade and vehicle-commerce platform with tamper-evident evidence sealing for compliance-sensitive deals.

- **Deal origination & lifecycle** — end-to-end trade deal management from lead to settlement
- **Vehicle commerce** — specialised workflows for vehicle listings, inspections, and cross-border movements (`@nzila/trade-cars`)
- **Shipment tracking** — party management, consignment visibility, milestone events
- **Commission engine** — multi-party commission calculation and settlement
- **External adapters** — `@nzila/trade-adapters` for third-party trade systems (customs, logistics, regulators)
- **Evidence sealing** — HMAC-sealed evidence packs for contract closures and compliance attestation

### Finance — CFO
Finance operating plane for accounting and finance teams with AI-assisted advisory and document intelligence.

- **General ledger & close** — ledger management, reconciliation, period-close workflows
- **Tax tools** — obligation calendar, filing workflows, jurisdictional rules
- **AI advisory** — document intelligence (Azure Document Intelligence), receipt/invoice OCR (Dext), AI-powered advisory insights via `@nzila/ai-sdk`
- **Banking & integrations** — Plaid open-banking, Stripe payments + webhooks, Xero, QuickBooks Online sync
- **Client portal** — client-facing surface for document exchange and review
- **Audit trails** — full mutation audit with evidence-pack sealing for statutory filings

### Case Management — Union-Eyes
Full-stack **union case management platform** for Canadian labour unions operating under federal and provincial employment law. Dual-stack Next.js 16 + Django 5 with evidence-sealed audit trails that hold up in arbitration.

- **Grievance lifecycle** — intake → triage → investigation → mediation → arbitration → settlement/closure with strict FSM enforcement
- **Protocol-aware workflows** — steward-led, LRO-led, national-rep-led, or officer-led grievance protocols; one platform across traditional and professional unions (including CAPE)
- **Collective bargaining** — CBA tracking, clause libraries, precedent case law
- **Union operations** — elections with auditable voting, strike funds & dues administration, arrears, financial reporting
- **Health & safety** — workplace incident tracking, JOHS committees, hazard reporting
- **Federation scale** — CLC hierarchy support for locals, regionals, nationals, and cross-sector analytics across thousands of members
- **Evidence integrity** — SHA-256 hash-chained audit + AES-256 HMAC-sealed evidence packs for arbitration
- **Enterprise security** — Row-Level Security on every table, field-level encryption, 12 hardened HTTP headers
- **Compliance** — GDPR, PIPEDA, provincial privacy regimes, Indigenous data sovereignty, AODA accessibility

### Professional Exams — NACP
Examination and assessment platform for the National Anti-Corruption Programme — purpose-built for regulated exam administration.

- **Exam authoring & delivery** — exam creation, candidate dashboards, secure delivery
- **AI-assisted content** — AI-generated question banks, analytics, and scoring assistance via `@nzila/ai-sdk` / `@nzila/ml-sdk`
- **Assessment scoring** — rule-based scoring with audit trail
- **Compliance reporting** — regulator-ready exports with 7-year record retention
- **Audit & state management** — `@nzila/commerce-audit` + `@nzila/commerce-state` for every candidate interaction
- **Document storage** — `@nzila/blob` for exam artifacts, candidate submissions, and sealed grading evidence

### Music & Media — Zonga
**Africa-first** music distribution, streaming, and royalty platform for the African music ecosystem.

- **Artist & catalog** — artist onboarding, track & release management, catalog browsing, playlist curation, podcast hosting
- **Streaming & consumption** — subscription management, content moderation, listening analytics
- **Royalty & payouts** — royalty calculation, payout orchestration, Stripe-backed disbursement with finance-admin approval
- **Intelligence** — `@nzila/zonga-intelligence` for ML-powered recommendations
- **Africa-first commercial model** — documented monetization & royalty-trust framework built for African creator economics
- **Launch posture** — currently in **"Go With Restrictions"** mode: single-client commercial deployment, manual payout approval, 500-track / 100-concurrent-listener cap, invite-only creator registration, 14-day founder hypercare SLA. Restrictions lift as each readiness sprint closes.

### Investment Migration — Mobility + Mobility Client Portal
Purpose-built **investment migration advisory platform** for firms helping high-net-worth and ultra-high-net-worth families diversify citizenships and residencies across 25+ countries.

- **Mobility** (advisor-facing) — full advisory lifecycle: client intake with wealth-tier classification (HNWI/UHNWI), eligibility assessment against 40+ Citizenship-by-Investment / Residency-by-Investment / Golden Visa programs, KYC/AML screening, document collection, government submission tracking, and post-approval compliance. Integrates with HubSpot, Microsoft 365, and WhatsApp.
- **Mobility Client Portal** (applicant-facing) — secure self-service surface for HNWI/UHNWI clients and their families: document uploads, family-member management, case-status tracking, and encrypted messaging with the advisory team.

### Institutional Accountability — FAIRCASE (formerly ABR)
**FAIRCASE is Nzila OS's Canada-first enterprise operating system for Anti-Black racism prevention, response, accountability, learning, and measurable institutional change.** Built for serious Canadian institutions (universities, health authorities, public-sector employers, regulated enterprises) that need auditable, privacy-safe, evidence-based workflows — not a generic DEI LMS, complaint tracker, or legaltech tool.

- **Tribunal Intelligence** — Canadian ABR case law explorer with source registry, ingestion governance, freshness tracking, and manual review queue
- **Incident Response** — strict-lifecycle incident engine (intake → triage → action → remediation → close) with chronology timeline, role-scoped notes, and query-time redaction
- **Accountability Analytics** — operational dashboards, remediation trackers with owner/due-date/evidence fields, executive exports
- **Learning & Certification** — courses, cohorts, assignments, certifications, and incident-linked learning recommendations
- **Executive Governance** — dedicated CHRO, CEO/COO, Board, and public-sector views; bilingual EN-CA / FR-CA throughout
- **Export Layer** — role-aware executive-summary, incident, and remediation exports for procurement, audit, and regulatory submission

Bilingual by design (EN-CA / FR-CA), privacy-first, evidence-based — outcomes tied to policy, learning, and remediation rather than symbolic reporting.

### Partner Portal — Partners
External-partner portal for deal and GTM coordination, with row-level access gating so partners only see entities they are entitled to.

- **Deal pipeline** — partner-originated deal tracking with stage gates and approvals
- **Commission tracking** — multi-tier commission calculation, payout visibility, Stripe-backed settlement
- **Certification programs** — partner certification tracks with audit-ready completion records
- **GTM coordination** — co-marketing, co-selling, and partner enablement surfaces
- **API hub** — partner-facing API for integrations
- **ML analytics** — `@nzila/ai-sdk` / `@nzila/ml-sdk` for partner-performance insights
- **Access control** — `@nzila/platform-policy-engine` enforces entity-level scoping

### Public Web — Web
Public marketing surface for Nzila Digital Ventures. Marketing pages, documentation, and curated public content served from `content/public/` at `nzila.app/resources/{slug}`. No authenticated shell — by design.

---

## Internal operating surfaces

### Console — the operator's cockpit
Internal operations hub providing cross-vertical visibility across the entire Nzila portfolio. The single pane through which platform admins, studio admins, and ops run the business.

- **Governance & compliance** — governance dashboards, compliance snapshots, audit insights
- **Proof Center** — evidence packs, proof artifacts, assurance views
- **Operations** — ops dashboards, system health, trend detection, automation, performance
- **Finance ops** — cost management, collections, payments (Stripe/QBO/tax integrations)
- **Pilot & marketplace** — pilot health, marketplace listings, integration management
- **Executive Operating System** — Chief of Staff briefing, founder priorities, Command Center, ITSM service desk
- **Analytics** — cross-vertical analytics and reporting

### Platform Admin
Internal admin console exposing every platform-intelligence subsystem. Used by platform engineers to inspect runs, manage the knowledge graph, and debug reasoning pipelines.

- **Data Fabric** — data fabric management and lineage
- **Event Fabric** — event-stream browser
- **Ontology & Knowledge** — knowledge registry and ontology management
- **Entity Graph** — entity relationship viewer
- **Decisions & Reasoning** — decision graph explorer and reasoning-engine inspector
- **Semantic Search** — search admin
- **Orchestrator Ops** — orchestrator operations and observability
- **Platform Health** — health, diagnostics, and incident surfacing

### Control Plane
Platform-level governance layer — multi-tenant accounts, agent orchestration, anomaly detection, change governance, procurement proof, and cross-vertical decision intelligence.

- **Accounts & environments** — multi-tenant account management, environment registry
- **Agents & workflows** — agent orchestration via `@nzila/platform-agent-workflows`
- **Anomalies** — `@nzila/platform-anomaly-engine` for cross-signal anomaly detection
- **Architecture & modules** — architecture viewer, module registry
- **Change calendar** — change-request calendar with governance gates
- **Decisions & intelligence** — `@nzila/platform-intelligence` for cross-vertical decision support
- **Pilots & pipeline** — pilot registry and commercial pipeline
- **Partners & procurement** — partner registry and procurement-proof artifacts
- **Proof & proposals** — proof-center artifacts and proposal tracking

### Orchestrator API
Fastify-based execution backbone for long-running, idempotent business processes. The only authoritative workflow submission service across the platform.

- **Canonical `/execute` contract** — single submission path, DB-native idempotency on `(org_id, idempotency_key)`, authorization-decision enforcement
- **FSM-guarded lifecycle** — `pending → approved → dispatched → succeeded / failed / cancelled` with optimistic-concurrency version guards
- **Multi-instance coordination** — per-run leases, heartbeat timestamps, automatic recovery loop for abandoned runs after restart
- **Retries & dead-letter** — bounded exponential backoff with explicit failure-class classification; terminal `failed` state records `deadLettered=true`
- **Append-only event stream** — every transition emits an automation event for timeline and audit reconstruction
- **Procurement Proof Center** — `/proof-center` routes for evidence and proof artifacts
- **Security** — API-key auth + `x-org-id` / `x-actor-id` scope headers, Helmet hardening, rate limiting, org/actor scope matching on every mutation

### Service Operations (ITSM + Command Center)
Internal service desk for running the Nzila portfolio as a business, not just as software.

- **ITSM** — tickets, queues, SLAs, assets, problems, changes, approvals, knowledge base
- **Command Center** — one-screen founder-priority view surfacing renewal risk, product-health spikes, onboarding stalls, overdue items, and revenue events
- **Org-scoped** — every ITSM table enforced org-scoped by contract tests
- **Integrated with the Executive OS** — renewal risk and overdue items feed directly into Founder Priorities

---

## The Executive Operating System

The newest Nzila OS layer: a **multi-agent executive office** that turns operating telemetry into ranked, evidence-backed recommendations and tracks whether they actually moved the business.

| Agent | What it watches | What it produces |
|---|---|---|
| **Chief of Staff** | Initiatives, decisions, treasury, founder time | Today's decisive next steps |
| **Treasury** | Runway, burn, cash position | Treasury snapshots & runway alerts |
| **Internal CFO + Collections + Controller + FP&A + Tax** | Finance cadence | Close health, AR risk, FP&A signals |
| **RevOps + CS Renewal + Partnerships** | Pipeline, renewals, partner health | Renewal risk & expansion signals |
| **Reliability + Security + Release Guard + FinOps** | Production posture | Release gates, anomaly alerts, cost drift |
| **Knowledge Steward + Audit + Legal** | Governance | Policy diffs, audit findings |
| **Hiring + PMO + COO + Product Strategy** | Operating cadence | Hiring posture, project health |
| **Portfolio Allocator + Cross-Domain Synthesis** | Cross-vertical signal | Capital allocation & narrative synthesis |

Recommendations are **ranked, deduped, and tracked**. Each recommendation has a feedback loop (`accept` / `reject` / `postpone` / `modify` / `mark_wrong`) and an outcome record (`resolved` / `escalated` / `fizzled` / `blocked`) so the engine learns what actually mattered. Priority drift is snapshotted weekly so we can answer *"X was top-5 last week, now backlog — why?"*

---

## Governance & compliance

| Area | How it works |
|------|---|
| **Corporate governance** | Strategy and policy as source-controlled markdown in `governance/` — versioned, reviewed via PR |
| **Security pipeline** | Dependency audit, secret scan, CodeQL static analysis, Trivy container scan, weekly AI red-team |
| **Incident response** | Documented playbooks with severity classification and escalation paths |
| **Business continuity** | DR plans + RTO/RPO targets per app, maintained alongside code |
| **Change management** | Change requests, approval workflows, governance-approved gate on PRs touching sensitive paths |
| **Data lifecycle** | Per-app retention schedules, deletion policies, residency declarations — verified by contract tests |
| **Evidence ledger** | Immutable hash-chained ledger of every evidence pack ever sealed |
| **RBAC** | Five platform roles: Platform Admin, Studio Admin, Ops, Analyst, Viewer + Partner-scoped access |

---

## Technology foundation (non-technical)

| Layer | Choice | Why |
|---|---|---|
| **Web apps** | Next.js (React) | Modern, fast, large-platform-grade |
| **Domain backends** | Django (Python) | Mature for complex domain logic (agriculture, case management) |
| **Database** | PostgreSQL via Drizzle ORM / Django ORM | Industry-standard, transactional |
| **Identity** | `@nzila/platform-auth` — Argon2id email/password + optional Microsoft Entra SSO | Enterprise-grade, single source of truth |
| **Cloud** | Microsoft Azure (Container Apps, Blob, Key Vault) | Enterprise-grade hosting in Canada Central |
| **AI** | Azure OpenAI (governed via `@nzila/platform-governed-ai`) | Centralised model registry, budget caps, drift monitoring |
| **Payments** | Stripe | Industry standard |
| **Accounting** | QuickBooks Online | Automated bookkeeping sync |
| **Comms** | Email, SMS, Push, Slack, Microsoft Teams | Multi-channel notifications & ChatOps |

---

## Who uses what

| Role | Primary surfaces | Access |
|------|---|---|
| **Founder / CEO** | Console (Chief of Staff, Command Center, Founder Priorities) | Executive operating view |
| **Platform Admin** | Console, Platform Admin, all apps | Full platform configuration |
| **Studio Admin** | Console + their domain apps | Operational management within domain |
| **Ops** | Console + domain apps, ITSM service desk | Day-to-day operations & incident response |
| **Analyst** | Console, CFO, Cora | Read access to analytics & reporting |
| **Viewer** | Console | Read-only docs & status |
| **Partner (external)** | Partners portal | Scoped to entitled entities only |

---

## How the business proves it

Every Nzila product ships with three things that most internal platforms never produce:

1. **A continuous evidence trail** — hash-chained audit + sealed evidence packs that an external auditor can verify independently.
2. **A green CI pipeline as the contract** — 8,000+ invariant tests + 47 governance workflows must pass before any change reaches production.
3. **A residency & retention declaration** — every dataset has a published retention class, deletion method, and residency region, and the contract tests fail if a new table sneaks in without one.

That is the Nzila OS commitment: **operate with the audit trail of a regulated bank and the velocity of a startup.**

---

## Contact

- **Security disclosure**: security@nzilaventures.com
- **Engineering workflows**: see [CONTRIBUTING.md](CONTRIBUTING.md)
- **Architecture**: see [ARCHITECTURE.md](ARCHITECTURE.md)

---

*Nzila Digital Ventures — All rights reserved.*
