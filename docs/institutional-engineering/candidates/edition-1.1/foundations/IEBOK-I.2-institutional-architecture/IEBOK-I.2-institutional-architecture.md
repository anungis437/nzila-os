# Institutional Architecture

## IEBOK Level I — Foundations, Volume II

**Designation:** IEBOK-I.2
**Edition:** 1.1.0 (Editorial Candidate)
**Status:** Informative editorial candidate
**Cite as:** IEBOK-I.2 §n, 1.1.0 (Editorial Candidate)

**Candidate lineage:** Prepared from recovered Edition 1.0 (Working Draft) under `CORR-I2-003`. The recovered Edition 1.0 manuscript remains the immutable qualification baseline. This candidate is not approved, published, externally reviewed, or Nzila-adopted.

---

## Front Matter

### Purpose of this Volume

Volume I established the identity of the discipline. This volume supplies its **design method**: how the structure of an institution is described, evaluated, and deliberately changed. It defines the seven architecture domains, the viewpoint system through which architecture is communicated, the pattern language through which recurring solutions are reused, and the discipline of reference architecture through which validated designs propagate between institutions.

### Position in the Series

This volume presumes the definitions, principles, and vocabulary conventions of IEBOK-I.1 and uses them without restatement. Its systems-theoretic underpinnings are developed in IEBOK-I.3. Its normative expression is the IE-STD series, principally IE-STD-006 (Architecture Specification).

---

## 1. Executive Overview

> **Editorial candidate notice (`CORR-I2-003`):** Unless and until separately authorized in a qualified normative document, modal language in this informative editorial candidate expresses proposed design guidance only. It does not establish an IE-STD requirement or Nzila policy.

Institutional architecture is the disciplined description of an institution's structure for the purpose of engineering it. Its unit of concern is not the org chart, the technology estate, or the process inventory, but the institution as a whole: how mandate becomes capability, how capability is governed, how knowledge and evidence sustain both, and how the whole persists through change.

The volume advances four claims:

1. An institution's structure can be described completely enough for engineering purposes through **seven architecture domains** (§4).
2. Architecture is only useful when communicated through **viewpoints** matched to the decisions its audiences must make (§12).
3. Recurring institutional problems admit recurring structural solutions — **patterns** — and recurring structural mistakes — **anti-patterns** — both of which belong to the discipline's shared literature (§13).
4. Validated whole-institution designs can be transferred between institutions as **reference architectures**, which is the discipline's principal mechanism of accumulated progress (§11).

## 2. Background and Engineering Rationale

Every institution already has an architecture. The question a practitioner confronts is never whether to have one but whether the existing one is known, intended, and fit for the mandate. Volume I's Principle P1 (institutions are engineered objects) makes architectural description the discipline's first act in any engagement: intervention in an undescribed structure is intervention blind.

The rationale for a distinct institutional architecture practice — beyond enterprise architecture, from which it borrows technique — is scope. Enterprise architecture describes an organization's business and information systems. Institutional architecture must additionally carry what makes an institution an institution: mandate and authority as first-class structural elements; legitimacy as a designed property; knowledge, evidence, and memory as load-bearing structure; and continuity across generations as a standing requirement rather than a project concern.

## 3. The Institutional Operating Model

### 3.1 Definition

An **institutional operating model** is the highest-level architectural statement: how the institution converts its mandate into delivered outcomes. It answers, in one coherent description: what the institution is obligated to produce; through which capabilities; organized in what structure; governed by which authorities; sustained by which knowledge, evidence, and resources; and measured by which instruments.

### 3.2 Elements

A complete operating model states:

1. **Mandate decomposition** — the obligations the institution carries, traced to their granting instruments.
2. **Value and obligation flows** — what flows to whom: services to publics, evidence to overseers, resources through the structure.
3. **Capability structure** — the durable abilities that discharge the obligations (§5).
4. **Organizational realization** — how capabilities are assigned to structures at the present time, held separately from the capabilities themselves.
5. **Governance spine** — the decision rights and accountability chain (§6).
6. **Sustaining structures** — knowledge, evidence, identity, funding, and workforce structures on which the above depend.
7. **Measurement system** — the instruments by which the institution observes its own condition (per Principle P9).

### 3.3 The separation rule

