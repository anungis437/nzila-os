# CIVITAS Authority Model

Two different things are called authority. They are not interchangeable.

| Kind | Question it answers | Where it lives |
| --- | --- | --- |
| Decision / execution authority | Who may decide, approve, or execute | `@nzila/decision-core` `DecisionAuthority` |
| Legal / evidentiary authority | Which source supports a legal proposition | CIVITAS domain records composed with `EvidenceRef` |

CIVITAS execution authority is none: no deploy, merge, financial transaction, filing, or signing. CIVITAS is not counsel of record. No source, and no `DecisionAuthority` value, grants that power.

## DecisionAuthority semantic finding

`DecisionAuthority` is `{ required, granted, missing, valid }`. `enforceDecision` builds it by comparing a registry entry's `requiredAuthority` scopes with `authorityScope` or `actor.authorityScope`. `valid` is true only when every required scope was granted. A missing scope yields `AUTHORITY_SCOPE_MISSING`. A valid result can mark a registered decision outcome approved.

That is permission, delegation, and execution power. It does not identify a statute, a court, a citation, a jurisdiction, or a proposition. CIVITAS does not reuse it as the legal-source model, does not register a decision-core type, and does not call `enforceDecision` to approve a CIVITAS act. A valid `DecisionAuthority` whose granted scopes include deploy, filing, or signing still does not grant CIVITAS execution.

## What authority means for a legal proposition

Legal authority is metadata about a source and an explicit link from that source to a proposition. The substrate records what was supplied. It does not infer a relation from chronology, pick a winner, or compute stare decisis.

Source classes reuse the evidence tiers:

| Class | Tier | Effect |
| --- | --- | --- |
| Primary / binding material | 1 | May support a material proposition, still as an advisory record |
| Official interpretation | 2 | May support a material proposition, still as an advisory record |
| Persuasive professional | 3 | May support a material proposition, still as an advisory record |
| Discovery | 4 | Cannot independently establish a material proposition |

The class is not itself a ruling that the source binds a particular decision-maker. Weight is separate: `BINDING`, `PERSUASIVE`, `INTERPRETIVE`, or `DISCOVERY_ONLY`. There is no numeric score.

Identity fields are canonical id, title, issuing body, source class, official citation, and an evidence reference. Citation and dates stay null when they were not supplied.

## Propositions and evidence

A proposition is not a source. Links are many-to-many and carry an explicit relation: `SUPPORTS`, `CONTRADICTS`, `INTERPRETS`, `LIMITS`, `DISTINGUISHES`, `AMENDS`, `REPEALS`, `SUPERSEDES`, `AFFIRMS`, or `REVERSES`. Each link requires provenance. A date order does not create one of these relations.

Provenance is the existing decision-engine `EvidenceRef` (`type`, `ref_id`, optional `summary`). CIVITAS does not open a second evidence store and does not seal an evidence pack.

A factual predicate is separate from the rule. A predicate marked unknown stays unknown and is not copied into assumed facts.

## Jurisdiction

Implemented codes are the organization-jurisdiction forms `CA` and `CA-QC`. Silence does not fill `CA-QC`. A code on a source or proposition is retained as supplied.

Municipal, court, regulatory, foreign, and treaty jurisdiction are a ceiling. They are not a second vocabulary and they are not implemented.

Authority from one jurisdiction is not binding in another. Cross-jurisdiction binding returns `UNRESOLVED`.

Stare decisis is not automated. Court hierarchy is not resolved. Binding is `BINDING` only when the issuing court, the governed jurisdiction, and the decision-maker jurisdiction are all supplied, the jurisdictions are the same code, later effect is `NONE_RECORDED`, and binding on that decision-maker was supplied as true. Otherwise the result is `UNRESOLVED` or, when later effect is `OVERRULED` or binding was supplied as false, `NOT_BINDING` without selecting a replacement.

## Temporal validity and currentness

A verified current rule and a rule applicable on a date are different readings.

- `VERIFIED_CURRENT_RULE` requires legal status `CURRENT`, status provenance, and a last-verified date. A retrieval date is not that date.
- `APPLICABLE_ON_DATE` compares a supplied relevant date with a supplied effective date and, when present, a repeal or supersession date.
- A historical status (`AMENDED`, `REPEALED`, `SUPERSEDED`, `OVERRULED`, `PARTIALLY_OVERRULED`) is not presented as current.
- Unknown dates stay unknown. The substrate does not invent them. Applicability is `UNRESOLVED` when the relevant date or the effective date is missing.

