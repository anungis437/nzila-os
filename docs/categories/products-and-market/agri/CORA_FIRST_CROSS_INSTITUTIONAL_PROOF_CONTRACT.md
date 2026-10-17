# Cora First Cross-Institutional Proof Contract

**Status:** design-only proof contract; second consumer unresolved. No source,
institution, operator, permission, or runtime workflow is selected or
activated by this document.

## 1. Proof question and boundary

**V3 alignment:** the [stress-test framework](CORA_STRESS_TEST_FRAMEWORK.md)
governs new route qualification; this bounded proof is not a required
Certification Body -> Producer -> Recipient transmission path. Operator
control/authorization applies only where the actual evidence relationship
requires it. Consent is not universal, and lawfully carrying a minimized
certificate with its envelope is not prohibited by the reference design.
Its second consumer is not Candidate Handoff B; B remains PENDING_CFA_SELECTION.
Existing synthetic proofs remain synthetic, not CFA/recipient findings.
The 30% latency criterion below belongs to this earlier bounded proof only;
stress-test thresholds require their own prospective preregistration.
All new comparison work must use the best legitimate direct-source baseline
and DIRECT_SOURCE_BASELINE_SUFFICIENT falsifier, not a weak PDF/re-entry proxy.
No source rights or execution gate is changed.

The proof asks one question:

> Can the same authoritative evidence be legitimately reused in a second
> independent institutional context without reconstruction, while preserving
> source authority, recipient decision rights, operator control, provenance,
> scope, context, and permissions?

The proposed first context is a bounded Canada Organic Alpha requirement
context. Its receiving institution, precise rule, acceptable evidence,
decision period, and decision authority must be populated from an actual
institutional requirement before any proof is instantiated. This contract
does not invent them.

The second consumer is deliberately **unselected**. It must be a different
institution from the first recipient, with a distinct mandate and a genuine
decision requirement. A second user, tenant, workflow, screen, or copy inside
the same institution does not establish institutional independence.

The evidence-qualified comparison and the discovery required before selection
are recorded in the [Second-Consumer Evidence Ledger](CORA_SECOND_CONSUMER_EVIDENCE_LEDGER.md),
[Selection Matrix](CORA_SECOND_CONSUMER_SELECTION_MATRIX.md), and
[Discovery Gaps](CORA_SECOND_CONSUMER_DISCOVERY_GAPS.md). They do not select
a consumer or authorize outreach.

The proof is about the portable, source-attributed evidence envelope and its
legitimate use against two separately governed requirements. It does not prove
that an operator is universally certified, eligible, qualified, funded, or
preferred. Cora reports source evidence and technical resolution states; each
institution makes and owns its own decision.

## 2. Parties, evidence, and decision rights

| Contract role                | Definition                                                                                                                                                                                | Non-transferable boundary                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source institution           | The accredited organic certification body that made or maintains the certification assertion. Accreditation and scope must be independently evidenced for the relevant scheme and period. | The certifier remains authoritative for its own certification/status assertion and corrections. An aggregator, Cora, or recipient cannot replace that authority.                     |
| Economic actor               | The producer, operator, or processor that is the subject of the assertion, using an explicitly bound source identity.                                                                     | Identity must not be inferred from a name match alone. No unrelated producer, site, product, or affiliate is silently included.                                                      |
| Authoritative evidence       | A source-attributed certification/status/scope/provenance record and its immutable evidence reference or permitted digest.                                                                | A directory assertion remains a directory assertion, not a certificate. Cora does not elevate evidence level or infer missing facts.                                                 |
| First consumer               | The actual institution and bounded Canada Organic Alpha requirement context, to be supplied before proof setup.                                                                           | Alpha is a requirement context, not an assumed buyer, government program, or approval authority.                                                                                     |
| Second consumer              | A separately governed institution and independently documented requirement, selected only after discovery and rights review.                                                              | No candidate class or named institution is selected by this contract.                                                                                                                |
| Source authority             | The source institution, within the source's documented role and evidence scope.                                                                                                           | Source authority does not determine recipient acceptance or the operator's separate authorization choices.                                                                           |
| Recipient decision authority | The accountable person/body designated by each receiving institution under that institution's own rules.                                                                                  | Each recipient owns its decision, reasons, conditions, and review/appeal route.                                                                                                      |
| Operator                     | The evidence subject and controller of sharing choices to the extent supported by applicable law, contracts, and source/provider terms.                                                   | Operator permission cannot grant rights that belong to the certifier or another rights holder.                                                                                       |
| Cora                         | Evidence-envelope, authorization, provenance, and resolution support, only if separately approved and implemented.                                                                        | Cora must never certify, accredit, adjudicate eligibility, decide procurement/funding, resolve an authoritative conflict, or convert technical matching into institutional approval. |