The operating model's cardinal rule is separation of the durable from the current: capabilities, obligations, and authorities are durable; organizational units, technologies, and personnel assignments are current. Conflating the two — defining a capability as "what Department X does" — binds institutional function to a replaceable component, in direct violation of Principle P3, and is the single most common defect the practitioner will encounter in inherited operating models.

## 4. The Seven Architecture Domains

The discipline describes institutional structure through seven domains. Together they are complete for engineering purposes; individually each has its own methods, artifacts, and failure modes.

| Domain | Object | Primary question |
| --- | --- | --- |
| Capability | Durable abilities | What must the institution be able to do? |
| Governance | Authority and accountability | Who may decide what, and who answers for it? |
| Knowledge | What the institution knows | What must be known, by what structure, to function? |
| Decision | How choices are made and recorded | How do decisions acquire evidence, authority, and memory? |
| Digital | Technical realization | How is structure realized in systems and data? |
| Stewardship | Custody across time | Who is accountable for each asset's persistence? |
| (Integrating) Operating model | The whole | How do the six above cohere against the mandate? |

Sections 5 through 10 treat each domain in turn.

## 5. Capability Architecture

### 5.1 The capability as unit of design

The capability (defined in IEBOK-I.1 §3) is the discipline's primary unit of structural design because it is the largest element that is stable across reorganization and the smallest that is meaningful against the mandate. Capability architecture produces: a capability model (the hierarchy of abilities, typically three levels deep before diminishing returns); capability-to-mandate traceability; capability-to-realization mapping (which units, processes, and systems currently deliver each); and capability condition assessment (maturity, load, saturation, and knowledge concentration per capability, using the mechanics instruments).

### 5.2 Design rules

- Capabilities are named by outcome, not by unit, technology, or process ("Member Eligibility Determination," not "the compliance team's spreadsheet work").
- Each capability carries exactly one accountable owner in the governance domain and one steward in the stewardship domain; these may coincide but are distinct roles.
- A capability that cannot be traced to mandate is flagged for the examination Principle P2 requires — heritage or waste, decided deliberately.
- Capability heat (condition assessment) is refreshed on a stated cadence; an unassessed capability model is décor.

### 5.3 Failure modes

Capability models fail by mirroring the org chart (recording structure, not ability); by unbounded proliferation (hundreds of "capabilities" no one can own); and by assessment theatre (heat maps colored by opinion rather than instrument). Each failure converts the model from an engineering artifact into a presentation artifact.

## 6. Governance Architecture

### 6.1 Object

Governance architecture makes Principle P6 (authority must be explicit) structural. Its artifacts are: the **authority register** (every consequential decision class, its holder, its granting instrument, its limits, and its delegation rules); the **accountability chain** (who answers, to whom, for what, with what evidence); **oversight structures** (boards, committees, review bodies) with charters, quorum, and decision instruments; and **escalation and exception paths**, designed per Principle P8 rather than improvised.

### 6.2 The three-state discipline

Governance gates — eligibility, approval, compliance, accreditation — shall be designed on the three-state doctrine: *confirmed satisfied*, *confirmed unsatisfied*, *unknown / review required*. Missing, stale, or conflicting evidence resolves to the third state and routes to a human path; it must never silently resolve to pass or fail. This rule, proven in the founding reference implementation, generalizes to every institutional gate.

### 6.3 Failure modes

Governance architecture fails through shadow authority (real decisions made outside the register), through accountability without authority (or its inverse), and through gate erosion — exceptions accumulating until the exception path is the path.

## 7. Knowledge Architecture

### 7.1 Object

Knowledge architecture makes Principle P4 (knowledge is a structural material) designable. It describes: the institution's **knowledge inventory** by domain and criticality; the **carrier structure** — which knowledge is carried by records, which by systems, which by practice, and which (dangerously) by individuals alone; **knowledge flows** — how knowledge is created, validated, transferred, and retired; and **concentration risk** — the mechanics quantity of knowledge density (ρ) applied to identify single-person and single-unit dependencies.

### 7.2 Design rules

Critical knowledge shall have at least two independent carriers, of which at least one is a record structure. Knowledge required by a gate or an obligation shall be traceable to a steward and a review cadence. Tacit knowledge is not exempt from architecture: where it cannot be recorded, its holders, succession plan, and transfer practice are themselves recorded.

