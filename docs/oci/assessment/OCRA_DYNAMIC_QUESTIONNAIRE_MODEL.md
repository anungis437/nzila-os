# OCRA Dynamic Questionnaire Model

**Doctrine version:** 1.0.0
**Companion to:** `OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md`
**Scope:** The runtime model that turns a respondent's institutional profile
into a routed question bank, scored interpretation, and facilitator guidance.

---

## 1. Model overview

```
            ┌───────────────────────────┐
            │  Org-context form inputs  │
            │  (ctx_* fields, fixed)    │
            └─────────────┬─────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │  orgContextClassifier               │
        │  → InstitutionalAssessmentProfile   │
        └─────────────┬───────────────────────┘
                      │
       ┌──────────────┼──────────────────────────┐
       ▼              ▼                          ▼
┌──────────────┐ ┌────────────────────┐  ┌──────────────────┐
│ Routing      │ │ Adaptive scoring   │  │ Narrative engine │
│ engine       │ │ (interpretation)   │  │ + facilitator    │
└──────┬───────┘ └─────────┬──────────┘  │ guidance         │
       │                   │             └────────┬─────────┘
       ▼                   ▼                      ▼
   RoutedBank      ContextualResult        Adaptive prose
       │                   │                      │
       └──────────┬────────┴──────────────────────┘
                  ▼
       Product 2 / 3 / 4 / 5 handoff adapters
```

Every arrow above is deterministic. Same inputs → same outputs, always.

---

## 2. The InstitutionalAssessmentProfile

```ts
interface InstitutionalAssessmentProfile {
  /** Doctrine version that produced this profile. */
  doctrineVersion: '1.0.0';

  /** Coarse-grained scale band. */
  institutionalScale:
    | 'micro'
    | 'small'
    | 'mid_sized'
    | 'large'
    | 'enterprise'
    | 'federated_complex';

  /** How structurally complex continuity is for this institution. */
  continuityComplexity:
    | 'low'
    | 'moderate'
    | 'elevated'
    | 'high'
    | 'institutional';

  /** How layered governance is. */
  governanceComplexity:
    | 'simple'
    | 'structured'
    | 'multi_layer'
    | 'federated'
    | 'public_accountability';

  /** What surface the institution must keep continuous. */
  continuityExposure:
    | 'localized'
    | 'cross_functional'
    | 'multi_site'
    | 'public_trust'
    | 'mission_critical';

  /** Lens the respondent brings to the assessment. */
  respondentLens:
    | 'inside_operator'
    | 'senior_decision_maker'
    | 'board_governance'
    | 'external_advisor'
    | 'legal_or_counsel'
    | 'unknown';

  /** Rationale entries — one per profile field that was determined. */
  rationale: ProfileRationale[];
}
```

Every field has a finite, exhaustive enum. The system refuses unknown values
and falls back to the conservative default for any dimension it cannot
determine.

---

## 3. Classification rules (deterministic)

### 3.1 `institutionalScale`

Derived from `workforceBand`:

| `workforceBand` | `institutionalScale` |
| --------------- | -------------------- |
| `under_50`      | `micro` or `small` (see §3.1.1) |
| `50_249`        | `small`              |
| `250_999`       | `mid_sized`          |
| `1000_4999`     | `large`              |
| `5000_plus`     | `enterprise`         |

#### 3.1.1 Federated override

If `federationAffiliation` is set **and** `workforceBand >= 250_999`, scale is
promoted to `federated_complex` regardless of the table above. A federation
that aggregates many small locals reads as `federated_complex` if its total
declared size crosses the mid-sized threshold.

### 3.2 `continuityComplexity`

Derived from a combination of `institutionalScale` and `organizationAge`:

- `micro` + age `<5_years` → `low`
- `micro` or `small` + age `5_to_14_years` → `moderate`
- `mid_sized` → `elevated`
- `large` or `enterprise` → `high`
- `federated_complex` → `institutional`

### 3.3 `governanceComplexity`

- `governanceModel === 'elected_board'` + small/micro → `structured`
- `governanceModel === 'elected_board'` + mid_sized+ → `multi_layer`
- `governanceModel === 'appointed_board'` → `public_accountability`
- `federationAffiliation` set → `federated`
- Anything else with no recognized governance → `simple`

### 3.4 `continuityExposure`

Derived from `sector`:

- `healthcare` / `social_services` → `mission_critical`
- `public_sector` / `government` → `public_trust`
- `education` → `public_trust`
- `labour_union` / `nonprofit` → `cross_functional`
- Otherwise → `localized`

### 3.5 `respondentLens`

Direct map from `respondentRole`:

