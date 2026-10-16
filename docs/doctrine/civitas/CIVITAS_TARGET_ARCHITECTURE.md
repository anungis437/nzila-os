# CIVITAS Target Architecture

Level 8 is a target: Personal Institutional Sovereignty Intelligence. It is not implemented. Phase 0–1 is the foundation. Phase 2 adds a legal-authority substrate and does not store a personal record, run a scenario engine, or open a standing register.

Personal data stays separated from doctrine. Doctrine and the analysis contract contain no personal record.

## Phases

| Phase | Name | State |
| --- | --- | --- |
| 0 | Fleet registration | Foundation, still in force |
| 1 | Doctrine, analysis contract, evidence hierarchy | Foundation, still in force |
| 2 | Authority intelligence substrate | This change. Not a reasoning engine |
| 3 | Personal institutional graph | Target, after the privacy evaluation below |
| 4 | Obligations and rights | Target |
| 5 | Asset and dependency | Target |
| 6 | Continuity | Target |
| 7 | Scenario intelligence | Target |
| 8 | Institutional sovereignty intelligence | Target |

## Concept map

Each future concept either names an existing primitive or stays unmapped. None of them introduces a primitive in this phase. Standing registers are not created.

| Concept | Existing primitive | Note |
| --- | --- | --- |
| Person | Ontology `Person` | Target. No personal data in this phase |
| Jurisdiction | Organization jurisdiction code, for example `CA-QC` | The Africa jurisdiction policy package is a different concern |
| Authority | `DecisionAuthority` in `@nzila/decision-core` | Permission to decide or execute. Not a legal source. Not granted by CIVITAS |
| LegalSource | `EvidenceRef` plus a CIVITAS domain record | Source identity, status, and weight. Not a platform primitive |
| LegalRule | None | Ontology `Policy` is not a statute |
| LegalPosition | None | The analysis contract is the Phase 1 shape |
| Right | None | Target |
| Remedy | None | Target |
| Obligation | Decision `required_approvals`, plus the analysis layers | Target for a fuller model |
| Entity | Ontology entity | Target |
| OwnershipInterest | Ontology `BELONGS_TO` | A relationship is not yet a typed interest |
| BeneficialInterest | None | Concealment is prohibited |
| ControlRight | None | Target |
| FiduciaryRelationship | None | Target |
| Asset | Ontology `Asset` | No asset register |
| Liability | None | An invoice is not this liability |
| Contract | Ontology `Document` | `Deal` is not reused as a private-law contract |
| Patrimony | None | Québec concept. Target |
| Residency | None | Cross-border residence is RED |
| Citizenship | None | Target |
| Disclosure / FilingRequirement | Legal domain in `@nzila/decision-core` | No new enforced decision type |
| Licence | None | Target |
| IdentityCredential | None | The secrets package is not a personal-credential store |
| DigitalAsset | Ontology `Asset` | Target metadata only |
| IP | None | Target |
| Succession / IncapacityInstrument | Ontology `Document` | Estate instruments are RED |
| Adviser | Ontology `Advisor` | An adviser is not counsel of record for CIVITAS |
| EvidenceArtifact | Evidence pack artifact | This phase does not seal packs |
| Decision | Decision-engine decision record | Advisory projection. Execution stays off |
| Scenario | None | Target. Labels below |
| Risk | Decision severity | Dimensions are named, not scored |
| Dependency | Ontology `DEPENDS_ON` | Target |

Two decision records already exist. The analysis projects into the decision-engine record because it already carries evidence references and an execution flag. `@nzila/decision-core` remains the enforcement registry and is not extended. `DecisionAuthority` stays a permission-scope result. It is not the legal-source model.

## Legal authority graph

Ceiling, in order: jurisdiction, authority source, version and effective period, proposition, factual predicate, support or conflict, right or obligation or remedy, decision, evidence, professional gate.

The Phase 2 substrate records jurisdiction, source, version and effective period, proposition, factual predicate, support and conflict, evidence references, the existing advisory decision projection, and the professional gate. Right, obligation, and remedy are not built. Relations are stored only when supplied. Court hierarchy and stare decisis are not automated.

## Fleet architecture debt

There is no canonical machine-readable registry of SCOUT, VERIFIER, REDTEAM, BUILDER, FORGE, or COUNSEL. `FLEET_ARCHITECTURE_DEBT` records that gap for a fleet-wide fix. CIVITAS does not create an agent registry and does not grant those names permissions.

## Scenario engine

Not implemented. A later deterministic engine may examine synthetic patterns such as an intellectual-property transfer to a corporation, incapacity, death, and a change of tax residency. Every output of that engine must be labelled `FACT`, `INFERENCE`, `ASSUMPTION`, `UNRESOLVED`, or `PROFESSIONAL_DETERMINATION_REQUIRED`. This phase exports those labels and does not emit scenario results.

## Professional handoff

A handoff, when a later phase produces one, carries the objective, jurisdiction, labelled facts, evidence references, uncertainty, decision class, the professional gate, the question the professional is asked to determine, and a statement of what CIVITAS did not determine. It is not a filing and it is not a retainer.

## Privacy evaluation before any personal-data work

The following controls exist elsewhere in the platform and have not been evaluated for a personal institutional record: tenancy, authorization, encryption, audit, retention, secrets, logging, backups, export, deletion, provenance, and least privilege. Until that evaluation is done, personal-data work stays closed. This phase stores nothing personal and logs nothing personal.

Anti-surveillance doctrine still applies. CIVITAS does not rank individuals, profile behavior, or score performance. A future self-directed record would still have to pass that doctrine. It is not authorized here.