## 3. What counts as reuse

A **cross-institutional reuse event** exists only when all of these conditions
are evidenced:

1. One source evidence assertion is identified by a stable evidence
   reference and source record identifier. Its source attribution, scope,
   context, and provenance are retained; the second context does not require
   the operator to recreate the assertion from memory or re-enter its source
   facts.
2. The actual governing authority/access mechanism permits the second
   institution, named purpose, evidence scope and applicable period, subject
   to source/provider rights. Operator authorization is recorded where required,
   not presumed for every public institutional fact. The authority is
   inspectable and auditable. A source's publication or an operator's consent
   alone is not treated as the other party's permission.
3. The second institution independently maps the same evidence reference to
   its own requirement and records its own decision. It may reject the
   evidence, request verification, or reach a different outcome from the
   first institution.
4. The receiving institution can trace the presented evidence to its source
   and relevant retrieval/observation context without a reconstructed claim
   that obscures the original assertion.
5. The event records the exact version/reference used, purpose, recipient,
   authorization basis, evidence scope, resolution state, and recipient
   disposition, without creating an unapproved source copy or a general
   reusable profile.

The following alone do **not** count: copying a PDF or screenshot; publishing the
same data in a second directory; retyping/re-uploading an assertion;
re-fetching or revalidating the source independently for each context without
reusing the same evidence reference; two departments within one institution;
or sharing without separate purpose/recipient authorization.

Reuse does not mean unlimited persistence. If a right-cleared design cannot
reuse a reference or permitted evidence package while preserving the source's
conditions, the contract records that constraint; it must not work around it
with a shadow copy, cache, scraping, or data lake.

## 4. Evidence contract

Before an evidence item can be considered for either requirement, its
contract must represent the fields below as evidenced values or explicit
unknown/unavailable states. Missing values remain missing. A field that does
not apply is marked not applicable with a reason, not silently omitted.

| Field                          | Required meaning                                                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source institution and role    | Legal/institutional identity, role, accreditation/scheme context, and evidence that supports the role for this assertion.                                                                                                                |
| Source record identifier       | Stable source reference and identifier, URI only if permitted, and identifier/alias semantics.                                                                                                                                           |
| Economic actor binding         | Explicit source-to-actor identity binding, the bound operator/site scope, and its basis; ambiguity remains unresolved.                                                                                                                   |
| Scheme and program             | Exact scheme/program as stated by source; do not conflate COR, NOP, COS, or another program.                                                                                                                                             |
| Status assertion               | Exact raw source status and evidence level. Any interpretation/mapping is separately versioned, attributed, and authorized; no production allowlist is supplied here.                                                                    |
| Certification scope            | Products, categories, locations, and limitations only as the source provides them.                                                                                                                                                       |
| Effective dates and expiry     | Source-defined issuance/effective/expiry dates; preserve unknowns and timezone/precision where present. Do not infer currentness from a publication cadence.                                                                             |
| Methodology/standard           | Standard identifier/version, effective and transition dates, and interpretation authority/reference where relevant; do not reproduce protected text.                                                                                     |
| Provenance                     | Originating record, source authority, intermediate aggregators (if any), transformations, evidence level, permitted digest/reference, and chain of custody. An aggregator never replaces the origin authority.                           |
| Retrieval and observation time | Distinct source-defined status observation/update time, source publication time, and any retrieval/check time. Creation time, page refresh, and collection time cannot substitute for status observation time.                           |
| Limitations and uncertainty    | Source caveats, known gaps, conflict, stale/unavailable state, identity uncertainty, and any prohibition on treating a directory as a certificate.                                                                                       |
| Permissions                    | Independently evidenced source access, collection, processing, retention, internal reuse, onward disclosure, attribution, and deletion conditions; operator authorization for the named recipient/purpose; and recipient handling basis. |
| Correction/dispute             | Source correction/contact route, dispute state, correction timestamp if known, and each recipient's own challenge/review route. Pending disputes are visible as such and are not silently resolved by Cora.                              |