| `respondentRole`        | `respondentLens`           |
| ----------------------- | -------------------------- |
| `self_senior_leader`    | `senior_decision_maker`    |
| `self_board_member`     | `board_governance`         |
| `self_staff`            | `inside_operator`          |
| `on_behalf_consultant`  | `external_advisor`         |
| `on_behalf_counsel`     | `legal_or_counsel`         |
| `on_behalf_other`       | `external_advisor`         |
| (missing)               | `unknown`                  |

---

## 4. Routing model (Part 3 — referenced)

Every question declares `adaptiveRules` describing for which profiles it is
required, recommended, suppressed, or scoped by sector / size / governance /
respondent. The routing engine resolves these against the profile and emits a
`RoutedQuestionBank` with:

- `includedQuestions` — what the respondent will see.
- `deferredQuestions` — questions held back, each annotated with the rule
  that held it back.
- `requiredQuestions` — the inviolable core (subset of `includedQuestions`).
- `optionalContextQuestions` — non-core but relevant.
- `routingRationale` — one entry per inclusion or deferral decision.

The engine **refuses to route** if the resulting included set falls below the
minimum-meaningful threshold (default: 18 scored questions). In that case it
returns the full bank with a `routing_failure_safe_default` rationale.

---

## 5. Scoring interpretation model (Part 5 — referenced)

The scoring engine continues to produce a raw `InstitutionalContinuityProfile`.
On top of that, the adaptive layer produces a `ContextualAssessmentResult`:

```ts
interface ContextualAssessmentResult {
  rawProfile: InstitutionalContinuityProfile;
  contextualEmphasis: DomainEmphasis[];
  normalizedInterpretation: NormalizedInterpretation;
  scaleAdjustedWarnings: ContinuityWarning[];
  adaptationRationale: AdaptationRationale[];
}
```

`contextualEmphasis` adjusts *which dimensions the narrative leans into*, not
the dimension scores themselves. `scaleAdjustedWarnings` filter out warnings
that are inappropriate for the institutional scale (e.g. a "lack of
multi-region runtime governance" warning is suppressed for `micro` orgs).

---

## 6. Narrative model (Part 6 — referenced)

The narrative engine receives the `ContextualAssessmentResult` and the
`InstitutionalAssessmentProfile` and selects:

- Section openers from a fixed library keyed by `institutionalScale` and
  `governanceComplexity`.
- Dimension framings keyed by `continuityExposure`.
- Respondent caveats keyed by `respondentLens`.

The library lives in `lib/icra-pdf/adaptive-passages.ts` (new). Every passage
has both `en-CA` and `fr-CA` strings and a doctrine-version tag.

---

## 7. Handoff model (Parts 8–10 — referenced)

| Product   | Adapter                                       | Receives                                                                 |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Product 2 | `ocraAdaptiveHandoff.ts`                      | profile + emphasis + structural signals + confidence + archetypes        |
| Product 3 | `ocraToStabilizationAdapter.ts`               | stabilization-relevance flags, recommended first workflow, cautions      |
| Product 4 | `ocraRuntimeSignalAdapter.ts`                 | runtime-readiness implications, continuity event seeds                   |
| Product 5 | `ocraIntelligenceSignalAdapter.ts`            | sector / size baselines, archetype contribution, signal quality          |

No adapter conveys org name, free text, IP, or any data that could
re-identify an institution.

---

## 8. Telemetry model (Part 13 — referenced)

Three new telemetry kinds:

- `assessment_routed` — emitted once per assessment after routing.
  Metadata: `{ scale, complexity, governance, exposure, lens, includedCount, deferredCount, routeVersion, locale }`.
- `adaptive_question_deferred` — emitted once per deferred question.
  Metadata: `{ sectionId, ruleId, profileScale, profileGovernance }`.
- `adaptive_profile_created` — emitted once per profile creation.
  Metadata: `{ scale, complexity, governance, exposure, lens, locale }`.

No metadata value carries free text, org name, or any value that identifies a
specific assessment beyond its profile band.

---

## 9. Versioning and replay

Every `RoutedQuestionBank` records:

- `routeVersion` — incremented when routing rules change.
- `doctrineVersion` — matched against the doctrine document.
- `bankVersion` — already present on every answer record.

This trio lets us re-route any past assessment for audit, even after the
routing rules evolve.

---

## 10. Refuse-rather-than-guess invariants

The model refuses (and falls back to conservative defaults) when:

- An input is missing.
- A rule produces an enum value not in the declared union.
- The included question count falls below the minimum-meaningful threshold.
- Any profile field cannot be resolved.

Refusal is observable: it produces a `routing_failure_safe_default` or
`profile_partial_safe_default` rationale, never a silent fallback.

---

*OCRA adapts deterministically, transparently, and conservatively. The model
is small enough to reason about by hand, which is the only acceptable
property for an institutional sensing instrument.*
