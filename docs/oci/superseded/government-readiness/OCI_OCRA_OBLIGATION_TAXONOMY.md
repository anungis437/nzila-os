# OCI / OCRA Obligation Taxonomy

> **Status:** Blueprint — Architecture Review Only (no implementation)
> **Nature:** Reference data + reporting context. **Never a score input.**
> **Audience:** Regulators, governance professionals, legal/compliance reviewers, auditors

---

## 1. Why an obligation taxonomy

Government leaders and regulators do not act on a continuity score; they act on
**obligations**. A finding that "succession authority is undocumented" only
becomes decision-grade when it is tied to *which obligation it threatens* — a
statute, a regulation, a board policy, a fiduciary duty.

OCI/OCRA today has **no formal obligation model.** This document defines the
canonical one. It is the connective layer between continuity findings and the
accountability language public-sector institutions are governed by.

**Constitutional constraint:** the taxonomy classifies and contextualizes
findings. It **does not** weight, score, or alter any dimension or composite.
Two findings with identical evidence produce identical scores regardless of
obligation class; the obligation class changes only *reporting, prioritization,
and consequence framing.*

---

## 2. The seven canonical obligation classes

| # | Class | Definition | Typical source | Breach character |
| --- | --- | --- | --- | --- |
| 1 | **Statutory** | Duties imposed by primary legislation | Acts, enabling statutes | Unlawful / ultra vires |
| 2 | **Regulatory** | Duties imposed by delegated regulation or a regulator | Regulations, directives, regulator orders | Non-compliance / sanction |
| 3 | **Policy** | Duties imposed by government/organizational policy | Treasury/board policy, mandate letters | Policy breach / audit finding |
| 4 | **Governance** | Duties arising from the governance framework itself | Bylaws, terms of reference, delegation instruments | Governance failure |
| 5 | **Fiduciary** | Duties of loyalty, prudence, care owed to the institution/public | Trust law, public-trust doctrine | Breach of trust |
| 6 | **Continuity** | Duties to preserve institutional function across disruption/transition | BCM mandates, COOP requirements, ISO 22301 alignment | Continuity failure |
| 7 | **Operational** | Duties to maintain day-to-day operational integrity | SOPs, service standards, operational directives | Service degradation |

### 2.1 Class properties (reference fields)

Each obligation class carries (as reference data only):

- `obligationClassId` (stable)
- `tier` (see §3)
- `evidenceFloor` — minimum evidence level before a finding may assert this class
  (e.g., Statutory floor = `DOCUMENTED`; you do not allege a statutory breach on
  `VERBAL` evidence)
- `consequenceAffinity` — which consequence classes this obligation most often
  drives ([consequence model](OCI_OCRA_CONSEQUENCE_MODEL.md))
- `reportingPriorityWeight` — **report ordering only**, explicitly *not* a score
  weight

---

## 3. Obligation hierarchy

Obligations are not flat; breaches at higher tiers dominate reporting and
consequence framing.

```
 Tier 1  Statutory          ── highest accountability gravity
 Tier 2  Regulatory
 Tier 3  Fiduciary          ── public-trust duties
 Tier 4  Governance
 Tier 5  Policy
 Tier 6  Continuity
 Tier 7  Operational        ── lowest accountability gravity (highest frequency)
```

**Interpretation rule:** tier governs **reporting precedence and escalation
language**, never numeric weighting. A Tier-1 statutory finding is *surfaced
first and framed most gravely*; it does not subtract more points (it subtracts
none — points come only from the frozen scoring core).

---

## 4. Relationships between obligation classes

A single finding frequently implicates multiple classes. The taxonomy models
three relationship types:

### 4.1 Containment (a → implies → b)

- A **Statutory** continuity duty *contains* a **Continuity** obligation.
- A **Regulatory** records-retention duty *contains* an **Operational**
  record-keeping obligation.
- Containment means: asserting the parent automatically asserts the child for
  reporting completeness.