Currentness is a contract: source version, date retrieved, date verified, status, evidence, and unresolved concerns. `provenCurrent` is true only for `CURRENT` with evidence, a verification date, and no unresolved concern. Absence of contrary evidence is not proof. A retrieval date is never copied into the verification date. A stale or historical status is never rewritten as current.

Legal status other than `UNKNOWN` is kept only with provenance. Missing status metadata becomes `UNKNOWN`, not `CURRENT`.

## Conflicts and claim state

A conflict is recorded when the same proposition has an explicit `SUPPORTS` or `AFFIRMS` link and an explicit `CONTRADICTS` or `REVERSES` link. Both sources stay. `winner` is null. Jurisdiction and temporal differences are surfaced when the stored values differ. Hierarchy difference is `UNRESOLVED`. Material uncertainty requires VERIFIER review. A professional-risk matter also keeps the professional gate. Neither the conflict record nor the gate means approval occurred.

Claim state, in order:

| State | When |
| --- | --- |
| `CONFLICTED` | Both sides are retained |
| `UNRESOLVED` | No tier 1–3 support, tier 4 alone, or an unknown factual predicate |
| `STALE_OR_CURRENTNESS_UNPROVEN` | Support exists but currentness is not proven and the reading is the current rule |
| `PROFESSIONAL_DETERMINATION_REQUIRED` | The matter is professional-risk |
| `SUPPORTED_WITH_LIMITATIONS` | Support exists with a stated limitation, or the reading is applicability on a date |
| `VERIFIED` | Tier 1–3 support, proven currentness, known predicates, no conflict, no professional-risk flag |

These labels do not replace the analysis epistemic labels. An agent conclusion remains an `INFERENCE`. A RED analysis remains `PROFESSIONAL_DETERMINATION_REQUIRED`.

## Phase 0–1 rules that stay in force

Jurisdiction is stated before a conclusion. The asserted analysis authority is a statement that CIVITAS is advising. It is not a legal source and it is not an execution grant. Rights and obligations are both present. Uncertainty is retained. An empty uncertainty list blocks the analysis.

| Class | Meaning | Professional gate | VERIFIER |
| --- | --- | --- | --- |
| GREEN | Principal may choose among disclosed lawful options | None | Not required by the class |
| AMBER | Regulated choice that still needs verification | None by default | Review required before reliance |
| RED | Professional-risk matter | Required | Required before reliance, including when the gate roles were named |
| BLACK | Prohibited mechanism | The mechanism is refused | A lawful pathway is returned where one exists |

Naming a professional gate does not mean the professional approved anything. VERIFIER review is an independent requirement. A score, a user preference, an agent recommendation, an external source, or a professional-review marker cannot make BLACK acceptable.

`KNOWN_PSEUDOLAW_INDICATORS` is a fixed supplemental list. It is not exhaustive detection. BLACK comes from the prohibited-mechanism doctrine (`fraud`, `concealment`, `evasion`, `pseudolaw`, `obstruction`, `misrepresentation`). A prohibited premise stays BLACK when none of the indicator strings appear.

Benefit and exposure dimensions are named only. No score is computed.

## Source text

No canonical instruction-trust primitive was found in this repository. Source text is sealed as evidence. It cannot change authority, governance, or capabilities, trigger execution, override BLACK, or suppress a gate.

## Projection and fleet debt

A successful analysis still projects onto the decision-engine record with `execution_allowed` false and status `GENERATED` or `PENDING_REVIEW`. Domain is `legal`. No new decision-core type is registered.

SCOUT, VERIFIER, REDTEAM, BUILDER, FORGE, and COUNSEL are not registered code agents. `FLEET_ARCHITECTURE_DEBT` records that missing fleet-wide registry. CIVITAS does not create one. Interaction records remain self-obligations and grant no permissions.

## Legal authority graph

The ceiling is jurisdiction, authority source, version and effective period, proposition, factual predicate, support or conflict, right or obligation or remedy, decision, evidence, and professional gate.

This phase builds the substrate for every node except right, obligation, and remedy. Decision remains the existing advisory projection. The professional gate remains the Phase 0–1 gate. Nothing here is a reasoning engine.
