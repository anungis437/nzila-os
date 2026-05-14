# Workstream D — Implementation Report

**Module Descriptions, Package Metadata & Entitlement Semantic Alignment**

Date: 2026-05-12
Branch: `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
Scope: Display-layer institutional/continuity overlay. No identifier churn,
no schema changes, no permission rewires.

---

## 1. Objective

Bring runtime module catalogs, entitlement registries, package metadata,
AI-capability descriptions, and onboarding/upgrade copy into alignment with
the institutional taxonomy locked in Workstream C and the AI-posture
constraints reaffirmed across Workstreams B1–B5.

The outcome is a coherent **representation-institution narrative** at every
surface a buyer, regulator, reviewer, or auditor encounters — with no AI
framing that implies autonomous decisioning, surveillance, or worker
optimization.

---

## 2. Changes Delivered

### 2.1 Entitlement registry — semantic overlay

**File:** [apps/union-eyes/services/platform-economics/entitlement-guard.ts](../../apps/union-eyes/services/platform-economics/entitlement-guard.ts)

- `ModuleDisplay` type extended with three optional, additive fields:
  - `institutionalDescription` — institution-grade reframing of the module's
    role in continuity of representation.
  - `operationalDescription` — what reviewers / representatives actually do
    inside the module.
  - `aiSafetyDescription` — only present where the module exposes AI
    primitives; states the reviewer-assisted, governance-bound posture.
- All 18 module entries populated. The `ai_advanced_insights` module carries
  an explicit `aiSafetyDescription` reaffirming non-autonomy.
- No identifier, key, slug, route, or permission was modified.
- `pnpm typecheck` clean (224/224 packages).

### 2.2 Locale copy alignment

**Files:**
- [apps/union-eyes/messages/en.json](../../apps/union-eyes/messages/en.json)
- [apps/union-eyes/messages/en-CA.json](../../apps/union-eyes/messages/en-CA.json)

Aligned strings (both locales kept in lockstep):

| Key path                                | Reframe |
|------------------------------------------|---------|
| `trust.contractActivatedCapabilities.*`  | "Contract-Activated Capabilities" framing for entitlement-gated features |
| `payPage.benefits.aiTriage`              | "Reviewer-assisted case triage & drafting under entitlement governance" |
| `aiWorkbench.cap1Desc`                   | Softened to reviewer-assisted intake reasoning |
| `aiWorkbench.safeguardsDescription`      | "AI does not make decisions for workers. These tools assist reviewers — representatives decide." |
| `billing.upgradePlan.benefit2`           | "Reviewer-assisted grievance triage & drafting" |

All edits are display-string only. No translation key was renamed,
relocated, or removed.

### 2.3 Package metadata

Added institutional `description` fields to package manifests that were
missing them:

- [packages/ue-cognition/package.json](../../packages/ue-cognition/package.json):
  *"Reviewer-assisted institutional intelligence primitives — case-risk,
  workload, engagement, and precedent reasoning under entitlement
  governance. Surfaces signals for representative decision-making; never
  autonomous."*
- [packages/ue-assistant/package.json](../../packages/ue-assistant/package.json):
  *"Reviewer-led representation assistant — role-aware intents, governed
  knowledge access, and domain-bound response policy. Augments
  representatives within entitlement and audit boundaries; never decides
  on behalf of workers."*

`packages/zonga-monetization`, `packages/intelligence`, and
`packages/workload-intelligence` already carried descriptions consistent
with the doctrine; left untouched per additive-only principle.

### 2.4 Forbidden vocabulary — surveillance-AI extensions

**File:** [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](../../apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts)

New **hard-fail** entries (`surveillance-ai` category):

- `AI-powered case triage` → suggest *reviewer-assisted case triage under entitlement governance*
- `AI-powered grievance triage` → suggest *reviewer-assisted grievance triage*
- `AI-led decisioning` → suggest *reviewer-led decisions assisted by governed reasoning*
- `governance automation` → suggest *governance of record | governed reasoning*
- `behavioural optimization`
- `behavioral optimization`
- `influence analysis`
- `organizer scoring`

New **warning-level** entries (`warning` category):

- `AI credits`
- `credits per billing cycle`

These additions tighten the surveillance-AI surface and discourage
consumer-SaaS AI-credit framing.

---

## 3. Validation

| Gate                       | Result |
|----------------------------|--------|
| `pnpm narrative:audit`     | Files scanned: **88** · Hard-fail: **0** · Warnings: **219** · Maturity: **85/100** |
| `pnpm narrative:check --ci`| Hard-fail: **0** · Maturity ≥ 85 |
| `pnpm typecheck`           | **224/224 packages successful** |

Warning delta (213 → 219) reflects the two new warning-tier vocabulary
entries surfacing prior copy that was already on the watchlist; no new
hard-fails were introduced by the stricter surveillance-AI rules because
the AI-copy reframes in §2.2 landed first.

---

## 4. Doctrine Compliance

- **Additive-only:** every change is a new field, a new vocabulary entry,
  or a string re-render. No identifier or schema mutation.
- **AI posture preserved:** every AI-adjacent surface now states or implies
  reviewer-assistance, governance boundaries, and human decision authority.
- **Taxonomy locked from Workstream C** is honored across module displays
  and entitlement copy.
- **Founder-optics neutrality** unchanged — no founder-control framing
  introduced or removed.

---

## 5. Out of Scope (Confirmed)

- No changes to `apps/union-eyes/lib/auth/*`, route handlers, RBAC, or
  Drizzle schema.
- No edits to `packages/zonga-monetization`, `packages/intelligence`,
  `packages/workload-intelligence` (descriptions already aligned).
- No edits to non-union-eyes apps; the narrative-audit CLI scans
  `apps/union-eyes` only and that scope is preserved here.

