# Workstream I — Ontology Reconciliation & Institutional Semantic Governance
## Implementation Report

**Status:** Complete (validation gates passing)
**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Scope:** Additive, disciplined, explainable. No automation / analytics / protected-exposure drift.

---

## 1. Outcome summary

| Gate | Result |
|---|---|
| `@nzila/institutional-governance-graph` tests | **160 / 160 passing** (10 files) |
| `union-eyes narrative:audit` hard-fail | **0** |
| `union-eyes narrative:check --ci` hard-fail | **0** |
| `pnpm typecheck` | **224 / 224 successful** |

No protected projection drift. No new analytics or surveillance surface introduced.

---

## 2. Three-tier doctrine (canonicalisation)

The reconciled ontology now expresses a single coherent doctrine in
`packages/institutional-governance-graph/src/ontology/canonicalization.ts`:

### Tier 1 — Absolute deny-list (`ABSOLUTE_DENY_LIST`)
Frozen union of:
- `IGG_PROTECTED_ENTITY_KINDS` (`protected.ts`) — Class-B special voting share, reserved matter
- `RESERVED_MATTER_TYPES`
- `CLASS_B_VOTING_SCOPES`
- `IGG_PROTECTED_RELATIONSHIP_KINDS`
- **`IggEntityKinds.UMRC`** (gap-fill — see §4)

Promotion of any of these names to a public canonical surface is a hard error
(`assertCanonicalizationAllowed` throws).

### Tier 2 — Forbidden semantic shape (`FORBIDDEN_SEMANTIC_TOKENS`)
~30 lower-case tokens describing shapes the platform will not adopt regardless
of namespace: `score`, `rank`, `weight`/`weighted`/`weighting`, `ratio`,
`average`, `efficiency`, `stability`, `topology`, `surveillance`,
`command-system`, `governance-ai`, `institutional-scoring`, etc.

Multi-word tokens (those containing `-`) are matched against the hyphen-joined
atom form; single-word tokens require **exact membership in the atom set**
produced by `tokenize(name)`.

### Tier 3 — Hold-for-demand (`HOLD_FOR_DEMAND`)
~28 IGG-namespaced kinds that are *not* denied but require an explicit substrate
proposal before promotion. `classifyCanonicalizationProposal` returns a
`hold-for-demand` verdict so promotion tooling can surface the requirement
rather than allowing silent promotions.

---

## 3. Token-shape precision: substring → word-atom matching

**Problem.** The original `hasForbiddenSemanticShape` matched forbidden tokens
via raw substring search. This produced false positives such as flagging
`Federation` (a legitimate hold-for-demand kind) because the substring `ratio`
appears inside `fede`**`ratio`**`n`.

**Fix.** Introduced a `tokenize(name)` helper that:

1. Inserts a space at every camelCase / PascalCase boundary
   (`/([a-z0-9])([A-Z])/`, `/([A-Z])([A-Z][a-z])/`).
2. Lower-cases.
3. Splits on whitespace, hyphen, and underscore.
4. Filters empty atoms.

`hasForbiddenSemanticShape` now operates on this atom set:

- Single-word tokens require **exact set membership** — no more accidental
  substring collisions.
- Multi-word tokens (e.g. `command-system`, `governance-ai`,
  `institutional-scoring`) match against the hyphen-joined atom form, which
  preserves the original intent.

**Doctrinal effect.** Forbidden shapes remain rejected
(`WeightedDecision` → matches `weighted`; `EfficiencyRating` → matches
`efficiency`; `TopologyAnalytics` → matches `topology`), while legitimate
governance vocabulary (`Federation`, `Committee`, `BargainingUnit`) is no
longer caught by orthographic accident.

---

## 4. UMRC gap-fill

`protected.ts` currently defines `IGG_PROTECTED_ENTITY_KINDS = [CLASS_B_SPECIAL_VOTING_SHARE, RESERVED_MATTER]`.
UMRC (Union Member Representation Certificate) is structurally protected but is
**not** included in that constant.

Rather than mutate `protected.ts` in this workstream (which is owned by the
projection-fence subsystem), Workstream I promotes UMRC into the
canonicalisation deny-list directly:

```ts
const ABSOLUTE_DENY_LIST = Object.freeze([
  ...IGG_PROTECTED_ENTITY_KINDS,
  ...RESERVED_MATTER_TYPES,
  ...CLASS_B_VOTING_SCOPES,
  ...IGG_PROTECTED_RELATIONSHIP_KINDS,
  IggEntityKinds.UMRC, // gap-fill
])
```

A dedicated test (`UMRC is never hold-for-demand …`) locks this in.

**Recommended follow-up RFC.** Add `UMRC` to
`IGG_PROTECTED_ENTITY_KINDS` in `protected.ts` proper, so the projection fence
also enforces it. Tracked separately to keep this workstream additive.

---

## 5. Marketing vocabulary alignment

### Forbidden vocabulary additions
`apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts` —
new `wsiInstitutionalGovernance` group with hard-fail entries:

- `organizational intelligence`
- `topology analytics`
- `governance AI`
- `governance command system(s)`
- `institutional surveillance`
- `command system` (with documented exceptions)

### Required vocabulary additions
`apps/union-eyes/tooling/marketing/config/required-vocabulary.ts` —
appended to `OBSERVABILITY_DOCTRINE_REQUIRED`:

- `institutional continuity` (weight 2)
- `governance-safe visibility` (weight 3)
- `continuity-aware structures` (weight 2)

### Page fix
`apps/union-eyes/app/[locale]/(marketing)/institutional-continuity/page.tsx` —
replaced one occurrence of `organizational intelligence` with
`continuity-aware structures` (the doctrinally aligned alternative).

---

## 6. Deferred promotions (reaffirmed)

The 5 + 3 prior-authorised promotions identified during the ontology audit
remain **DEFERRED**. None were promoted in this workstream. See the
classification matrix:

> `reports/governance-graph/ontology-classification-matrix.md`

and the upstream audit:

> `reports/governance-graph/workstream-i-ontology-reconciliation-audit.md`

for the full list and rationale.

---

## 7. Files changed

```
packages/institutional-governance-graph/src/ontology/canonicalization.ts
packages/institutional-governance-graph/src/ontology/canonicalization.test.ts
packages/institutional-governance-graph/src/index.ts
apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts
apps/union-eyes/tooling/marketing/config/required-vocabulary.ts
apps/union-eyes/app/[locale]/(marketing)/institutional-continuity/page.tsx
reports/governance-graph/workstream-i-ontology-reconciliation-audit.md
reports/governance-graph/ontology-classification-matrix.md
reports/governance-graph/workstream-i-implementation-report.md   ← this file
```

---

## 8. Validation evidence

```
$ pnpm --filter @nzila/institutional-governance-graph test
 Test Files  10 passed (10)
      Tests  160 passed (160)

$ pnpm --filter @nzila/union-eyes narrative:audit
Hard-fail violations : 0

$ pnpm --filter @nzila/union-eyes narrative:check --ci
Hard-fail violations : 0

$ pnpm typecheck
 Tasks:    224 successful, 224 total
```