### 7.3 Institutional memory

Memory (IEBOK-I.1 §3) is knowledge architecture's temporal dimension: the designed persistence of decisions, evidence, and their relationships. Its structural expression — the decision record, the evidence chain, the supersession trail — is specified in the decision domain (§8) and normatively in IE-STD-002 and IE-STD-005.

## 8. Decision Architecture

### 8.1 Object

Decision architecture engineers how institutional choices acquire evidence, authority, and memory. Its central artifact is the **decision record**: an immutable record capturing the decision, the deciding authority, the rule or policy version applied, the evidence referenced, the alternatives considered, any override and its approver, and the timestamp. Principle P5 (decisions are institutional assets) is realized here or not at all.

### 8.2 Decision classes

The architecture classifies decisions by consequence and reversibility, and matches process weight accordingly: irreversible or obligation-bearing decisions receive full records and gated authority; routine reversible decisions receive lightweight records and delegated authority. A single undifferentiated decision process produces either bureaucratic drag on the routine or dangerous informality on the consequential — usually both.

### 8.3 Overrides

Every gate admits a human override path; every override is a separate record that preserves, and never mutates, the evidence and derived state it overrides. Attribution of the original determination is retained permanently.

## 9. Digital Architecture

### 9.1 Position

Digital architecture is the realization domain: how the six other domains are expressed in systems, data, and integrations. Its subordination is deliberate — digital structure serves institutional structure, and the volume's rule of order is that capability, governance, knowledge, and decision design precede system design. A digital architecture that leads rather than follows produces the vendor-shaped structure failure of IEBOK-I.1 §13.2.

### 9.2 Institutional requirements on digital structure

Beyond ordinary engineering quality, institutional digital architecture carries obligations the discipline treats as non-negotiable: tenancy and isolation boundaries that mirror institutional boundaries; identity structures faithful to institutional roles and authorities (IE-STD-007); evidence and audit trails as first-class data (IE-STD-002); integration boundaries that fail visibly, never silently (Principle P8); explicit provenance on externally sourced facts; and exit — the demonstrated ability to extract the institution's data, evidence, and memory intact from any platform, including this discipline's own reference implementations.

### 9.3 The institutional graph and twin

The digital domain's unifying representations — the institutional graph (the canonical graph of capabilities, authorities, obligations, knowledge, and evidence) and the digital twin (the graph bound to live data, sufficient to observe state and simulate mechanics) — are developed in IEBOK-I.3 §10–11 and specified in IE-STD-008 and IE-STD-009.

## 10. Stewardship Architecture

Stewardship architecture gives IEBOK-I.1 §11 its structural form: the **stewardship register** mapping every asset class in every domain above to a named steward; transfer protocols bound to personnel transition events; review cadences proportional to criticality; and stewardship health measurement (orphaned assets, stale reviews, single-steward concentration) reported as a standing institutional indicator. The design rule is total coverage: an asset absent from the register is by definition orphaned, and the register is itself a stewarded asset with a named steward.

## 11. Reference Architectures

### 11.1 Definition and role

A **reference architecture** is a validated, reusable whole-institution or whole-domain design: an operating model, its seven-domain elaboration, its rationale, and the evidence of its validation in at least one reference implementation. Reference architectures are the discipline's mechanism of accumulation — the means by which one institution's engineered structure becomes another's starting point rather than another's envy.

### 11.2 Requirements

A design qualifies as a reference architecture only when it states its context of validity (institution class, scale, jurisdiction assumptions); traces every major element to rationale; discloses its known limits and failure modes; and cites a Level VI reference implementation in which it has operated. Undemonstrated designs circulate as *candidate* reference architectures and are labeled as such.

### 11.3 Adaptation discipline

Reference architectures are adapted, never adopted blind. The adaptation record — what was changed, why, and what validation obligations the changes create — is itself a decision record, preserving the chain from the reference to the instance.

## 12. Architectural Viewpoints

Architecture that cannot be communicated cannot govern. The discipline defines viewpoints — selective renderings of the architecture matched to an audience's decisions:

