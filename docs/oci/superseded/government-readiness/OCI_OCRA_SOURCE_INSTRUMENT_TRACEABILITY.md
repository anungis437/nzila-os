# OCI / OCRA Source Instrument Traceability (Phase G)

> **Status:** Implemented — additive, read-only layer over the frozen core.
> **Audience:** Deputy ministers, Crown corporation executives, Auditors General,
> procurement evaluators, and the external validator (Richard Sharpe).
> **Companion to:** [Policy Traceability Architecture](OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md),
> [Obligation Taxonomy](OCI_OCRA_OBLIGATION_TAXONOMY.md),
> [Security & Data-Handling Brief](SECURITY_AND_DATA_HANDLING_BRIEF.md).
> **Doctrine version:** 1.1.0 · **Catalogue version:** `0.2.0-unverified`
>
> **v1.1.0 (Gap 1 + Gap 4):** adds the reference-only `authorityLevel` and
> `effectiveDate` fields to every instrument and citation, and a dedicated
> **catalogue governance** module (lifecycle, versioning, jurisdiction selection,
> conflict handling) answering *"who decides which legislation counts?"*

---

## 0. Why this phase exists

A deputy minister or Auditor General does not ask *"is governance weak?"* They ask:

> **Which** policy? **Which** legislation? **Which** Treasury Board requirement?
> **Which** directive? **Which** standard? — *and can you defend the citation?*

Phase G extends the traceability chain one decisive step, from an abstract
obligation **class** to the **specific instrument** that creates the duty:

```
Evidence → Finding → Obligation class → Source Instrument → Citation → Consequence → Recommendation
```

This is the difference between *"this is an interesting assessment"* and
*"this is something a public institution can defend."*

---

## 1. The non-negotiable safety posture

Naming statutes and policies is high-risk: a wrong citation is worse than no
citation. Phase G is therefore built so the system **cannot assert law it has not
earned the right to assert**. Three structural guarantees:

1. **Reference data only.** The source-instrument modules never import the
   scoring engine and can never influence a dimension, composite, or maturity
   band. (Enforced by `source-instrument-traceability.test.ts`.)
2. **The seed catalogue is wholly `UNVERIFIED`.** Every seeded instrument carries
   `verificationStatus: 'UNVERIFIED'` and an **empty clause reference**
   (`clauseRef: null`). The system fabricates no section numbers.
3. **Two independent gates before a citation is defensible.** A citation becomes
   `defensible` only when **both** hold:
   - the finding's **evidence** meets the instrument kind's **assertion floor**, and
   - the instrument has been **independently verified** (`verificationStatus ≥
     VALIDATOR_CONFIRMED`).

   Because the seed is entirely `UNVERIFIED`, **no citation is currently
   defensible** — honestly, and by design, for the validation session.

---

## 2. The data model

### 2.1 Source Instrument

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier (e.g. `si.tb_policy_service_digital`) |
| `kind` | `statute` · `regulation` · `treasury_board_instrument` · `directive` · `policy` · `standard` · `mandate` · `bylaw` |
| `jurisdiction` | `federal` · `provincial` · `municipal` · `sector_standard` · `institutional` · `unspecified` (low-cardinality band, never a place identifier) |
| `title` | Publicly-known instrument name **or** a generic placeholder |
| `authorityLevel` | Legal force (**how binding**), independent of kind: `primary_legislation` · `subordinate_legislation` · `binding_executive_policy` · `binding_institutional` · `advisory_standard` |
| `issuingAuthority` | Who issues it |
| `obligationClass` | Which of the seven obligation classes it sources |
| `clauseRef` | Specific section — **`null` in the seed** (filled only on validation) |
| `effectiveDate` | In-force date (ISO-8601) — **`null` in the seed** (never fabricated; supplied on validation) |
| `verificationStatus` | `UNVERIFIED` → `VALIDATOR_CONFIRMED` → `AUTHORITATIVE` |
| `note` | Reviewer-facing note: why it is a candidate and what to confirm |

