# CIVIC / CLEAR / SAGE — Product Ceiling and Decision Baseline

**Record:** CCS-CEILING-2026-11-23 · **Version:** 1.1 proposed freeze · **Owner:** Nzila Ventures · **Baseline:** main `c103aa2fd5f90011f6aa4bfb8a45cdf37910f786` · **Decision state:** prepared for founder acceptance, not represented as signed · **Implementation:** paused.

This is a design-only decision instrument. It neither authorizes CIVIC runtime nor deploys SAGE, changes the canonical OCI method or admits real institutional data. The existing `CIVIC_PRODUCT_GO_LIVE = NO_GO`, `runtimeAuthorization.authorized = false` and SAGE external launch `NO_GO` remain effective.

## 1. Ceiling definition

**CIVIC** is the public-sector engagement and institutional workspace experience; **CLEAR** is the public-service expression of the existing OCI evidence discipline; **SAGE** is its governed evidence, review, decision-context and continuity workspace. **OCI** remains the one underlying method, with **OCRA** its recognition instrument and existing five phases. This is **one coherent institutional offering**, not three methods or standalone competing scores.

**Product promise:** an institution can trace an important question from authorized mandate, through contextualized evidence, differences of interpretation, a documented human decision, implementation and evidence of outcomes, to learning and succession, without surrendering institutional authority to the software.

**Product ceiling:** fully repeatable, versioned, bilingual, accessible, secure, multi-tenant, multi-institution, independently supportable institutional continuity and accountability. **Release floor:** one full, credible journey for a named institution type, with adverse-path proof and operations; breadth is added through configurations rather than forks. External reviewers assess the functioning method/product later. They do not define its architecture before we build.

## 2. Constitutional precedence — unchanged

1. `docs/oci/OCI_METHOD.md`, `CANON.md`, `OCI_DELIVERY_MODEL.md`, `oci-product-ladder.md` own method, phases and commercial price authority.
2. `docs/oci/OCI_AI_BOUNDARY.md` and `OCI_ANTI_SURVEILLANCE_POSITION.md` own hard AI/privacy and anti-surveillance prohibitions.
3. `docs/CIVIC_OCI_ALIGNMENT.md` owns the relationship of CIVIC/CLEAR to OCI/OCRA.
4. `docs/public-service/clear-method-canonical.md` owns five CLEAR pillars and four risk tiers, with evidence/human review requirements; no independent scoring ladder.
5. `docs/public-service/sage-workspace-canonical.md` defines the SAGE product direction; its historical 'future-only' readiness statements are not reliable implementation inventory, which is separately evidenced by `packages/sage-core` and `apps/platform-admin`.
6. `governance/foundations/civic-oci-doctrine.contract.json` is the machine authority for CIVIC runtime permission. Historical synthetic grants expired or were revoked; none are reused.
7. Source-of-truth conflicts must be reconciled in owner-authorized amendments. This document cannot override any of these by implication.

## 3. Decisions proposed to lock

