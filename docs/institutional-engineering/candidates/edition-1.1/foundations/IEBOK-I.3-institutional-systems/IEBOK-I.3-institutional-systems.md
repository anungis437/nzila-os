# Institutional Systems

## IEBOK Level I — Foundations, Volume III

**Designation:** IEBOK-I.3
**Edition:** 1.1.0 (Editorial Candidate)
**Status:** Informative editorial candidate
**Cite as:** IEBOK-I.3 §n, 1.1.0 (Editorial Candidate)

**Candidate lineage:** Prepared from recovered Edition 1.0 (Working Draft). No substantive correction is applied in this candidate; all graph, twin, simulation, and dynamics corrections remain deferred under the Wave 2B correction-disposition register. The recovered Edition 1.0 manuscript remains the immutable qualification baseline.

---

## Front Matter

### Purpose of this Volume

Volume I defined the discipline; Volume II supplied its design method. This volume supplies its **systems theory**: the account of institutions as dynamic systems composed of interacting elements — processes, capabilities, services, technology, information, knowledge, identity, evidence, and dependencies — whose collective behaviour the discipline observes, represents, and eventually simulates. Its culminating constructs are the **institutional graph** (§10) and the **institutional digital twin** (§11), the representations on which measurement and simulation stand.

### Position in the Series

This volume presumes IEBOK-I.1 and IEBOK-I.2. Its quantitative vocabulary is Institutional Mechanics (IEBOK-II.MECH), used here in its defined senses. Its normative expression is principally IE-STD-003 (Knowledge), IE-STD-007 (Identity), IE-STD-008 (Institutional Graph), IE-STD-009 (Digital Twin), and IE-STD-010 (Simulation).

---

## 1. Executive Overview

An institution is a system: elements in structured interaction producing behaviour no element produces alone. This volume develops that claim with engineering intent. It identifies the nine element classes from which institutional systems are composed (§3–§9), the dependency structures through which they interact (§9), the graph representation in which the whole becomes a single analyzable object (§10), and the digital twin through which the representation is bound to reality and made observable (§11). Its final sections treat the dynamics — flows, feedback, delays, and emergence — that make institutional behaviour systemic rather than additive (§12), and the failure modes characteristic of institutional systems as systems (§13).

## 2. Background and Engineering Rationale

The systems view is forced on the discipline by observation. Institutional failures rarely localize: a stale record defeats a compliance gate, which delays an eligibility decision, which erodes a member's trust, which surfaces two years later as a legitimacy event in an apparently unrelated forum. Elements are engineered; behaviour is systemic. A discipline that designed elements without a theory of their interaction would be perpetually surprised by its own institutions.

The rationale for a dedicated volume is precision. "Systems thinking" as commonly invoked is a sensibility; this volume's ambition is a **representation** — definite element classes, definite relationship types, definite dynamics — sufficiently precise that two practitioners describing the same institution produce compatible models, and sufficiently formal that the models support computation.

## 3. Processes and Capabilities

### 3.1 The distinction

A **capability** is a durable ability; a **process** is a repeatable sequence of activity through which a capability is exercised at a given time. The distinction (established in IEBOK-I.2 §3.3) is load-bearing throughout systems work: capabilities are nodes of the durable structure; processes are their current realization and are expected to change without the capability changing. Systems analysis that models only processes rebuilds itself at every process change; analysis that models only capabilities cannot locate where load actually flows.

### 3.2 Systemic properties

For systems purposes, each process carries: throughput and cycle time (the flow quantities on which load and saturation are computed); handoff structure (each handoff a friction site and a failure site); exception paths and their volumes (the empirical measure of how well the designed process matches reality); and evidence emission — the records a process produces as it runs, which are the raw material of measurement (§8).

## 4. Services

A **service** is a capability exercised on behalf of a consumer under an explicit or implicit promise — to a member, a public, another institution, or another part of the same institution. Services are where institutional load enters the system: every service promise is a standing demand claim against capacity. The systemic discipline of services is the **promise inventory**: every service, its consumers, its promise (explicit terms or inherited expectations), its demand profile, and the capabilities it draws on. Institutions habitually carry promises no register records — inherited expectations, informal commitments, "the way it's always worked" — and these unrecorded promises are load that no capacity plan accounts for. The promise inventory converts them from ambient obligation into engineered objects.

## 5. Technology

Technology enters the systems view not as an estate to be cataloged but as a class of **carriers**: systems carry processes, information, and increasingly decisions. The systemic properties of a technology element are its criticality (which capabilities fail when it fails), its coupling (what propagates through it, per the mechanics quantity κ), its provenance behaviour (whether externally sourced facts retain attribution), its failure visibility (whether it fails loudly or silently — Principle P8), and its exit cost (what the institution must expend to leave it). The volume's rule is inherited from IEBOK-I.2 §9: technology elements are modeled by what they carry and what they risk, and a technology invisible to the graph (§10) is an unmanaged dependency by definition.

