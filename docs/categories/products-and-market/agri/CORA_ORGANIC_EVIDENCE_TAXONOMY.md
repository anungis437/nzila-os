# Cora Organic Evidence Taxonomy

**Status:** design contract and local Zod/domain model; no production evidence
registry or source ingestion is enabled.

## Evidence, not conclusion

The governed fact is `organic.certification.status`: a source institution
reports a status about an operator and a certification. It is not a Cora
determination that the operator is certified. A recipient institution may
make its own eligibility or purchasing decision separately.

The local contract is
[`apps/cora/lib/organic-evidence/contracts.ts`](../../../../apps/cora/lib/organic-evidence/contracts.ts).
It is additive to the generic, authorization-gated Cora Evidence Foundation;
it does not create a persistence adapter, route, job, or runtime registry.

## Fact classes

The first class is `organic.certification.status`. Optional supporting
classes, which a source need not all provide, are:

- `organic.certification.certifier`
- `organic.certification.program`
- `organic.certification.scope`
- `organic.certification.product`
- `organic.certification.issue_date`
- `organic.certification.validity`
- `organic.certification.standard`
- `organic.certification.standard_version`

Missing fields remain missing. Unknown is a valid and explicit state.

Evidence from public-trust research is a separate stream, not a
certification-status fact or regulatory determination. A CCFI-derived
observation, when independently authorized and used, retains the study/report,
methodology, publication and observation dates, sample, geography, question
wording/context, funder/context, limitations, and source reference when
applicable. A survey finding remains attributed, bounded evidence; it is not
`OBJECTIVE_UNIVERSAL_PUBLIC_TRUTH`. CCFI is non-blocking to Canada Organic
Alpha and no CCFI collection or runtime path is enabled. See the [Cora
Institutional Control-Point Map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md).

## Observation envelope

Each observation retains:

- stable evidence ID and fact class;
- operator reference (not an inferred identity);
- mandatory source institution ID and source role;
- source system, source record/reference, and optional URI;
- exact `rawStatus` for status observations; raw source values for other facts;
- optional normalized status, always separate from source vocabulary;
- observed time with distinct `KNOWN`, `UNKNOWN`, or `INVALID` states;
- source publication time, if available, separately from observed time;
- applicable standard identifier/version where established;
- evidence level, so a directory assertion remains `DIRECTORY_STATUS` and is
  not confused with `CERTIFICATE`;
- source certification program, scope and products where the source provides
  them;
- source registry reference and separate source record creation/update
  metadata;
- source availability, freshness, provenance edges, source rights, and optional
  content digest.

Record creation, source publication, fact observation, and Cora collection
times have different meanings; they must not substitute for one another.
Public display/update cadence is source metadata, not a disclosure or
authorization freshness threshold.

## Pro-Cert directory boundary

The offline Pro-Cert adapter is a deterministic allowlist projection of a
source-shaped record. It keeps registry identity, raw status, program, scope,
products, an explicitly supplied status-observation timestamp, and source
record creation/update timestamps as separate metadata. Unknown input fields
are dropped. It has no HTTP client, live-record fixture, scheduler, persistence
path, or runtime registry entry.

Only the explicit `statusObservedAt` input can populate `observationTime`.
Missing time remains `UNKNOWN`; malformed time remains `INVALID`. Neither
`sourceCreatedAt` nor `sourceUpdatedAt` is promoted to status observation
time. The reviewed directory states that it is updated daily, but does not
establish that cadence as a per-record observation time or freshness interval.
With no explicit evaluation policy, a valid timestamp remains
`FRESHNESS_POLICY_UNSET`.

Pro-Cert's visible directory status wording is retained exactly as raw source
text. No production status mapping is supplied; normalization requires an
explicit mapping with authority, mapping ID and version. Synthetic positive
mappings and freshness thresholds exist only inside isolated tests. The
directory page says it is informational and not a replacement for current
supplier certificates, so its output is marked `DIRECTORY_STATUS`.

The source's stated COR, NOP and COS programs remain source context, not
interchangeable certification scopes. CFIA's publication mandate and
Pro-Cert's verified accreditation scope support a COR publication-authority
basis only; publication does not establish access, reuse, or republication
rights.

## Raw and normalized status

The source vocabulary is never discarded. The contract retains `rawStatus`
exactly and optionally carries a separate normalized status with its mapping
authority, mapping ID, and version. Normalization is exact-match only:

- no map, ambiguous map, or unfamiliar source wording returns `UNKNOWN`;
- no unknown status maps to `CERTIFIED`, `active`, or any other positive state;
- terms such as `WITHDRAWN`, `CANCELLED`, and `REVOKED` remain distinct unless
  an identified authority explicitly approves a versioned semantic mapping.

The normalizer requires mappings as an argument and ships no production
mapping registry. All positive mappings in tests are synthetic and isolated.
Production meanings and allowed values remain subject to source authority;
the C1/C2 decisions remain open.

## Freshness

Supported states are `CURRENT`, `STALE`, `SOURCE_UNAVAILABLE`,
`OBSERVATION_TIME_UNKNOWN`, `INVALID_OBSERVATION_TIME`,
`FUTURE_OBSERVATION_TIME`, and `FRESHNESS_POLICY_UNSET`.

Classification requires an explicit `maxAgeMs` input; this contract does not
provide or choose a production interval. Exact-boundary behavior is
deterministic: an observation whose age equals the supplied maximum is
`CURRENT`; only an age greater than the maximum is `STALE`. Future, invalid,
missing timestamps and absent policy cannot be treated as current. Source
unavailability is never transformed into a cancellation or another status.

## Conflicts and multiple sources

Observations are retained individually. A summary classification may be
`CONSISTENT`, `CONFLICTING_AUTHORITIES`,
`CONFLICTING_OBSERVATIONS`, `STALE_SOURCE`, `SOURCE_UNAVAILABLE`,
`UNRESOLVED_SEMANTICS`, `UNRESOLVED_FRESHNESS`, or `NO_EVIDENCE`.
The classifier has no authority hierarchy and never selects a winner.

For example, a certification body may report `Certified`, an aggregator may
report `Suspended`, and a regulatory enforcement source may publish a separate
`Cancelled`-related action. Cora retains each source assertion and provenance;
it does not silently reconcile the values. Regulatory enforcement evidence
must be modeled as a separate fact/action and must not be rewritten as the
certifier's status.

## Standards and interpretations

Standards are identified by identifier and version, optionally effective date
and transition state. Use identifiers and references only; do not copy
copyrighted standards text. A `STANDARD_INTERPRETATION` has its own authority
and reference, separate from the certification observation it may inform.
Interpretation cannot certify an operator.

## Sector membership

Sector membership is a separate evidence type, distinct from a certification
observation. A COTA membership claim, sector directory listing, or market
research statement is never organic certification evidence merely because it
mentions an operator or an organic product.

The model and tests do not create production status mappings or public
observations. Continue to use synthetic fixtures until a separately approved
public-source proof is authorized.
