# Richard Sharpe Validation Protocol

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Role of Richard Sharpe:** treated as a **senior public-sector validator** —
> a deputy-minister-grade reviewer who must be able to defend OCI/OCRA in front of
> an auditor general, a regulator, and a public accounts committee.
> **Companion:** [GOVERNMENT_VALIDATION_REPORT_V1.md](./GOVERNMENT_VALIDATION_REPORT_V1.md)

---

## 1. Purpose of the protocol

Before OCI/OCRA is positioned for government procurement, its government-readiness
architecture must survive a structured, adversarial review by a senior
public-sector validator. This protocol defines **what Richard Sharpe is asked to
validate, how, and what a pass looks like.** It is deliberately adversarial: the
goal is to surface objections *before* a procurement evaluator does.

---

## 2. The eight validation objectives

| # | Objective | Validates | Source document |
| --- | --- | --- | --- |
| O1 | **Institutional-intelligence category language** | That "institutional continuity" framing is credible and non-overclaiming to a deputy minister | architecture decision |
| O2 | **Policy traceability chain** | That Evidence→Finding→Obligation→Dimension→Consequence→Recommendation reconstructs | traceability architecture |
| O3 | **Obligation taxonomy** | That the seven classes + hierarchy match how government actually reasons about duty | obligation taxonomy |
| O4 | **Confidence model** | That confidence is conservative, non-probabilistic, and evidence-fed | confidence architecture |
| O5 | **Explainability** | That every finding satisfies the seven-answer contract and is reconstructable | explainability model |
| O6 | **Procurement assumptions** | That the five-archetype readiness claims are honest, not optimistic | procurement assessment |
| O7 | **Pilot targets** | Which institutions are the right first pilots, and why | procurement + consequence |
| O8 | **Objection harvest** | The strongest objections a hostile auditor/regulator would raise | all |

---

## 3. Protocol structure

### 3.1 Pre-read pack

Sharpe receives the full blueprint set plus a one-page architecture summary and
the gap scorecard. He is explicitly told **what is frozen** (scoring core) and
**what is additive** (the government-readiness layer).

### 3.2 Session format (per objective)

For each objective O1–O8:

1. **Claim** — the blueprint's assertion, stated plainly.
2. **Challenge** — Sharpe attempts to break it with a public-sector scenario.
3. **Evidence** — the architecture's defense (which artifact/invariant answers it).
4. **Verdict** — `Validated` / `Validated-with-conditions` / `Not yet defensible`.
5. **Conditions** — what must be added/changed to clear a conditional verdict.

### 3.3 Scenario battery (illustrative challenges)

| Objective | Sharpe's scenario challenge |
| --- | --- |
| O1 | "Auditor general asks: is 'institutional continuity' just risk management rebranded?" |
| O2 | "Show me how finding X led to recommendation Y, with no hand-waving." |
| O3 | "A statutory and an operational obligation conflict — what does the report say?" |
| O4 | "You scored an institution on three interviews and no documents — what's your confidence and why should I trust it?" |
| O5 | "An MP asks why a department was flagged. Reconstruct it without an analyst in the room." |
| O6 | "You claim regulator-readiness — where's your inter-rater reliability evidence?" |
| O7 | "Which institution would you stake a pilot on, and what would make it fail?" |
| O8 | "Give me the three objections you're most afraid of." |

---

## 4. Pass criteria

- **O1, O2, O3, O5** must reach `Validated` or `Validated-with-conditions` to
  position for **Advisory / Crown Corporation** procurement.
- **O4** must reach `Validated` (confidence honesty is non-negotiable).
- **O6** is expected to be `Validated-with-conditions` (IRR roadmap), and that is
  acceptable provided the conditions are disclosed.
- **O7** must yield ≥2 concrete pilot candidates with named failure modes.
- **O8** must produce a written objection register with a mitigation for each.

A `Not yet defensible` verdict on O1–O5 **blocks** government positioning until
remediated.

---

## 5. Outputs

1. **Validation verdicts** (per objective) → recorded in the
   [validation report](./GOVERNMENT_VALIDATION_REPORT_V1.md).
2. **Conditions register** — the precise, ordered list of what must change.
3. **Objection register** — top objections + mitigations.
4. **Pilot recommendation** — ranked pilot candidates with failure modes.
5. **Go / conditional-go / no-go** recommendation per procurement archetype.

---

## 6. Reviewer independence & integrity

- Sharpe reviews **architecture and evidence**, not marketing.
- The frozen-core constraint is a **review boundary**: Sharpe may challenge the
  layer freely, but a recommendation to alter dimension/composite/maturity math
  requires a *compelling, written, architecture-level justification* (per the
  governing brief) — it is not a casual ask.
- All verdicts are recorded with rationale; conditional verdicts must name
  concrete, testable conditions.

> The Sharpe protocol exists so that the first hostile question OCI/OCRA faces in a
> public-sector room is one it has already answered — in writing, with evidence,
> and with a named condition where the answer is "not yet."
