# CIVIC / CLEAR / SAGE — Adversarial Product-Ceiling Acceptance Contract

**Record:** CCS-ADV-2026-11-23 · **Status:** C0 owner-accepted design review / acceptance tests NOT executed · **Companion:** [Ceiling](CIVIC_CLEAR_SAGE_CEILING_FREEZE_2026-11-23.md) and [Parallel roadmap](CIVIC_CLEAR_SAGE_PARALLEL_DELIVERY_ROADMAP_2026-11-23.md). **Release/production:** NO_GO unchanged.

The purpose of this record is to expose missing product decisions **before** implementation and turn them into deterministic cross-persona scenarios. Methodological external critique occurs after presentation of the functioning fictional tool; client permissions and legal/records approval are still required before use of genuine data.

## 1. Pre-existing demonstration assets — retain and upgrade

The founder's earlier offline CIVIC concept and `CIVIC_Methodology_Review_Workbook_2026-10-29.xlsx` contain three illustrative use cases, journey steps and authority/privacy guardrails. They are prior **concept** assets, not a production app, completed external validation or confirmed customer pilots. Preserve scenario intent; rebuild their core behaviors within a real governed staging tool rather than displaying simulated role switches as authorization proof.

| Fictional case | Story / risk | Product proof |
|---|---|---|
| **P01 — Alder Civic Services Office** | Workflow redesign: initial **CAD 40,000** authorization; delegation threshold later changes to **CAD 30,000**; a **CAD 15,000** extension is proposed. Training acceptance incomplete; competing explanations for delay. | Past approval remains evaluated under valid historical mandate; proposed extension uses current mandate and amount aggregation policy; receipt != acceptance; no invented completion; executive must decide. |
| **R01 — Harbour Professional Councils** | Two invented regulators consolidate activities, retaining distinct old bylaws, records and authority. | Both histories remain versioned, access bounded by original owners; an adopted successor instrument specifies any new permission/custody; no automatic role inheritance or historical rewrite. |
| **S01 — Intergovernmental Health Secretariat** | Rotating chair confronts an old external review, multi-year agreement, prior strategic rejection and later proposal, with missing handover. | Incoming leadership sees authorized prior reasons, what changed, what remains contested and current obligations, without silently inheriting all old confidential material or treating previous choice as eternally binding. |

Use all three as **compulsory** golden journeys. Add a fourth synthetic **professional-services accountability chain** based on the existing three-reality hardening report, which spans authority, resource commitment, deliverables, expected vs observed measure, variance, missing spend and competing interpretations.

**Presentation sequence:** (1) show a fully working **P01** decision and evidence chain; (2) demonstrate **S01** successor briefing; (3) show **R01** controlled institutional transition; (4) show direct denials for a revoked delegate, unauthorized outside reviewer and changed-source claim. After the tool is demonstrated, use the review workbook to record expert critique; don't present the workbook as a validated assessment. All records are fictional.

## 2. Constitutional design challenge — decisions resolved for architecture

**Challenge: CIVIC public front door vs software product.** Decision: leave first-touch CIVIC brief as currently governed; create separately explicitly authorized product demonstration and institution-only workspace. No live CIVIC route may be added while `runtimeAuthorization.authorized = false`. A first-touch visitor does not get a disguised pilot.

**Challenge: SAGE is already implemented, but doc says 'future only'.** Decision: method/direction document remains canon for purpose and restrictions; current repository source inventory and deployed release evidence determine implementation truth. Do not reset proven SAGE code or infer availability from its existence.

**Challenge: shared authority vs UE fragility.** Decision: preserve UE's institutional kernel under its owner during Step 1, use its semantic rules as design inputs and non-regression criteria, not as direct UE domain import. Production CIVIC authority extends SAGE with neutral contracts. Existing `apps/civic/src/kernel.ts` is synthetic proof source, never live by bypass.

**Challenge: government entity vs tenant hierarchy.** Decision: contracting institution = security root. A service program, jurisdiction, unit or site is an authorized scoped sub-entity. Two merging institutions keep distinct origin tenant/provenance/mandates until a documented legal/administrative transfer; a new successor institution may link only explicitly authorized references, not silently inherit all rows/roles.

**Challenge: OCI score vs CLEAR no scoring.** Decision: OCI/OCRA's single canonical numeric assessment remains where already authorized, while CLEAR is an evidence interpretation and human-review method. No independent CLEAR outcome score, certification, institution leaderboard or synthetic institutional endorsement.

**Challenge: real public-institution procurement and licensing.** Decision: use the canonical OCI commercial ladder and buyer scope mapping. No SAGE-only or CIVIC per-seat fee. A future public-institution scope-driver amendment must be made in the canonical OCI price owner, not quoted as a novel price in presentation.

