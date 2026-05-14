# Workstream J — Trust & Procurement Runtime Convergence
## Implementation Report

**Status:** Complete (validation gates passing)
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Scope:** Strictly additive copy / framing convergence. **No** behaviour, schema,
RBAC, tenancy, deployment-model, onboarding-flow, procurement-system, or
evidence-schema changes.

---

## 1. Outcome summary

| Gate | Result |
|---|---|
| `union-eyes narrative:audit` hard-fail | **0** |
| `union-eyes narrative:audit` maturity | **88 / 100** (avg) |
| Warnings (informational) | **227** (down from 229) |
| `pnpm typecheck` | **224 / 224 successful** |

No protected-governance metadata exposed. No flow / schema / RBAC mutation. The
federation-discovery API, sealed evidence-pack export, and admin onboarding
wizard remain byte-identical at the behaviour layer.

---

## 2. Convergence doctrine

WS J converges runtime / procurement / trust / onboarding / evidence surfaces
around a single coherent *coexistence-safe institutional deployment* posture.

The doctrine is enforced by:

- **`trustProcurementRuntime` forbidden-vocabulary group** (14 hard-fail terms)
  in `apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`.
- **`TRUST_PROCUREMENT_RUNTIME_REQUIRED` reward set** (12 terms) in
  `apps/union-eyes/tooling/marketing/config/required-vocabulary.ts`.
- **Additive copy reframes** across the procurement page, trust evidence-export
  admin component, admin onboarding wizard, and institutional-continuity
  marketing page.

### Forbidden additions (hard-fail)

`transformation platform`, `platform dominance`, `institutional monitoring`,
`centralized control`, `command-and-control deployment`, `all-in-one replacement`,
`single-vendor lock-in`, `rip-and-replace deployment`, `vendor lock-in`
(with disclaimer exceptions), `AI-driven procurement`, `autonomous deployment`,
`autonomous onboarding`, `procurement automation`, `evidence automation`.

### Required additions (rewarded)

`coexistence`, `continuity safeguards`, `sovereignty-conscious deployment`,
`federation-aware operations`, `explainability`, `operational stewardship`,
`continuity-aware onboarding`, `governance-safe deployment`,
`institutional resilience`, `inspectable operational posture`,
`evidence provenance`, `chronology-linked trust`.

---

## 3. Surface-by-surface convergence

### Procurement page — `(marketing)/solutions/procurement/page.tsx`

- **Hero description.** Reframed from "practical, defensible path to selection;
  governance-ready controls; measurable outcomes" → "coexistence-oriented,
  sovereignty-conscious deployment path; clear scope, governance-safe deployment
  controls, federation-aware operations, and evidence provenance".
