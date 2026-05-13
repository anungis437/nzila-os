# Workstream D — Module Descriptions, Package Metadata & Entitlement Semantic Audit

**Status:** Source-of-truth audit (pre-implementation)
**Scope:** apps/union-eyes runtime module catalogues, entitlement registry, package metadata, AI capability descriptions, module landing pages, onboarding/upgrade copy.
**Discipline:** Display-layer overlays only. No identifier churn, no schema/permission edits, no module-key renames.

---

## 1. Foundational principles (carried from Workstreams A–C)

- **Institutional, continuity-aware framing.** Modules are *capabilities of the Institution*, not features of a SaaS suite.
- **Reviewer-assisted AI, never autonomous decisioning.** All intelligence surfaces must read as governed assistance to a human representative.
- **Entitlements describe contractual activation, not feature gating.** Reframe "feature control" → "contract-activated capabilities".
- **Protected technical identifiers preserved.** `PlatformModuleKey` enum strings, billing tier ("Pro"), package names, telemetry keys, route paths.
- **Locked taxonomy** (from C): Inbox→Intake & Coordination · Work→Casework Continuity · Priorities→Commitments & Deadlines · Intelligence→Institutional Intelligence · Cognition→Governed Reasoning · Governance→Governance of Record · Corporate Memory→Institutional Memory · Trust→Trust & Sovereignty · Workbench→Casework Console · Cases→Representation Cases · Reports→Institutional Reports · Operational Health→Continuity Operations · Outcomes→Member Outcomes Ledger · Submit Request→Open Representation Case.

---

## 2. Surface inventory & classification

### 2.1 Fully aligned (no edit required)

| Surface | Notes |
|---|---|
| `apps/union-eyes/services/platform-economics/entitlement-guard.ts` — `PLATFORM_MODULE_DISPLAY` (18 entries, displayName + narrativeTagline) | Already strongly institutional after Workstream B (e.g. `governance_suite` "Governance of Record", `ai_advanced_insights` tagline "...never autonomous decisions", `union_knowledge_suite` "Institutional Memory"). Retained verbatim; **extend interface** with optional richer description fields (additive, fallback safe). |
| `getModuleDisplay()` fallback humaniser | Safe — ungoverned keys still yield a readable label without leaking SaaS phrasing. |

### 2.2 Mostly aligned — minor reinforcement

| Surface | Issue | Action |
|---|---|---|
| `aiWorkbench.safeguardsDescription` ("We don't believe AI should make decisions for workers. These tools assist — you decide.") | Already correct stance. | Keep. |
| `aiWorkbench.safe1/2/3` (Entitlement-Controlled / Transparent Reasoning / Budget-Governed) | Already aligned. | Keep. |

### 2.3 SaaS drift — primary edit targets

| Surface | Current (drift) | Reframed (overlay) |
|---|---|---|
| `payPage.pricing.planTitle` | "Pro Plan" | "Pro Plan" *(retain — billing identifier)* |
| `payPage.pricing.planDescription` | "Everything your union needs to manage grievances, members & advocacy." | "Continuity-grade representation, institutional memory, and reviewer-assisted intelligence for your union." |
| `payPage.benefits.aiTriage` | "AI-powered case triage & drafting" | "Reviewer-assisted case triage and drafting" |
| `payPage.benefits.aiCredits` | "1,000 AI credits per billing cycle" | "Governed AI capacity included each billing cycle" |
| `payPage.benefits.teamCollaboration` | "Multi-role team collaboration" | "Multi-role representation continuity" |
| `billing.upgradePlan.benefit1` | "1,000 AI credits per billing cycle" | "Governed AI capacity each billing cycle" |
| `billing.upgradePlan.benefit2` | "AI-powered grievance triage & drafting" | "Reviewer-assisted grievance triage and drafting" |

### 2.4 AI/decisioning risk surfaces

| Surface | Current | Reframed |
|---|---|---|
| `aiWorkbench.cap1Desc` | "AI scores incoming grievances by priority…" | "Surfaces priority and complexity signals on incoming grievances, with suggested CBA clauses and precedents — every signal is reviewable and override-able by the representative." |
| `aiWorkbench.cap4Desc` | "Always reviewed and edited by representatives before use." | Keep (already aligned). |

### 2.5 Trust / governance reframing

| Surface | Current | Reframed |
|---|---|---|
| `trust.entitlementTitle` | "Entitlement-Based Feature Control" | "Contract-Activated Capabilities" |
| `trust.entitlementDesc` | "Modules and capabilities are activated through the deployment contract. Nothing is on by default. Organization admins control what is available and to whom." | "Capabilities are activated through the institution's deployment contract. Nothing is on by default. Organization stewards govern what is available and to whom — every activation is recorded." |

### 2.6 Package metadata — additive opportunity

| Package | Current | Action |
|---|---|---|
| `packages/ue-cognition/package.json` | No `description` field. | Add: "Reviewer-assisted institutional reasoning primitives for UnionEyes — case-risk signals, workload continuity, engagement and precedent surfacing. Governance-safe; never autonomous." |
| `packages/ue-assistant/package.json` | No `description` field. | Add: "Role-aware representation assistant for UnionEyes — intent routing, governed knowledge access, and response-policy enforcement for human-led casework." |

Other packages (`zonga-monetization`, `workload-intelligence`, `intelligence`, `doctrine-enforcement`) are out of UE scope or already neutral; deferred to a later workstream.

### 2.7 Forbidden-vocabulary additions

Extend `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`:

**Hard-fail:**
- `AI-powered case triage`
- `AI-powered grievance triage`
- `AI-led decisioning`
- `governance automation`
- `behavioural optimization` / `behavioral optimization`
- `influence analysis`
- `organizer scoring`

**Warning:**
- `AI credits`
- `credits per billing cycle`

### 2.8 Protected identifiers (DO NOT change)

- `PlatformModuleKey` enum strings (`governance_suite`, `ai_advanced_insights`, etc.)
- Billing tier labels for Stripe ("Pro", "Pro Plan" as a product name)
- Package `name` fields, exports, version
- Module slugs in route paths

---

## 3. Risk assessment

| Risk | Mitigation |
|---|---|
| Breaking `PLATFORM_MODULE_DISPLAY` consumers | New fields are **optional** on the interface; existing callers continue to read `displayName`/`narrativeTagline`. |
| en-CA divergence | All en.json edits mirrored to en-CA.json in the same change. |
| Stripe checkout label drift | "Pro Plan" / "Upgrade to Pro" preserved verbatim. |
| Audit regression | New forbidden-vocabulary entries verified against en.json after copy edits to ensure 0 hard-fails. |

---

## 4. Acceptance criteria

- `pnpm narrative:audit` — Maturity ≥ 85, hard-fails = 0.
- `pnpm narrative:check --ci` — exit 0.
- `pnpm typecheck` — clean across union-eyes + ue-cognition + ue-assistant.
- All edits additive or replacement-only; no identifier renames.