**Challenge: consultant/firm partner conflict.** Decision: referral partners and external facilitators act with time-limited purpose grants and documented commercial independence/conflict declarations; they never see a tenant's restricted evidence or approve institutional decisions merely by being paid by Nzila.

## 3. Authority and control scenarios

| Test | Setup | Required outcome |
|---|---|---|
| A01 | Authorized actor holds active mandate under current institution | Permitted only for exact action/resource/valid time and evidence tier; audit bound |
| A02 | Tenant admin with no institutional mandate | Refuse institutional ratification, even if admin can configure workspace |
| A03 | System account/AI asks to adopt, approve, delegate or certify | Refuse without workaround |
| A04 | Acting officer's delegation expires between view and submit | Recheck at transaction commit, refuse, no half-write |
| A05 | Historical P01 approval before threshold reduction | Preserve valid historic approval and period evidence; do not retroactively rewrite it |
| A06 | P01 new extension requested after threshold change | Evaluate current source authority, combined commitment and relevant rule; no automatic approval |
| A07 | Creator/approver conflict and self-review forbidden by client policy | Refuse or route to a genuinely permitted institutional reviewer |
| A08 | Employee changes position, leaves, or is suspended | Revoke old capacity, files, links, export, search and async access; successor gets explicitly adopted rights only |
| A09 | Tenant or platform administrator queries another institution | Non-disclosing refusal; incident/audit evidence; no blanket support access |
| A10 | External auditor invited to one review item | Time-limited least-privilege view; restricted or privileged source remains withheld |
| A11 | Two merging regulators share name but different source mandates | Preserve two authorization chains; no combined inferred authority |
| A12 | Court/tribunal, employee/labour, privileged or clinical case material appears | Quarantine/refuse and refer for separately authorized specialist workflow; no inference of permission |
| A13 | Client-specific configuration sets approvals to none in tier 4 | Validation rejects override that weakens canonical high-risk obligations |
| A14 | Sponsor withdraws consent or ends pilot | Stop collection, restrict ongoing processing, apply records/holds, produce authorized exit package |

## 4. Evidence and methodology scenarios

| Test | Challenge | Required outcome |
|---|---|---|
| E01 | User writes 'authoritative' in an ordinary note | Remains unverified/interpretive; cannot turn into attested source |
| E02 | Source reference has wrong owner, version or occurrence date | Quarantine/reject or mark uncertain; no silent auto-correction |
| E03 | Two sources conflict about acceptance of a deliverable | Both survive with separate confidence and provenance; no generated verdict |
| E04 | Supplier reports delivered training, institution has receipt but no signoff | 'Received, acceptance unproven'; open evidence task remains |
| E05 | Audited report lists a claim whose source has been revoked | Regenerate/redact appropriate current view; prior approved snapshot retains restricted custody/audit as allowed |
| E06 | Reviewer and subject disagree about rationale | Allow challenge, rebuttal and explicitly unresolved status; human resolution versioned |
| E07 | S01 old rationale is incomplete | Label missing and distinguish known, inferred and contested; no persuasive fabricated history |
| E08 | An old decision exists but surrounding policy changed | Display historical basis/current changes, force current human decision |
| E09 | AI fails, model provider unavailable or output is unsupported | Core manual flow works and stops unsupported draft, never auto-adopts |
| E10 | AI/synthesis request would include restricted evidence | Filter before model input; no content, derived hints or opaque identifiers leak |
| E11 | CLEAR question escalates from low to rights-affecting | Version, add required independent functions and deny prematurely finalized package |
| E12 | User attempts to give CLEAR a new institutional score | Canon validator rejects independent numeric scoring/band and ranking |

## 5. Executive accountability scenarios

| Test | Problem | Required outcome |
|---|---|---|
| T01 | Fictional services engagement has mandate, plan, commitment, deliverable and measured outcome | One linked chain with real field/record provenance, human ownership and intervention history |
| T02 | Expected review turnaround 10 days; observed 14 days | Show +4 days (40% above target) as deterministic variance, **not evidence that consultant caused delay** |
| T03 | Actual spend missing | Show **missing**; never infer within-budget from commitment ceiling |
| T04 | Two causes plausible (staffing interruption vs incomplete knowledge transfer) | Show unresolved interpretations and evidence needed; no forced consensus |
| T05 | Human sponsor rejects renewal proposal | Preserve rejection, reasons and future review context; cannot silently replace decision |
| T06 | Executive brief generated from counts-only workspace | Fail acceptance because it cannot answer mandate, resources, outcomes, contest and next decision |
| T07 | An unapproved draft brief is emailed | Refuse external delivery; preserve audit/notification denial |
| T08 | Successor receives briefing following leadership rotation | Package includes history, what changed, obligations, uncertainty and valid newly adopted access |
| T09 | Regulator merger changes records custodian | Original references and custody trail survive; transfer requires explicit lawful authority |
| T10 | Evidence links are stale at handover | Mark unresolved and initiate owner request, not promote a broken source to 'verified' |