## 6. Information and Knowledge

### 6.1 The distinction

**Information** is recorded content; **knowledge** is the institution's organized capacity to use it (IEBOK-I.1 §3). Systems work models both, differently: information as stocks with quality states (current, stale, conflicting, unknown-provenance), knowledge as a distribution over carriers (records, systems, practices, people — IEBOK-I.2 §7).

### 6.2 Systemic properties

Information stocks carry freshness (age against a stated tolerance), provenance (source and chain of custody), and authority (which stock is authoritative where stocks conflict — the system-of-record designation). Knowledge distributions carry density and concentration (the ρ instrument), redundancy (carrier count per critical item), and transfer latency (how long succession actually takes). These are the quantities on which entropy (H) is observed: entropy in an institutional system is measured principally as information staleness, provenance decay, and knowledge concentration growth.

### 6.3 Flows

Information flows are modeled with their transformations — each aggregation, projection, or synchronization a site where provenance is preserved or lost. The systemic rule: **a fact may flow anywhere; its provenance must flow with it.** Projections of external facts remain attributed to their source and are corrected by new facts, never by local mutation (the provenance-preserving projection pattern, IEBOK-I.2 §13).

## 7. Identity

Identity is the systems element that binds people and organizations to the structure: who a person or body is, in which roles, with which authorities, across which parts of the institution, over what time. Its systemic difficulty is multiplicity — one person holding several roles, one role held serially by several people, identities spanning institutional boundaries with different assurance levels. The systems requirements: identities are stable across role changes (the person is not re-created when the role changes); roles bind to authorities in the governance structure, not to individuals; identity resolution at boundaries (matching an external record to an internal person) is an explicit, evidenced, human-reviewable operation, never a silent merge; and historical bindings are preserved — who held which authority when is institutional memory, not housekeeping. Normative expression: IE-STD-007.

## 8. Evidence

Evidence (IEBOK-I.1 §3) is the systems element that makes the institution's assertions defensible. In the systems view, evidence is a first-class stock with its own lifecycle: emitted by processes (§3.2), referenced by decisions (IEBOK-I.2 §8), aging against freshness policies, superseded but never destroyed, and retrievable by those entitled to examine it. Two systemic rules govern it. **Chain integrity:** an assertion is only as strong as the weakest link in its evidence chain, and the chain is modeled explicitly — assertion → decision record → evidence items → provenance. **Three-state consumption:** any consumer of evidence (a gate, a report, a twin) treats missing, stale, or conflicting evidence as *unknown*, propagating the unknown rather than resolving it silently (IEBOK-I.2 §6.2 generalized). Normative expression: IE-STD-002.

## 9. Dependencies

### 9.1 The dependency as first-class element

Every relationship in which one element's function requires another's is a dependency, and dependencies — not elements — are where institutional systems fail systemically. The discipline models them explicitly: type (functional, informational, authoritative, resource), direction, strength (what degradation propagates), and visibility (known and managed, known and unmanaged, unknown).

### 9.2 Structural analysis

On the dependency structure the discipline computes its coupling and cascade analyses: coupling density (κ) by region; single points of failure (elements whose loss partitions function); hidden coupling (elements coupled through a shared dependency neither owns); and cascade reach (the closure of what fails when a given element fails). These analyses convert resilience from aspiration into inspection: an institution's shock behaviour is largely legible in its dependency structure before any shock arrives.

### 9.3 External dependencies

Dependencies crossing the institutional boundary — providers, partner institutions, platforms, regulators — carry additional obligations: explicit contracts (in the IEBOK-I.1 §10.3 sense), failure-mode agreements, provenance preservation, and exit paths. The founding reference implementation's provider-integration doctrine (contracts first; fail visibly; unknown never silently passes; provider facts attributed, never mutated) is the canonical treatment and generalizes to all external dependency classes.

## 10. The Institutional Graph

### 10.1 Definition

The **institutional graph** is the canonical representation of an institutional system: a typed, versioned graph whose nodes are the element classes of this volume (capabilities, processes, services, technology carriers, information stocks, knowledge carriers, identities, evidence items, decision records, authorities, obligations) and whose edges are their typed relationships (realizes, depends-on, carries, evidences, authorizes, obligates, supersedes, stewards).

### 10.2 Requirements

The graph is complete for engineering purposes (an element absent from the graph is unmanaged by definition); typed (nodes and edges conform to the published schema — IE-STD-008); versioned (the graph at any past date is reconstructible, because institutional memory includes structural memory); attributed (every node and edge carries provenance and stewardship); and computable (the analyses of §9.2 and the mechanics instruments run on it, not beside it).