**`authorityLevel`** is the *how-binding* axis, distinct from `kind` (what the
instrument is) and `jurisdiction` (whose it is). It lets a reviewer weigh a
citation's gravity — and, critically, it is what the catalogue uses to **lead a
conflict by authority** (§10). It is reference data only and never touches a
score. **`effectiveDate`** is carried so a reviewer can see currency/temporal
applicability; like `clauseRef` it is never invented — `null` until a validator
supplies it.

### 2.2 Citation (the gated assertion)

A `Citation` is the output of applying a finding's evidence to a candidate
instrument:

| Field | Meaning |
| --- | --- |
| `assertion` | `asserted` · `referenced` · `withheld` |
| `defensible` | `asserted` **and** instrument verified (always `false` for the UNVERIFIED seed) |
| `rationale` | One-line, auditor-facing reason for the assertion level |
| `clauseRef`, `verificationStatus`, `kind`, `title`, `obligationClass` | Carried through from the instrument |

---

## 3. The evidence-threshold gate (answers Validation Question 3)

> *At what evidence threshold should OCI/OCRA be allowed to reference a statute,
> policy, directive, or mandate letter?*

Per instrument kind, the **assertion floor** is the evidence level at which a
citation may move from `referenced` (named, flagged) to `asserted` (presented as
applicable):

| Instrument kind | Assertion floor | Rationale |
| --- | --- | --- |
| `statute` | **VERIFIED** | You do not assert primary legislation applies without verified evidence |
| `regulation` | **VERIFIED** | Same bar as statute |
| `treasury_board_instrument` | DOCUMENTED | Documentary evidence of the practice gap |
| `directive` | DOCUMENTED | — |
| `policy` | DOCUMENTED | — |
| `standard` | DOCUMENTED | Adoption/applicability must be documented |
| `mandate` | DOCUMENTED | — |
| `bylaw` | DOCUMENTED | — |

Below the floor the instrument is still surfaced as **`referenced`** (so the
reviewer sees the candidate source) but explicitly **not asserted**. With
`NONE` evidence the citation is **`withheld`** entirely.

---

## 4. Assertion levels

| Level | Meaning | When |
| --- | --- | --- |
| **asserted** | Presented as an applicable source | evidence ≥ assertion floor |
| **referenced** | Named as a candidate, flagged as not yet evidence-supported | evidence present but below floor |
| **withheld** | Not surfaced | no admissible evidence (`NONE`) |

This three-level design lets a report say, honestly: *"Governance obligation —
candidate source: institutional bylaws (referenced; evidence not yet sufficient
to assert)."* — never overclaiming.

---

## 5. Chain-integrity invariant added

The `TraceabilityRecord` gains one Phase G integrity flag, folded into `intact`:

- **`everyAssertedCitationMeetsEvidenceFloor`** — no citation presented as
  `asserted` clears below its instrument kind's evidence floor (e.g. a statute is
  never asserted on less than VERIFIED). Vacuously true when nothing is asserted.

A report may still only render findings when `chainIntegrity.intact === true`.

The record also now carries `findingCitations` (the per-finding citation
projection) and `sourceInstrumentCatalogueVersion` for audit reproducibility.

---

## 6. What is built (files)

| File | Role |
| --- | --- |
| `lib/icra/obligations/sourceInstruments.ts` | Taxonomy, UNVERIFIED catalogue, `authorityLevel`/`effectiveDate`, assertion-floor gating, `buildCitation` |
| `lib/icra/obligations/sourceInstrumentMapping.ts` | Obligation class → candidate citations (`mapObligationsToCitations`); scoring-isolated |
| `lib/icra/obligations/sourceInstrumentCatalogueGovernance.ts` | Catalogue lifecycle, versioning, jurisdiction selection, conflict handling (Gap 4); scoring-isolated |
| `lib/icra/traceability/traceabilityRecord.ts` | Extended with `findingCitations` + the evidence-floor invariant |
| `lib/icra/__tests__/government-readiness/source-instrument-traceability.test.ts` | Phase G non-regression suite (10 tests) |
| `lib/icra/__tests__/government-readiness/source-instrument-authority.test.ts` | Gap 1 authority/effective-date suite |
| `lib/icra/__tests__/government-readiness/catalogue-governance.test.ts` | Gap 4 catalogue-governance suite |