The Phase 2B outcome remains authoritative:
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`, and
`PHASE_3_PERMISSION = NONE_GRANTED_BY_THIS_REVIEW`. Pro-Cert remains a
candidate by institutional priority only; Ecocert remains an alternative
requiring its own rights review. No source permission or live proof is created
here.

## 5. Requirement contract

Each receiving context must independently complete this contract before
evidence is evaluated:

| Field                  | Required evidence                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receiving institution  | Named legal/institutional entity, unit, and accountable decision authority.                                                                                                  |
| Purpose                | Specific, bounded purpose and named actor/process using the evidence.                                                                                                        |
| Rule/requirement       | Exact policy, procurement/program rule, or other requirement identifier/version and applicable jurisdiction.                                                                 |
| Acceptable evidence    | Evidence classes and issuer roles accepted by that institution, including whether directory evidence is sufficient or a certificate/primary-source verification is required. |
| Decision period        | Start/end or decision event, evidence validity period, and re-check trigger as defined by the recipient; no Cora-selected freshness interval.                                |
| Decision authority     | Named role/body with authority to accept, reject, request more evidence, or defer, plus the recipient's review/dispute route.                                                |
| Operator authorization | Evidence of the operator's authorization for this recipient, purpose, scope, and period where required; limitations and prospective revocation path.                         |
| Unresolved conditions  | Explicit unknowns, required verification, source restrictions, conflict, or pending legal/governance decisions. Unknown is not consent or acceptance.                        |

No common universal requirement is imposed across consumers. Two recipients
may use the same evidence while applying different requirements and reaching
different decisions.

## 6. Authorization and actor control

Before any future live proof, the operator-facing authorization must be
specific enough to show:

- who will receive which evidence, for what purpose, and for what period;
- which fields and scopes are included or excluded;
- whether the recipient may inspect, verify, retain, export, or disclose any
  part of the evidence, and on what separately established basis;
- how the operator can inspect the authorization and the record of each
  disclosure, narrow or revoke future sharing, and request correction;
- what revocation can and cannot do, including that it prevents future
  authorized disclosures but cannot erase a recipient's prior lawful
  independent record or reverse a decision already made;
- how the operator can obtain a copy/export of the operator's authorization
  and permitted evidence package, subject to source rights and security; and
- clear language that Cora presents evidence and resolution, not a guarantee
  of acceptance or eligibility.

The proof must not imply that the operator controls the source's original
record, can override source licensing/terms, can force a recipient to accept
evidence, or can compel deletion from a recipient where another lawful basis
requires retention. These limits must be disclosed before authorization.

## 7. Resolution states

Resolution describes evidence-to-requirement comparison, not the institution's
final decision:

| State            | Meaning                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MATCHED`        | Available, authorized evidence meets the specifically stated evidence requirements for the comparison. This is not an approval or eligibility finding.             |
| `PARTIAL`        | Some required evidence or scope is present, but at least one requirement remains unmet or unverified.                                                              |
| `UNKNOWN`        | Evidence or requirement meaning is missing, ambiguous, unavailable, or not established.                                                                            |
| `CONFLICT`       | Relevant source assertions or evidence conflict and no authority entitled to resolve the conflict has done so.                                                     |
| `EXPIRED`        | Evidence or authorization is outside an explicit source/recipient/operator-defined validity period. No duration is selected by Cora.                               |
| `NOT_AUTHORIZED` | One or more required source, operator, recipient, purpose, or handling permissions are absent, expired, or insufficient.                                           |
| `NOT_SATISFIED`  | The available evidence fails a specific, versioned receiving requirement. The reason must identify the requirement; this is not a general finding about the actor. |

