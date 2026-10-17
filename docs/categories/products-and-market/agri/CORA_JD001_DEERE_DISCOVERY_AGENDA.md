# JD001 Deere Technical and Rights Discovery Agenda

**Status:** `PREPARED_NOT_AUTHORIZED_TO_SEND`  
**Contact state:** No external communication has been sent.  
**Scope:** Clarify only what Deere's publicly accessible official docs do not
answer for the minimum land graph and its possible rights-cleared continuity.

## Final discovery posture

Contractual rights are the primary discovery track. The public-document
exhaustion record is accepted for design-level work; it is not a production
entitlement or a grant of Cora data-use rights.

The minimum source graph is
`Organization → Client / Farm → Field → Boundary`. Keep Client in the source
graph even if it is not exposed as a Cora-facing canonical object.
`TECHNICAL_CAPABILITY = TECHNICALLY_DOCUMENTED`,
`SEMANTIC_MODEL = SEMANTICALLY_DOCUMENTED`, and
`AUTHORIZATION_MODEL = AUTHORIZATION_MODEL_DOCUMENTED`; production
entitlement, complete schema/identifier semantics, event recovery, and all
contractual rights remain separate gates.

Only the three technical questions below are active technical asks.
Historical reclassification inventories elsewhere in the question sets are
evidence records, not additional outreach questions.

## Purpose

Determine whether the documented
`Organization → Client / Farm → Field → Boundary` graph has a supported
production access path and whether a bounded historical representation can
lawfully be processed, retained, exported, and reused. Deere remains
authoritative for Deere-originated facts. The operator retains consent
authority; Cora remains a coordination/evidence layer; any receiving
institution retains its independent decision authority.

This is not a partnership, procurement, vendor, innovation, or product-pitch
agenda. It does not request access to a live account or producer record.

## Contractual governing question

If an operator authorizes Cora to receive Deere-originated land information,
may Cora preserve a bounded, purpose-limited historical representation so
that the operator can understand and reuse legitimate historical state after
the Deere connection ends?

Request separate written dispositions for each operation; no general answer
may be treated as authorizing a different operation. The initial rights scope
is Organization, Client, Farm, Field, Boundary, and only metadata necessary
for identity, provenance, relationships, timestamps, status, units, and
capture history. Exclude Machine/AEMP telemetry, Field Operations,
Measurements, Products, Operators, Work Plans, Prescriptions, shapefile
exports, and files generally.

## Initial technical routing questions

Ask the Deere Developer Relations / Precision Tech or Operations Center API
product owner only:

1. For Organization, Client, Farm, Field, and Boundary read surfaces, what
   production API base URL, product/license, version/media type, approval and
   entitlement apply? Which connecting-user roles may establish and adjust
   the organization connection?
2. What are the authoritative complete schemas and list filters; ID
   uniqueness/lifecycle semantics; per-object units; and source
   modification-time meanings for those objects?
3. For each selected land event type, what production entitlement and exact
   event schema/filter/scope apply; what event coverage and end-to-end latency
   commitments exist; and what supported recovery/reconciliation path applies
   after an event expires or a gap exceeds the seven-day DSS queue and
   45-day eTag windows? Do not re-ask the documented receiver validation,
   acknowledgement, duplicate/out-of-order, retry, batching, or pause limits.

Do not re-ask public-doc questions about OAuth grant type, scope names and
permission mapping, organization selection through Connections, pagination
basics, eTag mechanics, DSS receiver/delivery mechanics, or public Field
Sync/Field Operations overviews.
These are documented but not live-tested or contract rights.

## Separate contractual and privacy routing

Ask an authorized Deere API contracting/legal owner to identify the current
production agreement and provide a distinct written disposition for
`READ`, `CACHE`, `PERSIST`, `NORMALIZE`, `DERIVE`, `SHARE`, `EXPORT`,
`REHYDRATE`, `RETAIN_AFTER_DISCONNECT`, `DELETE_ON_REVOCATION`, and
`COMMERCIAL_USE`. Include `USE_FOR_AI_TRAINING` only as a rights-boundary
question; no such use is proposed or permitted absent explicit approval.

Resolve retention, producer export, onward disclosure, recipient use,
replacement-provider use, independent rehydration, source correction/deletion,
disconnect/revocation, backups, termination, commercial use, and model-use
restrictions as separate rights. Route operator-linked data and onward
disclosure handling to Deere privacy/data-governance only where that function
is the authoritative owner.

Technical answers cannot establish contractual permission. An OAuth scope,
organization connection, event/signature, Field Sync, partnership permission,
or shapefile download does not grant retention or redistribution rights.

## Answer record

For technical answers, record the exact official URL, API/product version,
data class/operation, production entitlement, account role/scope, schema and
ID semantics, rate/limit behavior, freshness/change/deletion guarantees, and
whether the answer is documentation or tested behavior.

For rights answers, record the authoritative agreement/version/section,
operation/data class, purpose, duration, recipient, conditions, commercial
limits, deletion/backup/post-termination duties, and whether language is
binding.

## Authorization boundary

This agenda is not authorized for transmission. Any future outreach requires
separate human authorization of the exact sender, recipient, channel,
text/version, and scope. No credentials, producer records, live account
review, app creation, or system access may be requested under this agenda.
Discovery itself authorizes no application, source access, pilot, or runtime
work.

See the [technical question set](CORA_JD001_DEERE_TECHNICAL_QUESTION_SET.md),
[rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md), and
[discovery gaps](CORA_JD001_DISCOVERY_GAPS.md).