## 6. Privacy, records, accessibility and operational red team

| Test | Requirement |
|---|---|
| O01 | Tenant isolation at API, SQL/RLS non-owner role, background workers, object keys, exports, signed URLs, search, AI context and logs |
| O02 | Notification retry/concurrency delivers or dead-letters safely, never discloses invite/secret and can be diagnosed |
| O03 | Export/final disclosure rechecks grant, source restrictions and legal hold after approval, before actual access |
| O04 | Destruction under failure, eventual retry and backup restore never resurrects authorized-to-delete material into user access |
| O05 | Real staging telemetry emitted, correlated, PII-scrubbed and found; alert confirmed by named recipient; completed incident drill |
| O06 | Isolated restore reconciles records/hashes and approved RPO/RTO target; rollback safe and version recorded |
| O07 | EN/FR translated status and buttons mean identical *authorizations*, not merely identical text; all critical PDF output rendered in selected language |
| O08 | Keyboard and screen reader perform primary review, challenge, export and handover, and mobile scroll/navigation reaches bottom and error states |
| O09 | Source sync or permission withdrawal in M365/records system is not defeated by stale SAGE local grants, caches or detached offline copies |
| O10 | Canadian residency and legal/privacy representations enumerate real storage, backup, telemetry, mail and AI subprocessors; no default blanket claim |
| O11 | External research/feedback workbook cannot receive real private, privileged, personnel or clinical data; informal critique is not formal study |
| O12 | Partner referral/access model handles procurement ethics, conflict declarations and no vendor-controlled institutional recommendation |

## 7. Mandatory governance and UX decisions that are easy to miss

**Institutional authentication:** allow institutional SSO where available, invitation to bounded external reviewers, MFA for sensitive staff, and support for independently authorized officials who do not have the same identity provider. The product cannot demand a single Microsoft tenant as a premise.

**Recognition ≠ adoption:** signs of evidence completeness are not audit opinions; high source confidence does not make an organization's policy lawful. Use public-sector administrative terminology in UI.

**Data subject/custody:** institution determines and records legal basis, data classes and access/retention; Nzila's role is service operator under documented contract, not owner of the underlying government/legal facts. Third-party source ownership stays visible. Client-specific privacy and Indigenous data sovereignty restrictions are configuration/consent questions to verify, never assumed answered by Canadian Azure region.

**Participation:** a read-only invited expert may critique a fictional demonstration without becoming an institutional approver or researcher of real subjects. This is distinct from a commercial client pilot with lawful data, named authority and a real security/support commitment.

**Historical truth:** never let new policy implicitly invalidate historic decisions, never let historic mandate authorize a new action, and never let a successor be treated as the same principal as a predecessor.

**Service economics:** initial value is traceable continuity and reduced time reconstructing material decisions, measured against a documented manual baseline. Do not promise cost savings, exact time reduction or adoption without real observations.

**Operational limits:** target capacity and latency measurements across the evidence question/brief/export flow; plan for intermittent integrations, stale sources and large historical archives. A request denied for missing data/authority is correct function, not necessarily an engineering defect.

## 8. External presentation and subsequent review

1. Internal staging tool must pass synthetic R/D/T positive and denial journeys.
2. Founder-approved accurate demonstration copy and fictional scenario data; separate permission for any CIVIC product runtime or public offering.
3. Present tool, including contradictions and failures/denials, with no claim of independent legal/method validation.
4. Invite experienced reviewers to critique utility, methodological defensibility, administrative fit, omissions, legal/process assumptions and practical adoption friction; maintain a dated evidence-based feedback log.
5. Product owner classifies feedback as **critical safety**, **method doctrine challenge**, **usefulness/UX**, **institution profile**, or **future backlog**. Canonical method amendments only follow the existing OCI steward process.
6. Only after documented client scope, consent, authority, privacy/records and operational admission may a real institutional pilot begin.

The October 29 workbook contains a proposed qualitative feedback register, which remains a follow-on review instrument. Its blank entries are not evidence of prior reviews or completed validation.

## 9. Decision/acceptance disposition

**Architecture questions:** resolved into D01–D34 and accepted by founder 2026-11-23; test outcomes remain unproven until execution.

**Source proof:** preexisting SAGE and synthetic CIVIC code identified; no source change by this review.

**Execution proof:** A/E/T/O tests are specifications, not a passing suite.

**External method review:** intentionally sequenced after a functioning synthetic product presentation, not an architecture precondition.

**Actual client pilot:** requires separate risk/consent/operational approval and cannot be inferred from prospect interest.

**Hard stop:** no feature development, protected CIVIC runtime change, release, real-data ingestion, or new public procurement claims are authorized by this document alone.