| ID | Domain | Exact design choice and invariant |
|---|---|---|
| D01 | Product identity | CIVIC is the entry/experience, CLEAR the evidence method, SAGE the workspace, OCI the canonical method. Avoid duplicative branded assessment engines. |
| D02 | Buyer | Executive sponsor or institution's authorized contracting unit is buyer/ratifier; facilitator and practitioner are users, not substitutes for institutional authority. |
| D03 | Market | Canadian departments, agencies, crown corporations, regulators, municipalities, associations and analogous public-serving institutions via versioned profiles; exclude high-risk domain extensions until separately qualified. |
| D04 | Journey | Discover/qualify → sponsor and consent → versioned context → question/scope → sources/evidence → interpretations → human review → adoption/decline/deferral → intervention/measurement → decision/learning/exit. Align phase events to OCI's five existing phases; no second assessment clock. |
| D05 | Commercial | Existing OCI ladder and sole canonical price owner governs. No silent independent CIVIC/SAGE SKU or per-seat rate. Product activation maps to OCI Infrastructure, with previous phases represented without duplicate charging. |
| D06 | Productization change | Current CIVIC outreach is feedback-only by doctrine. Moving from research to synthetic demo and buyer-facing product requires an explicit, separate positioning/authorization amendment, without implying live availability. |
| D07 | Tenant hierarchy | Contracting institution is isolation root. Multiple agencies/programs/subunits may be modeled within that root, with scoped workspaces; cross-institution access is separately approved and always revocable. |
| D08 | Identity | Human authentication, tenant membership, workspace role, institutional function, delegated mandate, evidence grant and export authorization are different things. |
| D09 | Institutional mandate | Consequential actions require an institutionally attested authority instrument binding role/position, actor, organization, eligible action/resource, effective/expiry dates, revocation and review trail. Authentication cannot substitute. |
| D10 | Personas | Sponsor, steward, governance liaison, facilitator, program/service owner, records custodian, legal, privacy/ATIP, HR, equity/accessibility/official languages, IT/security, audit/evaluation, board/oversight, external invited reviewer, acting/delegated officer, successor, tenant administrator, Nzila support and system actor. Multi-capacity and conflicts included. |
| D11 | Authority separation | Review, adopt/ratify, export, erase, admin and support privileges are distinct. Independence of review and customer-owned decisions must be enforced even when Nzila is founder-operated. |
| D12 | Source of truth | Institution retains authority of legal/policy and business systems; source references before copies. Every imported record has data owner, locator, permission, retention classification, version/freshness, origin and custody. |
| D13 | Evidence classes | Authoritative source reference; institution-attested record; derived material; interpretation; reviewer finding/draft; adopted human decision are separate types, with irreversible provenance history. No caller self-attestation. |
| D14 | CLEAR | Preserve Continuity, Legitimacy, Evidence, Accountability, Readiness; existing confidence rubric and four sensitivity tiers. Tier determines minimum proof and review routing. Never add scores or rankings as product shortcuts. |
| D15 | Disagreement | Conflicting sources, dissent, rebuttal, open questions, supersession and recorded disposition coexist. Software cannot silently collapse dissent or infer consensus. |
| D16 | Accountability | First-class chain: mandate → objective/question → proposed options/intervention → approval/instrument → resources/commitments → deliverables/execution → expected/observed measures → variance/uncertainty → accountable decision → follow-up and memory. |
| D17 | Observations | Use source-bound observed measures and deterministic variance calculations only where meaningful. Distinguish observed change from causal attribution, and explicitly display absent observations. |
| D18 | Human adoption | Facilitator drafts. Institution adopts, declines, defers or challenges, with known authority and version. Drafts/AI synthesis are never authoritative institutional findings. |
| D19 | AI | Assist only with authorized classification, drafting and evidence synthesis. Authorization-before-context, evidence-linked outputs, consent/config controls, logging, human review and deterministic fallback. No AI outcomes, enforcement, HR/personnel judgments or self-attestation. |
| D20 | Confidentiality | Default deny; special material segmented by purpose and grant, including legal privilege, personnel, labour matters, complaints, protected disclosures and adjudication-related records. Explicit refusal pathways and exclusion evidence. |
| D21 | Configurable core | One kernel. Versioned institution profile, risk rules, document obligations, approvals, function mappings, policy overlays, retention and adapters. No customer-specific code branch. |
| D22 | Client UX | Lean navigation: Questions, Evidence, Reviews, Decisions, Continuity, Reports, Settings. Distinct landing pages by persona, minimal copy, mobile-native interaction, powerful desktop review, honest available/pending states. |
| D23 | Bilingual/a11y | All client journeys and output templates en-CA/fr-CA; WCAG 2.2 AA design goal with real manual keyboard/screen-reader proof; culturally neutral institutional language. |
| D24 | Integrations | Read/reference/link first; controlled ingestion when needed. Initial M365/SharePoint reference path and manual registers; GCdocs, ITSM, HRIS, finance and sector records use validated adapter contracts when actual buyer needs justify them. |
| D25 | Records | Access/consent, legal holds, archives, retention, immutable exports, controlled recipient delivery, destruction, backup/restore non-resurrection and customer-readable departure package are lifecycle features. |
| D26 | Security | Tenant/workspace/document/evidence/AI/export/job boundaries; idempotent audited writes; RLS under non-owner DB principal; negative proof for cross-tenant and invalid roles; secret/key rotation. |
| D27 | Operational | Dedicated deployed staging, canonical migrations, log correlation and PII scrubbing, human-received alerts, incident drill, tested restore, reliability and service support. Local unit tests alone cannot clear gates. |
| D28 | Tenant autonomy | Tenant can correct source references, change steward, revoke grants, move successor authority, extract adopted records and end service without vendor dependency. |
| D29 | Platform topology | CIVIC product experience may consume authorized versioned SAGE services; platform-admin SAGE remains operator/admin surface. Never hide CIVIC runtime in UE or route aliases to evade machine contract. |
| D30 | UE relationship | Stable shared Nzila OS infrastructure and OCI method APIs are reusable; UE and CIVIC have independent environment, backlog, data, release, acceptance and recovery. Existing OCI implementation inside UE must be neutralized via tested parity before product reuse, not forked. |
| D31 | Future network | OCI P5 stays prohibited for sale until canonical conditions hold; any cross-institution intelligence requires opt-in, threshold, non-ranking and independent evidence. |
| D32 | Commercial delivery | Sponsor discovery, written scoping, consent, reference demonstration, controlled pilot, UAT, acceptance, support/SLA, evidence handover and renewal/exit are explicit. A prospect's interest ≠ authorization to use their records. |
| D33 | Release | Synthetic demo, client pilot and general production each have separate GO contracts with bound artifact/environment/tenant/persona evidence. No critical bypass. |
| D34 | Change control | After founder approval, product additions become versioned change proposals, not automatic expansions. External feedback is evidence to assess after working-tool presentation, not an automatic core-method rewrite. |