- **"Build confidence …" section.** Reframed header ("phased, governable
  deployment" → "coexistence-safe, governance-safe deployment") and body
  (added "continuity safeguards", "sovereignty-conscious deployment pacing",
  "federation-aware operations", "additive to existing institutional systems,
  never displacing them").
- **"Due diligence content …" section.** Reframed header ("in one operational
  package" → "as evidence provenance, not procurement theatre") and body
  (added "chronology-linked trust", "continuity-aware, governance-safe
  deployment decisions", "operational stewardship").

No data exports renamed. The `procurementEvidenceBinder`, `deploymentTimelines`,
`institutionalRolloutPathway`, `governanceModernizationJourney`,
`operationalMaturityPathway` consumers remain byte-identical.

### Evidence-export admin component — `components/admin/evidence-export.tsx`

- **CardDescription.** Augmented with "evidence provenance", "chronology-linked
  trust", "operational stewardship" — preserving the existing "watermarked,
  tamper-proofed, sealed" guarantees as factual claims.
- **Info badges.** Added two stewardship badges (`Evidence provenance`,
  `Chronology-linked trust`) alongside existing `Tamper-proof seal`,
  `Watermarked`, `Audit-logged`.

No behaviour change: the same POST `/api/admin/evidence/export` request, the
same status semantics, the same download flow.

### Admin onboarding wizard — `components/onboarding/admin-onboarding-wizard.tsx`

- **STEPS descriptions.** All 5 step descriptions reframed (titles unchanged
  for deterministic UI):
  - Overview: "Continuity-aware onboarding for inspectable operational posture"
  - Users: "Roles and permissions under operational stewardship"
  - Security: "Sovereignty-conscious deployment with continuity safeguards"
  - Integrations: "Federation-aware operations alongside existing systems"
  - Reporting: "Explainability-first reporting with chronology-linked trust"
- **Page header description.** Reframed to lead with "continuity-aware
  onboarding ... governance-safe deployment ... additive to existing
  institutional systems, under operational stewardship".

No flow change: the 5-step sequence, `AdminOnboardingData` shape, navigation,
skip/back/complete handlers, and `localStorage` persistence are byte-identical.

### Institutional-continuity page — `(marketing)/institutional-continuity/page.tsx`

- **L371 header.** Softened from "Operational transformation as a gradual
  pathway" → "Operational continuity as a gradual, governance-safe pathway".
  The substrate consumer (`organizationalTransformationPathway` from
  `lib/institutional-legitimacy.ts`) is **not renamed** — the export remains
  a positive directional sequence (`Operational Fragmentation → Institutional
  Resilience`); only the framing copy is converged.

---

## 4. Protected procurement / runtime guards

WS J introduces **no new behaviour-level guard**. Protected governance metadata
(`Class B`, `golden share`, `reserved matter`, `OVERRIDES`, continuity-protection
internals, founder-control mechanics) remains hidden by:

- **`packages/institutional-governance-graph/src/governance/protected.ts`** —
  the doctrine fence at the substrate layer (`redactProtected`,
  `assertNoProtectedKindsInProjections`, `assertNoProtectedKindsInReadSurface`).
- **`canonicalization.ts` ABSOLUTE_DENY_LIST + FORBIDDEN_SEMANTIC_TOKENS** (WS I)
  — the ontology-promotion guard.
- **`founderOptics` forbidden-vocabulary group** — the marketing-copy guard.
- **`trustProcurementRuntime` forbidden-vocabulary group** (this workstream) —
  the procurement / runtime / onboarding / evidence convergence guard.

Procurement exports already serialize through the existing sealed-pack code
path (`/api/admin/evidence/export`), which is governed by the underlying
substrate fence. WS J does not bypass or extend this.

---

## 5. Narrative-CI vocabulary

### Forbidden (hard-fail, 14 new terms)

```ts
// trustProcurementRuntime — apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts
'transformation platform', 'platform dominance', 'institutional monitoring',
'centralized control', 'command-and-control deployment',
'all-in-one replacement', 'single-vendor lock-in', 'rip-and-replace deployment',
'vendor lock-in' (exceptions: 'avoids vendor lock-in', 'no vendor lock-in', 'without vendor lock-in'),
'AI-driven procurement', 'autonomous deployment', 'autonomous onboarding',
'procurement automation', 'evidence automation'
```

### Required (rewarded, 12 new terms)

```ts
// TRUST_PROCUREMENT_RUNTIME_REQUIRED — apps/union-eyes/tooling/marketing/config/required-vocabulary.ts
'coexistence' (w2), 'continuity safeguards' (w3),
'sovereignty-conscious deployment' (w3), 'federation-aware operations' (w3),
'explainability' (w2), 'operational stewardship' (w3),
'continuity-aware onboarding' (w3), 'governance-safe deployment' (w3),
'institutional resilience' (w2), 'inspectable operational posture' (w3),
'evidence provenance' (w3), 'chronology-linked trust' (w3)
```

The reward set is exported but not yet wired into a dedicated rule module.
Runtime / onboarding surfaces accrue maturity from these terms via the existing
`coexistence-positioning` and `labour-safe-ai` rule families that overlap on
"coexistence" / "explainability". A focused rule wiring is deferred to keep
this workstream additive.

### Glob coverage

`INTERNAL_NARRATIVE_GLOBS` in `tooling/marketing/narrative-audit.ts` is
**unchanged** in this workstream. Public marketing pages
(`(marketing)/solutions/procurement`, `(marketing)/trust`,
`(marketing)/institutional-continuity`) are already swept by
`PUBLIC_MARKETING_GLOBS`. Onboarding-wizard and evidence-export components are
intentionally **not** added to `INTERNAL_NARRATIVE_GLOBS` in this pass —
extending the glob to `components/onboarding/**` would surface a large back-log
of legacy SaaS / engagement-score wording in step bodies that requires a focused
follow-up workstream. The audit document captures this as deferred work.

---

## 6. Out-of-scope (deferred)

- Real federation-handshake protocol (only discovery endpoint exists today).
- Sovereignty-policy engine.
- Procurement-system integration with external e-procurement vendors.
- Onboarding-wizard flow / field / validation changes.
- Evidence-schema changes.
- Deployment-model rewrites.
- Bilingual copy lockstep (focused i18n pass).
- Wiring `TRUST_PROCUREMENT_RUNTIME_REQUIRED` into a dedicated rule module
  with weighted scoring.
- Extending `INTERNAL_NARRATIVE_GLOBS` to `components/onboarding/**` and
  `components/admin/evidence-export.tsx` (requires a focused legacy-copy pass
  to clear pre-existing back-log first).

---

## 7. Files changed

```
reports/narrative/workstream-j-trust-procurement-runtime-audit.md     (audit, prior commit)
apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts       (vocab, prior commit)
apps/union-eyes/tooling/marketing/config/required-vocabulary.ts        (vocab, prior commit)

apps/union-eyes/app/[locale]/(marketing)/solutions/procurement/page.tsx
apps/union-eyes/components/admin/evidence-export.tsx
apps/union-eyes/components/onboarding/admin-onboarding-wizard.tsx
apps/union-eyes/app/[locale]/(marketing)/institutional-continuity/page.tsx
reports/narrative/workstream-j-implementation-report.md   ← this file
```

---

## 8. Validation evidence

```
$ pnpm --filter @nzila/union-eyes narrative:audit
Hard-fail violations : 0
Warning violations   : 227   (down from 229)
Institutional Maturity (avg) : 88/100

$ pnpm typecheck
 Tasks:    224 successful, 224 total
```