### 4.2 Reinforcement (a ↔ b, mutually strengthening)

- **Fiduciary** + **Governance** reinforce on succession/delegation findings.
- **Policy** + **Continuity** reinforce on COOP/BCM findings.
- Reinforcement raises reporting precedence to the higher of the two tiers.

### 4.3 Tension / Conflict (a ✕ b)

- **Operational** efficiency vs **Statutory/Regulatory** compliance (a control
  removed "to move faster" may breach a statutory control duty).
- **Policy** autonomy vs **Regulatory** mandate (local policy that under-delivers
  a regulator's floor).
- Conflicts are **reported, not silently resolved.** The taxonomy records the
  tension and escalates to the higher tier for framing, while explicitly naming
  the trade-off for the reviewer.

---

## 5. Conflict-resolution rules (reporting only)

When a finding maps to conflicting obligations:

1. **Higher tier wins framing.** The report leads with the higher-tier obligation.
2. **Conflict is named, never hidden.** Both obligations appear; the tension is
   stated in plain language.
3. **No numeric arbitration.** Because obligations never feed the score, conflict
   resolution is purely a *narrative/precedence* decision — there is nothing to
   "net out."
4. **Reviewer override is recorded.** A human reviewer may re-prioritize for a
   specific institution; the override and rationale are persisted (audit trail),
   but the underlying mapping and scores are unchanged.

---

## 6. Mapping strategy: findings → obligations

Mapping is **deterministic and table-driven**, not inferred per assessment.

### 6.1 Mapping inputs

- The Finding's contributing `questionId`s and section.
- The Finding's evidence level (gates which obligation classes are admissible via
  `evidenceFloor`).
- The institution's declared context (sector/governance model) — used **only** to
  select *which obligation catalogue* applies (e.g., a crown corporation's
  statutory catalogue differs from a municipality's), **never** to change scores.

### 6.2 Mapping table (illustrative, not exhaustive)

| Finding theme | Default obligation classes | Evidence floor to assert top class |
| --- | --- | --- |
| Undocumented succession authority | Governance, Fiduciary, Continuity | DOCUMENTED |
| Records/decision retention gaps | Regulatory, Statutory, Operational | DOCUMENTED |
| No delegation instrument | Governance, Statutory | DOCUMENTED |
| Single-point operational dependency | Continuity, Operational | VERBAL |
| No COOP / BCM plan | Continuity, Policy, (Regulatory if mandated) | DOCUMENTED |
| Board oversight gap | Governance, Fiduciary | DOCUMENTED |
| AI/automation without governance | Policy, Governance, Regulatory (emerging) | DOCUMENTED |

### 6.3 Sector catalogue selection

- The taxonomy is **universal**; the *catalogue of specific instruments* it points
  to is sector-scoped reference data (e.g., "this regulator's records regulation").
- This keeps the obligation **model** universal (no benchmark fork) while letting
  the **citations** be jurisdiction-appropriate.

---

## 7. Versioning & governance of the taxonomy

- The taxonomy is **versioned** (`obligationTaxonomyVersion`) and pinned on every
  traceability record so historical assessments remain interpretable.
- Changes require governance review (the obligation catalogue is legal-adjacent
  reference data).
- A **changelog** records added/retired instruments and re-mapping rationale.

---

## 8. What must NOT change

- Obligations are **never** score inputs. No obligation class adds or removes a
  single point from any dimension or composite.
- The five dimensions and maturity bands are untouched.
- Sector context selects *catalogues*, never *scores* — preserving the
  comparability invariant and benchmark integrity.

---

## 9. Executive framing

> The obligation taxonomy is how OCI/OCRA speaks the language of accountability.
> It takes a continuity finding — neutral, evidenced, deterministic — and names
> the duty it threatens: a statute, a regulation, a fiduciary trust. It does this
> **without ever touching the score**, so the assessment remains universal and
> benchmarkable, while becoming legible to the people who must answer for the
> institution.