## 4. Required canonical surfaces

**CIVIC:** trusted public-service entry (in present first-touch posture); authorized demo/workspace entrance; institutional sponsor journey; tenant and mandate setup; owner and participant provisioning; accessible role-sensitive navigation; executive continuity command centre; durable change/exit paths.

**CLEAR:** question/scope; operating context; source register; five-pillar evidence and confidence; four-tier review obligations; structured disagreement and gaps; reviewer routing; draft/revise/accept/decline/defer; versioned human-reviewed brief; traceable next-evidence requests.

**SAGE:** tenant/workspace boundary; actor/mandate/grant authorization; evidence provenance; review and decision objects; controlled disclosure and export; resource/commitment/intervention/outcome chain; history and successor memory; audit/legal hold/retention/destruction; observability/restore/support; genuine bilingual responsive UI.

**Executive product proof:** for every material institutional intervention, the sponsor can answer *why, on whose authority, against which evidence, at what resource commitment, what was done, what changed, what remains contested, who decides next, and what the successor inherits*. Absence of any dimension is explicit rather than fabricated.

## 5. Personas, actions and negative-path ceiling

Each action is verified for an authorized actor, unauthorized same-tenant actor, wrong-tenant actor, revoked/expired delegate, system identity, and subject with restricted evidence.

Required actions: invitation/redemption; institutional adoption; membership/role change; time-bound delegation; question creation; scope amendment; source registration and evidence classification; claim/attestation; contradiction/rebuttal; risk-tier escalation; independent review; ratification/deferral; resource commitment; observation/variance; executive brief; source-linked export; external recipient access; revocation; retention/hold; deletion and non-resurrection; succession; client exit; and incident/restore.

High-risk adversarial cases: platform admin impersonation, unverified authority label, wrong-source claim, suppressed dissent, stale AI/snapshot context, unreviewed auto-decision, causation overclaim, over-broad external invitation, privileged case-data leakage, approval/export/revocation race, duplicate worker side effects, inaccurate multilingual permission display, inaccessible mobile critical action, backup restoring revoked credentials, and method/tenant drift introduced by shared UE change.

## 6. First release floor vs ceiling

**Synthetic presentation floor:** one coherent fictitious institution, authentic CIVIC UX, a CLEAR question mapped to five pillars, real SAGE workflows, valid human mandate, two contradictory authorized sources, denied restricted access, intervention and outcomes with honest uncertainty, human ratification, printable and exportable executive package, successor brief, accessible bilingual paths. Label as simulated; no real data or unsupported compliance claim.