### 10.3 Role in the discipline

The graph is where the seven architecture domains of Volume II become one object. Capability models, authority registers, knowledge inventories, promise inventories, and dependency maps are viewpoints over the graph, not separate artifacts — the single-model rule of IEBOK-I.2 §12 given its concrete form.

## 11. The Institutional Digital Twin

### 11.1 Definition

The **digital twin** is the institutional graph bound to live data: structure joined to state. Where the graph says "this capability depends on this information stock," the twin says "and that stock is 47 days stale against a 30-day tolerance." The twin is the discipline's observatory — the instrument through which the mechanics quantities become readings rather than concepts.

### 11.2 Fidelity discipline

A twin is only as trustworthy as its bindings, so the twin doctrine is fidelity before features: every state value carries its source, freshness, and confidence; unbound regions of the graph are displayed as unbound (unknown, never defaulted); and twin-versus-reality divergence is itself measured and reported. A twin that silently mixes live readings with stale assumptions is more dangerous than no twin, because it manufactures confidence.

### 11.3 Simulation readiness

The twin is the substrate on which simulation (IE-STD-010) operates: scenario inputs perturb twin state; mechanics relationships propagate the perturbation; outputs are read as projected condition. This volume imposes only the architectural requirement — twins shall be constructed so that simulation engines consume them without restructuring — and defers simulation method to the Institutional Mechanics science and its standard.

## 12. System Dynamics

Institutional behaviour is dynamic: stocks and flows, feedback, delay, and emergence. The volume fixes the minimal dynamic vocabulary the discipline requires. **Flows and stocks:** load flows in through service demand; work flows through processes; evidence, information, and knowledge accumulate as stocks with inflow, decay, and consumption. **Feedback:** reinforcing loops (trust → engagement → resources → performance → trust) and balancing loops (saturation → quality decline → demand management) are identified explicitly, because interventions land inside loops, not beside them. **Delay:** institutional feedback is slow — legitimacy responds to performance on a horizon of years — and delay is why drift (IEBOK-I.1 §9) is invisible from inside; instruments exist to out-see the delay. **Emergence:** institutional condition (health, resilience, legitimacy) is a property of the system, not of any element, which is why the discipline's composite indicators are computed over the graph rather than summed over departments.

## 13. Systemic Failure Modes

Beyond the element-level failures of Volumes I–II, systems fail as systems: **cascade** (a local failure propagating along unmanaged dependencies — §9); **gridlock** (circular dependencies in authority or information, where every element waits on another); **oscillation** (balancing loops with delay overshooting in both directions — the mechanics quantity ω, structural rather than behavioural in origin); **decoupling decay** (redundancies and buffers quietly optimized away until the system is tightly coupled and brittle); **representation rot** (graph and twin diverging from reality until decisions made on them are decisions made on fiction); and **observatory capture** (the measurement system optimized to reassure rather than observe — the terminal form of measurement failure, IEBOK-I.1 §12.2). Each has a designed countermeasure in the preceding sections; the volume's closing rule is that the countermeasures are standing structures, not projects.

## Cross References

- Discipline identity and principles: **IEBOK-I.1**
- Architecture domains, viewpoints, patterns: **IEBOK-I.2**
- Quantitative vocabulary and instruments: **IEBOK-II.MECH**
- Normative expression: **IE-STD-002 (Evidence), IE-STD-003 (Knowledge), IE-STD-007 (Identity), IE-STD-008 (Institutional Graph), IE-STD-009 (Digital Twin), IE-STD-010 (Simulation)**
- Demonstration: **Level VI Reference Implementations**

## Summary

This volume supplied the discipline's systems theory: nine element classes — processes, capabilities, services, technology, information, knowledge, identity, evidence, and dependencies — each with defined systemic properties; the institutional graph as their single canonical representation; the digital twin as the graph bound to live state and the discipline's observatory; a minimal dynamics vocabulary of flows, feedback, delay, and emergence; and the failure modes characteristic of institutions as systems. With Volumes I and II, the Foundations level is complete: identity, method, and theory. The Level II sciences build on all three.

## Suggested Future Research

1. Reference schema completeness studies: element and edge types encountered in practice that IE-STD-008 does not yet name.
2. Empirical decay rates of graph fidelity (§13, representation rot) by maintenance regime.
3. Delay-constant estimation for the trust and legitimacy feedback loops (§12) across institution classes.
4. Minimum viable twin: the smallest binding set that yields decision-grade observability for a given institution class (§11).

---

*End of IEBOK-I.3, Edition 1.1.0 (Editorial Candidate).*