All deterministic, pure, PII-free, and read-only over the frozen scoring core.

---

## 6a. Catalogue governance (Gap 4 — "who decides which legislation counts?")

Once OCI/OCRA names a *specific* instrument, the unavoidable governance question
is who curates that list and how the decision stays auditable. The
`sourceInstrumentCatalogueGovernance` module answers it as an explicit, testable
discipline rather than an editorial habit. It governs the five operations the
doctrine calls out:

1. **Adding** — a strict lifecycle state machine: `proposed → candidate →
   confirmed → superseded → retired`. Any move not on the allow-list is rejected.
2. **Retiring** — withdrawal is a *tracked transition*, never a delete; nothing is
   silently removed, so the audit trail is preserved.
3. **Versioning** — every amendment is role-gated, carries a non-empty rationale,
   names the **role** (never a person) that decided it, and **bumps the recorded
   catalogue version**.
4. **Jurisdiction selection** — `selectApplicableInstruments` returns the
   instruments applicable to a government tier (exact match plus always-applicable
   bands: sector standards, institutional, unspecified). Pure and order-preserving.
5. **Conflict handling** — when two instruments claim the same obligation class in
   the same jurisdiction, the conflict is **named** and **led by authority level**;
   a tie at the strongest authority **escalates to human arbitration** rather than
   auto-netting duties (consistent with the obligation doctrine's *"name it,
   don't net it"*).

| Concern | Rule |
| --- | --- |
| Who may amend | A `GovernanceRole` (`catalogue_steward` · `validator` · `legal_counsel` · `calibration_authority`); promotion/supersession require `validator` or `legal_counsel` |
| Lifecycle/verification drift | A `confirmed` entry may not remain `UNVERIFIED` (`verificationConsistentWith`) |
| Versioning | Each amendment bumps the minor version, preserving the `-unverified` pre-release suffix until cleared |
| Conflict resolution | Strongest `authorityLevel` leads; tie → `requiresHumanArbitration = true` |

No scoring import; decisions are attributed to roles, not people.

---

## 7. The seed catalogue (all UNVERIFIED — for validation, not assertion)

| id | kind | obligation class | title (label only) |
| --- | --- | --- | --- |
| `si.enabling_statute` | statute | statutory | Institution-specific enabling statute |
| `si.delegated_regulation` | regulation | regulatory | Applicable delegated regulation |
| `si.tb_policy_service_digital` | treasury_board_instrument | policy | Treasury Board Policy on Service and Digital |
| `si.records_retention_schedule` | directive | operational | Records management / retention directive |
| `si.governance_bylaws` | bylaw | governance | Institutional governance bylaws / delegation instrument |
| `si.fiduciary_duty_framework` | policy | fiduciary | Fiduciary duty / prudent administration framework |
| `si.iso_22301_continuity` | standard | continuity | ISO 22301 — Business Continuity Management Systems |

> **These are candidates, not citations.** Names are labels; clause references and
> effective dates are empty; the whole set is `UNVERIFIED`. Richard (or counsel)
> confirms, corrects, or replaces each entry, and only then may an instrument be
> promoted to `VALIDATOR_CONFIRMED` and a `clauseRef`/`effectiveDate` populated.

---

## 8. What Phase G does **not** claim

- It does **not** assert any specific clause of any specific law.
- It does **not** render any citation `defensible` (the seed is UNVERIFIED).
- It does **not** change any score (reference data only; scoring-isolated).
- It does **not** replace legal advice — it structures where legal advice plugs in.

---

## 9. The validation path

1. Richard reviews the obligation taxonomy and the candidate instruments.
2. For each confirmed instrument, he (or counsel) supplies the correct
   `clauseRef` and promotes `verificationStatus` to `VALIDATOR_CONFIRMED`.
3. Only then does a citation become `defensible` at and above its evidence floor.
4. The evidence-threshold table (§3) is itself a validation question — Richard
   may raise or lower a kind's floor.

See the five Phase G validation questions in the
[Richard Validation Packet](richard-packet/RICHARD_VALIDATION_PACKET.md).