`MATCHED` and `NOT_SATISFIED` are requirement-relative technical states.
Recipient outcomes such as approved, rejected, accepted, certified, eligible,
funded, or qualified may only be recorded as the exact decision returned by
the institution authorized to make it, with that institution's authority and
provenance. Cora must not generate or imply those outcomes.

## 8. Candidate-independent proof procedure

The procedure is a design for a later separately authorized proof, not
permission to execute it:

1. Document the actual bounded Alpha requirement and responsible first
   recipient.
2. Discover and document potential second-consumer requirements without
   treating interest, institutional name, or strategic alignment as
   acceptance.
3. Select a specific independent institution only when its mandate,
   requirement, evidence acceptability, decision authority, and willingness
   to evaluate the envelope are evidenced.
4. Obtain separately sufficient written source permissions for the proposed
   access method, minimum fields, individual-record scope, processing,
   retention/deletion, attribution, and the two named institutional purposes.
   Record unresolved conditions; a prepared inquiry or public listing is not
   permission.
5. Establish the operator's informed, granular authorization and each
   recipient's independent handling basis. Confirm how correction and
   prospective revocation are honored.
6. Only after independent go/no-go approval, test one bounded operator and
   one source assertion against both requirement contracts. Do not fetch a
   live record before every required approval and permission is on file.
7. Measure the success criteria below, preserve recipient decisions
   separately, and stop immediately on any failure criterion.

## 9. Measurable success criteria

All thresholds below are proposed acceptance criteria for a future,
independently approved proof. They are not current performance claims,
production policies, legal determinations, or authority to collect data.

| Dimension                       | Passing threshold and evidence                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reconstruction avoided          | For the one proof case, zero operator re-entry/re-upload of the source assertion and zero manual reconstruction of its status/scope/provenance; both contexts resolve to the same stable source evidence reference/version.                                                                                                                                |
| Provenance preserved            | 100% of mandatory evidence-envelope fields that are available and permitted are present or explicitly marked unknown/not applicable; source role and origin reference are traceable end-to-end; zero dropped or silently transformed source qualifications.                                                                                                |
| Scope and context preserved     | 100% of the first and second requirement's scope, program, validity period, limitations, and unresolved conditions are recorded; zero unsupported cross-program or cross-site inference.                                                                                                                                                                   |
| Operator control preserved      | 100% of required authorizations identify recipient, purpose, fields/scope, and period; operator can inspect the authorization and event record; prospective revocation blocks every subsequent proof disclosure; zero disclosure beyond authorized scope.                                                                                                  |
| Recipient decision independence | Both recipients record their own distinct requirement mapping and disposition, including defer/reject if applicable; neither decision is copied, inferred, or set by Cora; disagreement is preserved.                                                                                                                                                      |
| Evidence reuse                  | At least two distinct institutions evaluate one immutable evidence reference/version under separately documented requirements and authorization. Zero duplicated operator entry or fabricated replacement evidence.                                                                                                                                        |
| Latency                         | Against a time-and-action baseline gathered from the same two institutions using their existing process, the proof reduces median evidence-preparation elapsed time by at least 30%, with start/end definitions and the same task boundaries recorded. If no comparable baseline can be observed, report latency as unproven rather than claiming success. |
| Implementation burden           | Each institution can evaluate the envelope using its documented requirement and no more than one institution-specific mapping/configuration; zero bespoke source connector per recipient and zero recipient-side re-entry of source facts. Record staff actions and integration changes.                                                                   |
| Second-context acceptance       | The second institution's accountable decision authority confirms in writing that the evidence envelope/reference is acceptable for evaluation of the named requirement and records an actual requirement-relative disposition. Interest, a usability review, or a technical `MATCHED` state alone does not pass.                                           |