**Controlled client pilot floor:** all above on deployed production-equivalent infrastructure, actual allowed personnel and roles, approved scope and records/data handling, client-specific authority/consent, tested backups and alerting, audit and security refusal, accessible/bilingual UAT and explicit pilot GO.

**Complete ceiling:** configurable multi-institution longitudinal use, complete persona/delegation lifecycle, documented adapter ecosystem, all CLEAR and SAGE executive packages, operational support, records portability, rigorous resilience; without speculative cross-institution P5 or prohibited personnel surveillance.

## 7. Three-reality acceptance

**R — Institutional validity:** actual delegated instrument validation; source authority attestation; contestable competing evidence and minority view; human-only adoption; correct exclusion policies. Prove in two materially different fictional institutional configurations on the same kernel.

**D — Operating viability:** measurable reduction in manual re-entry/administration, versioned config lifecycle and rollback, user walkthrough across all stakeholder classes, real integration/data-plane proof, EN/FR and screen reader/mobile functional acceptance, support/offboarding and tested restore.

**T — Executive accountability:** executable mandate → authorized intervention → resources and work → verified deliverables → observed vs expected → open uncertainty → next named human decision → institutional learning. A static slide or counts dashboard does not pass.

All claims carry explicit evidence states: `DESIGNED`, `IMPLEMENTED`, `LOCAL_PROVEN`, `DEPLOYED_PROVEN`, `CLIENT_ACCEPTED`, `RELEASE_AUTHORIZED`. Historical synthetic proof must never be promoted to deployed truth.

## 8. Release contracts and remaining factual unknowns

The last recorded SAGE 15-gate assessment: G1–G5 and G8 PASS as repository/local proof, six gates PASS_WITH_CONDITIONS, and G11 accessibility, G12 telemetry/incident, G13 restoration NOT_PROVEN. B-005 staging deployment/data plane remains the prerequisite. These are historical records; fresh deployment verification is necessary. The SAGE page actor-classification defect (missing trusted authentication type in some manually assembled scopes) is a source-confirmed engineering blocker.

Current CIVIC runtime permission is false; no previous expired/revoked synthetic grant is current permission. Synthetic CIVIC Slice 0 code already includes position/mandate, evidence-source categories, intervention/resource, measure and human-decision primitives; those proof-bounded designs must be inventoried and reused conceptually without interpreting synthetic code as authorization for a live customer domain. C1 implementation authorization must explicitly name scope, allowed paths/actions, data boundary and environment; nothing in this document changes it.

External institutional facts cannot be invented at product design time: actual sponsor and mandate records, jurisdiction-specific legal requirements, PIA/records decisions, procurement process, source-system access, data location/custody acceptance, institutional reviewers and client UAT. Their **capture and validation contracts** are design decisions here; their values remain client-specific.

## 9. Conflict register — must be reconciled before implementation

- **C01:** Existing CIVIC front-door doctrine is explicitly pre-product/feedback-only, while this roadmap seeks an eventual tool presentation and buyer-facing CIVIC software. Separate method-preserving authorization/positioning amendment required.
- **C02:** SAGE canonical future-state document says no software exists, but implementation in `packages/sage-core` and `apps/platform-admin` is real. Documentation must distinguish historically planned state from current code, deployment and permission.
- **C03:** OCI method code resides partly in Union Eyes, but commercial work must proceed independently. Single neutral interface contract + parity harness needed before shared-code extraction; UE-specific customer authority rules must not be imported as if they governed public institutions.
- **C04:** OCI pricing scope driver mentions bargaining units/sites; public institutions may require equivalent canonical scope dimensions. No new price or scope-driver amendment without owner decision in sole price table.
- **C05:** Runtime role checks and client-facing authorization can diverge. Fix actor-classification and prove institutional mandate separate from platform membership/role.
- **C06:** Existing SAGE evidence references are visibility-gated but not sufficient to prove source authority or disagreements; define attestation and conflict artifacts without AI self-certification.
- **C07:** Historic launch proof is not a live deployment state; re-check migrations, telemetry, restore, accessibility and client experience.
- **C08:** Historical manual kit/blueprint states are not operational evidence; update source-to-reality index, not doctrine ad hoc.

## 10. Work packages — implementation intentionally NOT begun