- **Mandate viewpoint** (governing bodies): obligations, authorities, and their discharge.
- **Capability viewpoint** (executives): the capability model with condition assessment.
- **Governance viewpoint** (boards, overseers, auditors): authority register, accountability chains, gate states.
- **Continuity viewpoint** (stewards, successors): knowledge carriers, concentration risk, transfer states.
- **Realization viewpoint** (engineers, operators): systems, data, integrations, and their mapping to the domains above.
- **Public viewpoint** (members, publics): the institution's structure rendered for those entitled to understand it — an expression of Principle P12.

Each viewpoint is derived from the single underlying model; viewpoints that drift from the model, or models maintained per-viewpoint, reproduce the incoherence they exist to prevent.

## 13. Patterns and Anti-Patterns

### 13.1 The pattern obligation

Recurring institutional problems admit recurring structural solutions. The discipline records these as patterns — named, contextualized, consequence-stated — and their seductive failures as anti-patterns. The initial registry, to be extended by the applied volumes:

**Patterns.** *Authority Register* (§6); *Three-State Gate* (§6.2); *Decision Record with Separate Override* (§8); *Dual-Carrier Knowledge* (§7.2); *Desired-State Instruction* (declare what should be true; reconcile toward it — rather than issuing unreconcilable commands); *Contracts-First Change* (IEBOK-I.1 §10.3); *Reversible Increment with Designed Stop*; *Provenance-Preserving Projection* (external facts consumed with attribution, never mutated locally); *Stewardship Register with Transfer Protocol* (§10).

**Anti-patterns.** *Org-Chart Capability Model* (§5.3); *Silent Gate* (unknown resolving to pass or fail); *Shadow Authority* (§6.3); *Single-Carrier Critical Knowledge*; *Vendor-Shaped Structure* (§9.1); *Migration-as-Modernization* (IEBOK-I.1 §13.2); *Viewpoint Drift* (§12); *Heat-Map Theatre* (§5.3).

### 13.2 Registry governance

Patterns enter the registry through the series' governance instruments (RFC, review, ballot) with at least one implementation citation; anti-patterns require at least one documented failure analysis. The registry is normatively indexed in IE-STD-006.

## 14. Governance and Practice Considerations

Architecture practice is itself governed: the architecture is a stewarded asset with a named steward; changes to the operating model and authority register are decision-recorded; and the architecture's fidelity to reality is measured (drift between described and actual structure is an entropy indicator, not a documentation chore). The practitioner's ethical obligations (IEBOK-I.1 §14) apply with particular force here, since the architect who misdescribes the institution misleads everyone who governs by the description.

## 15. Common Failure Modes of Architecture Practice

Beyond the domain-specific failures above: **the binder failure** (architecture produced, admired, and never bound to decisions); **the priesthood failure** (architecture held by specialists in a private vocabulary, violating P12); **the snapshot failure** (a one-time description with no maintenance cadence, decaying at the rate of institutional entropy); and **the completeness trap** (description pursued to exhaustion while the decisions it should inform are taken without it). The countermeasure to all four is the same: architecture exists to govern decisions, and every artifact is judged by the decisions it demonstrably informs.

## Cross References

- Discipline identity, principles, ethics: **IEBOK-I.1**
- Systems theory, graphs, twins: **IEBOK-I.3**
- Quantitative instruments for condition assessment: **IEBOK-II.MECH**
- Normative expression: **IE-STD-001 (Capability), IE-STD-004 (Governance), IE-STD-005 (Decision), IE-STD-006 (Architecture), IE-STD-007 (Identity), IE-STD-008 (Institutional Graph)**
- Demonstration: **Level VI Reference Implementations**

## Summary

This volume defined the discipline's design method: the operating model as the integrating statement; seven architecture domains as the complete descriptive frame; capability, governance, knowledge, decision, digital, and stewardship architecture as engineered structures with stated design rules and failure modes; viewpoints as the communication discipline; patterns as the reuse discipline; and reference architectures as the discipline's mechanism of accumulated progress. Volume III supplies the systems theory beneath these structures.

## Suggested Future Research

1. Empirical bounds on capability model depth and size against model maintenance survival rates (§5).
2. Measured incidence of the three-state gate's *unknown* branch across institution classes, as a calibration input for review-capacity planning (§6.2).
3. Formal drift metrics between described and actual architecture as entropy instruments (§15).
4. Conditions under which reference architectures transfer across jurisdictions with divergent legitimacy structures (§11).

---

*End of IEBOK-I.2, Edition 1.1.0 (Editorial Candidate).*