The proof is a single-case feasibility result, not a representative impact
study. No general time-saving, adoption, burden-reduction, or market claim may
be made from one case.

## 10. Failure criteria and stop conditions

The proof is invalid or must stop and be redesigned if any of the following
occurs:

- source rights or any required onward/internal use, retention, or verification
  permission is missing, ambiguous, expired, or inconsistent with the
  proposed method;
- no actual independent second institution, requirement, decision authority,
  or evidence acceptance rule can be established;
- operator identity, authority to authorize, purpose, scope, or recipient
  authorization is ambiguous or exceeds rights;
- the two contexts require reconstructed or re-entered source facts instead
  of the same evidence reference/version;
- origin, source role, program, scope, qualifications, timestamps,
  limitations, correction state, or permission conditions are lost or
  conflated;
- record creation, directory refresh, retrieval time, or display freshness is
  represented as status-observation freshness without source-defined
  semantics;
- evidence conflicts, is stale/expired, or is inadequate and the system
  resolves it by hidden inference, source ranking, or status substitution;
- Cora determines or implies certification, approval, eligibility, funding,
  qualification, procurement acceptance, or a universal actor reputation;
- either institution cannot independently reject, defer, request more
  evidence, or record a different decision;
- prospective revocation does not prevent later disclosures, or operator
  inspection/export/correction boundaries are misrepresented;
- the proof requires scraping, bulk collection, general-purpose copying,
  unauthorized retention, a central source-data lake, or a public score; or
- the measurable success thresholds are not met or cannot be measured with
  auditable evidence.

Any stop preserves all original source and recipient assertions. It does not
create a negative certification finding about the operator.

## 11. Rights dependency and no-go boundary

Before a live proof, the following must be established separately and in
writing for the selected source, method, fields, purpose, recipients, and
period:

1. legal/publication basis for the exact certification/status/scope fields;
2. source-authorized access method for the individual record (API, feed,
   licensed download, verification endpoint, bounded web, or manual process);
3. permission for collection/access, internal processing, use in both named
   institutional contexts, and any verification/retrieval;
4. permitted persistence, reference/digest handling, retention, deletion,
   attribution, and correction obligations;
5. limits on redisplay, export, onward transfer, commercial use, and derived
   claims; and
6. operator authorization for the named recipient/purpose and independent
   recipient basis to evaluate and retain its own decision record.

The current Pro-Cert and Ecocert rights states remain unresolved. The Phase
2B findings remain unchanged; neither candidate's public page, search/export
control, daily refresh statement, absence of a robots disallowance, or
prepared message grants the rights above. A request for clarification, if
later authorized, is not proof permission and does not itself permit access.

Explicit no-go boundaries:

- no scraping, crawling, bulk collection, polling, or unsupported access;
- no hidden inference, identity expansion, status substitution, or universal
  truth model;
- no data resale, public reputation/risk score, or unapproved republication;
- no central data lake or source payload copy outside expressly approved
  minimum handling;
- no replacement of the certifier, buyer/procurement authority, government or
  program authority, benchmark authority, research authority, operator, or
  recipient decision authority;
- no CCFI dependency for Alpha, and no CCFI runtime ingestion; and
- no outreach, live-record access, source activation, Phase 3, runtime change,
  or deployment under this contract.

## 12. Institutional validation nodes and relationship limits