L0: approved contract/ceiling, method source map, product information architecture, R/D/T and persona-action test specification.

L1: SAGE runtime correctness, staging migration, identity/route fixes, deployed RLS and service proof.

L2: institution-bound authority, attested provenance, contradiction and challenge model as a SAGE-owned domain extension; preserve CIVIC synthetic kernel and UE authority-model semantics as reference contracts, without direct cross-app runtime imports.

L3: CLEAR execution, human adoption, resource/commitment/outcome and executive packages.

L4: authorized CIVIC app UX and multilingual/mobile accessibility.

L5: versioned institutional configuration/onboarding, integration references, succession/exit.

L6: operational release gates, telemetry, incident, restore, notification, retention/destruction, support.

L7: fictional tool demonstration, contractual client pilot boundary, UAT, service model and genuine client acceptance.

Work packages can proceed in parallel after founder acceptance and C1 constitutional authorization. One owner integrates shared schema, identity, audit and method API changes; UE has priority ownership over currently active UE Step 1 paths. No branch collision, retroactive deployment claim or speculative connector required to qualify the first release.

## 11. Gate sequence

- **C0 Design:** Founder accepts D01–D34, dispositions C01–C08, interface maps, R/D/T acceptance; version anchored.
- **C1 Authorization:** Owner-authorized bounded implementation scope clears CIVIC constitutional guard; explicit environment/data/personas; historical synthetic grants remain terminated.
- **C2 Core:** Live SAGE staging, migration, auth, evidence and audit refuse invalid access and admit legitimate flows.
- **C3 Product:** R, D, T each PASS with executable honest negative proof and unchanged canonical OCI/CLEAR.
- **C4 Operations:** No critical SAGE security/incident/backup/records gates unproven. Deployed manual EN/FR/accessibility accepted.
- **C5 Client:** Institution-specific mandate and data protections, signed scope, real-actor UAT and a supportable exit.
- **C6 Release:** Named owner GO on exact tenant, revision and capability, distinguishing fictional demo, limited pilot and production.

## 12. Review posture

This document is a product ceiling **proposal**, not a record of a new founder signature. Creating it does not amend protected runtime authority, prices or constitutional doctrine, and does not authorize a product rollout. External reviewers provide later validation and amendment requests; internal engineering uses the accepted versioned contract as its stable target.

**Primary source links:** `docs/oci/OCI_METHOD.md`; `docs/oci/CANON.md`; `docs/oci/oci-product-ladder.md`; `docs/oci/OCI_DELIVERY_MODEL.md`; `docs/public-service/clear-method-canonical.md`; `docs/public-service/sage-workspace-canonical.md`; `docs/CIVIC_OCI_ALIGNMENT.md`; `governance/foundations/civic-oci-doctrine.contract.json`; `docs/public-service/operations/three-reality-hardening-report.md`; `docs/public-service/operations/proof-runs/005-sage-operational-launch-evidence/07-gate-reassessment.md`.

## 13. Engineering reuse disposition (additional source verification)

- `apps/civic/src/kernel.ts` already implements a bounded synthetic kernel that separates actor, position, instrument, delegated authority, evidence types, interpretation, intervention, expected/observed measures and human decision. Its `syntheticOnly` and `assertRuntimeAuthorization()` protection are intentional and **must not** be stripped or promoted to production without C1. Treat it as a formal reference for R/D/T behavior and acceptance fixture design, not as a deployed or licensed runtime.
- `apps/union-eyes/lib/authority/ontology.ts` defines a substantial UE-specific authority model with capacity, mandate, relationship, delegation, recusal and consent. It provides proven design concepts but its `case`, `member` and other union resource policies cannot directly govern CIVIC institutions. No live UE Step 1 changes are part of this plan.
- **Placement decision:** new institutional production authority/provenance invariants should be SAGE-owned within `packages/sage-core` (additive namespaced modules), consuming only existing neutral platform contracts. Create a new shared generic package *only* if an independently approved extraction demonstrates substantive reuse and UE semantic parity. This resolves the earlier ambiguity between building another authority package and extending SAGE.
- The existing `packages/institutional-governance-graph` is a read/projection substrate, not a substitute for mutation authority or record attestation. Do not turn it into an uncontrolled write path.
