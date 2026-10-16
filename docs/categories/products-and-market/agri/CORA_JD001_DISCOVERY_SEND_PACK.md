# JD001 Deere Discovery Send Pack — Rights First

**Status:** `PREPARED_NOT_AUTHORIZED_TO_SEND`  
**Contact state:** No external communication has been sent.  
**Access boundary:** No app, credentials, authentication, API call,
Operations Center access, producer account, or producer record.

## Use case and bounded source graph

The discovery concerns a potential producer-authorized historical
continuity use of Deere-originated land information. The minimum source
graph is:

`Organization → Client / Farm → Field → Boundary`

Client remains a source-side relationship even if it is not exposed as a
Cora-facing canonical object. The initial rights scope includes only these
objects and metadata necessary for identity, source provenance,
relationships, timestamps, status, units, and capture history.

Do not include Machine/AEMP telemetry, Field Operations, Measurements,
Products, Operators, Work Plans, Prescriptions, shapefile exports, or files
generally.

`PUBLICLY_DOCUMENTED_API_CAPABILITY != CONTRACTUALLY_PERMITTED_CORA_USE`
and `FARMER_AUTHORIZED != CORA_MAY_PERSIST`.

## Stage 1 — routing inquiry

The [Stage 1 draft](CORA_JD001_DEERE_OUTREACH_DRAFT.md) is under
approximately 120 words. Its sole purpose is to identify the accountable
Deere API product owner and the authorized production-agreement/API
contracting or legal owner. Do not attach this pack or the full rights matrix
to Stage 1. This routing draft is not authorized to send.

## Stage 2 — technical track

Ask only these three technical questions of the accountable API product
owner:

1. **Production entitlement:** For Organization, Client, Farm, Field, and
   Boundary read surfaces, what production API base URL, product/license,
   version/media type, approval/entitlement, and eligible connecting-user
   roles apply?
2. **Complete schema and identifier semantics:** For the same objects, what
   are the authoritative complete schemas and list filters; ID
   uniqueness/lifecycle across rename, move, merge, archive, deletion,
   permission loss, and reconnection; relevant units; and source
   modification-time semantics?
3. **Event completeness and recovery:** For selected land-resource events,
   what production entitlement and exact event schema/filter/scope apply;
   what event coverage and latency commitments exist; and what supported
   reconciliation is available after a gap exceeds the documented seven-day
   DSS failed/paused-delivery window or 45-day eTag retention?

Do not re-ask public-doc questions about OAuth flow, app setup, scopes,
organization selection, permission ceilings, token behavior, pagination,
retry guidance, eTag/signature mechanics, DSS acknowledgement/delivery
mechanics, or Field Sync/Field Operations overviews.

## Stage 2 — contractual track

The governing question for the authorized Deere contracting/legal owner is:

> If an operator authorizes Cora to receive Deere-originated land
> information, may Cora preserve a bounded, purpose-limited historical
> representation so that the operator can understand and reuse legitimate
> historical state after the Deere connection ends?

Obtain separate written answers for `READ`, `CACHE`, `PERSIST`,
`NORMALIZE`, `DERIVE`, `SHARE`, `EXPORT`, `REHYDRATE`,
`RETAIN_AFTER_DISCONNECT`, `DELETE_ON_REVOCATION`, `COMMERCIAL_USE`, and
`USE_FOR_AI_TRAINING`. The six continuity-critical operations and their
architectural consequences are in the
[rights outcome matrix](CORA_JD001_RIGHTS_OUTCOME_MATRIX.md); the complete
action-specific questions are in the
[rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md).

For every operation, capture outcome (allowed/prohibited/conditional/
inconclusive), governing agreement/version/date/section, data classes and
fields, purpose, retention, residency/location, backups, legal hold,
recipient classes, onward disclosure, commercial use, revocation,
termination, deletion, post-termination handling, conditions precedent, and
whether the answer is binding.

### Exit and revocation scenarios

Require distinct answers for operator disconnect, access-grant revocation,
organization-connection removal, source correction/archive/deletion, account
closure, production-agreement termination, and API-product discontinuation.
For each, distinguish future access, required deletion, permitted
historical retention/use, backup treatment, audit obligations, and duties
for downstream copies.

Route privacy/data-governance questions to the authoritative Deere function
when the applicable operator-linked data, residency, onward-disclosure,
deletion, or legal-hold requirements call for it. Privacy review is
conditional on those issues and does not replace contractual authorization.

## Answer record and decision handling

No operation is allowed by silence, a general answer, OAuth authorization,
operator consent, or an answer applying to a different data class or
recipient. Record unsupported or ambiguous answers as `RIGHT_INCONCLUSIVE`;
if a production agreement or entitlement must first be executed, use
`RIGHT_REQUIRES_PRODUCTION_AGREEMENT`. Apply
[CORA_JD001_RIGHTS_OUTCOME_MATRIX.md](CORA_JD001_RIGHTS_OUTCOME_MATRIX.md)
for architectural consequences and the JD001 kill conditions.

## Boundaries and authorization

This is not a vendor pitch, partnership proposal, innovation inquiry, or
procurement request. No change to Deere, certifier, operator, Cora, or
recipient decision authority is proposed. No access to Deere systems or
producer records is requested. No application, authentication, API use,
pilot, or runtime work is authorized.

Every draft in this pack is `PREPARED_NOT_AUTHORIZED_TO_SEND`. Any future
transmission requires explicit human authorization of the exact sender,
recipient, channel, text/version, and scope for each stage. Stage 2 requires
separate authorization after accountable recipients are identified.