These nodes may help test discovery questions; their inclusion is not a
partnership, endorsement, dependency, or authorization. Validate each
potential use through its own mandate, evidence, and consent/permission
process.

| Node                   | Relevant validation question                                                                                    | Contract boundary                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFA                    | Does producer-facing discovery reflect producer burden, agency, and national producer realities?                | No representation that CFA has reviewed, endorsed, or agreed to participate.                                                                                                                                               |
| Guelph / Arrell        | What agricultural and food-system research or translation could inform requirements and outcome interpretation? | A study remains bounded by its method, sample, context, and limitations; no research relationship is presumed.                                                                                                             |
| Waterloo               | What contextual scientific evidence, modelling, governance, or long-horizon attribution is appropriate?         | Models and attribution remain method/authority-specific; Waterloo does not become the certification or recipient decision authority.                                                                                       |
| National Index / David | What aggregate benchmarking and evidence-lineage needs exist, and what aggregation protections apply?           | No named individual or index is selected as consumer; no benchmarking access, data use, or relationship is asserted.                                                                                                       |
| CCFI                   | Could attributed research help evaluate public trust/social legitimacy in a later, separately scoped study?     | `CCFI_ALPHA_DEPENDENCY = NON_BLOCKING`; CCFI is outside minimum Alpha, high relevance only as an Alpha+ hypothesis, and no runtime ingestion is enabled. Trust findings are not certification evidence or universal truth. |

## 13. Current disposition

```text
CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT =
  READY_FOR_DISCOVERY; SECOND_CONSUMER_UNRESOLVED
SECOND_CONSUMER = NOT_SELECTED
LIVE_PROOF = NOT_AUTHORIZED
PHASE_3_PERMISSION = NONE_GRANTED
RUNTIME_INGESTION = NOT_ENABLED
```

The design is ready to guide bounded discovery, not to execute a proof or send
outreach. Before any source outreach intended to enable this proof is
justified, the internal discovery record must establish: (1) the actual
bounded Alpha requirement, first recipient, and decision authority; (2) at
least one candidate second institution's concrete requirement, mandate,
decision authority, evidence-acceptance criteria, and willingness to assess
the evidence envelope; (3) the minimum evidence fields and purpose needed for
both contexts; (4) a producer-burden/agency discovery basis that does not
assume institutional representation; and (5) an accountable, authorized
sender and a narrow request aligned to the candidate use. Source permissions,
operator authorization, recipient handling basis, and a separate human
go/no-go remain mandatory before live access or proof.

This is not a change to the Phase 2B blocked-rights decision, any human
governance state, or Cora's capability truth.

## Related doctrine

- [Second-consumer evidence ledger](CORA_SECOND_CONSUMER_EVIDENCE_LEDGER.md)
- [Second-consumer selection matrix](CORA_SECOND_CONSUMER_SELECTION_MATRIX.md)
- [SCIC public-evidence qualification](CORA_SCIC_PUBLIC_EVIDENCE_QUALIFICATION.md)
- [Buyer public-evidence qualification](CORA_BUYER_PUBLIC_EVIDENCE_QUALIFICATION.md)
- [Second-consumer handoff reconstruction](CORA_SECOND_CONSUMER_HANDOFF_RECONSTRUCTION.md)
- [Second-consumer discovery gaps](CORA_SECOND_CONSUMER_DISCOVERY_GAPS.md)
- [Organic institutional authority graph](CORA_ORGANIC_INSTITUTIONAL_GRAPH.md)
- [Organic source decision](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md)
- [Organic public source registry](CORA_ORGANIC_PUBLIC_SOURCE_REGISTRY.md)
- [Organic evidence taxonomy](CORA_ORGANIC_EVIDENCE_TAXONOMY.md)
- [Certifier data-access request](CORA_ORGANIC_CERTIFIER_DATA_ACCESS_REQUEST.md)
- [Institutional control-point map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md)
