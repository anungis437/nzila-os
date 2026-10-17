# Cora JD001 Public Discovery Gaps

**Status:** Narrow human-discovery preparation only. No Deere outreach has
been authorized or sent.  
**Access boundary:** No app, credentials, authentication, API call, Operations
Center access, producer account, or producer record.

## Current rights-first discovery scope

The public-document exhaustion pass is accepted for design-level analysis.
The minimum Deere source graph remains
`Organization → Client / Farm → Field → Boundary`; Client remains a
source-side relationship even if omitted from a Cora-facing canonical view.
The graph is `TECHNICALLY_DOCUMENTED`, its semantics are
`SEMANTICALLY_DOCUMENTED`, and the authorization model is
`AUTHORIZATION_MODEL_DOCUMENTED`. These states do not establish production
entitlement or permission to process, persist, export, share, or reuse data.

The primary unresolved question is whether Cora may preserve a bounded,
purpose-limited historical representation for operator understanding and
legitimate reuse after the Deere connection ends. Limit that discussion to
the five land objects and metadata necessary for identity, provenance,
relationships, timestamps, status, units, and capture history. Exclude
Machine/AEMP, Field Operations, Measurements, Products, Operators, Work
Plans, Prescriptions, shapefile exports, and files generally.

Only three technical questions remain active: production entitlement;
complete schemas, filters, ID lifecycle, units, and source timestamp
semantics; and selected-event completeness/recovery after the documented
DSS/eTag windows. The prior question inventories are retained as evidence,
not as an expanded ask. See the
[final Deere discovery agenda](CORA_JD001_DEERE_DISCOVERY_AGENDA.md).

## What official public documentation established

- The minimum land graph is semantically documented as
  `Organization → Client / Farm → Field → Boundary`. Client is structurally
  relevant in source relationships, even if not a Cora-facing canonical
  surface.
- Organization/Client/Farm/Field/Boundary endpoints, resource IDs/links,
  selected CRUD operations, permissions/scopes, relationships, status and
  event behavior are described by Deere.
- OAuth 2 authorization-code flow, app/callback setup, Application ID/Secret,
  user-selected organization connections through `connections.deere.com`,
  scope mappings, the connecting-user permission ceiling, scope adjustment,
  12-hour access-token lifetime, and refresh-token behavior are documented.
- Common list eTag/signature behavior, `304`, changed-list response,
  45-day eTag retention, pagination, 429/503 retry guidance, and selected
  object event/deletion indications are described. The public DSS page also
  documents subscription management, consumer-endpoint verification,
  acknowledgement, duplicate/out-of-order delivery, retries, batching, and
  seven-day failed/paused-delivery expiry/loss behavior.
- Field Sync demonstrates a farmer-reviewed land-matching and synchronization
  workflow; Field Operations demonstrates operation, measurement, map and
  asynchronous shapefile capabilities; partnerships document platform
  permission categories.
- Work Plans and Field Sync full documents are login-gated. Their public
  overviews do not establish complete endpoint contracts.

Detailed sources and limits are in the
[official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md).

## Remaining technical questions

The bounded graph is documented sufficiently for design-level semantic
analysis, but these questions remain for a future authorized technical
discussion:

1. Production API base URL, API product/license, version/media type,
   production approval/entitlement, and eligible connecting-user roles for
   the five land objects.
2. Complete object schemas and list filters; ID uniqueness/lifecycle across
   rename, move, merge, archive, delete, permission loss and reconnection;
   per-object units and source timestamp semantics.
3. For each selected land event type, production entitlement and exact
   event schema/filter/scope; event coverage/completeness and end-to-end
   latency commitments; and the supported recovery/reconciliation path after
   an event expires or a gap exceeds DSS's seven-day queue and the eTag's
   45-day retention. Public docs already answer receiver
   acknowledgement/validation, duplicate/out-of-order behavior, retry,
   batching, and pause/expiry mechanics.

Do not ask about Field Sync or Work Plans implementation detail unless a
later scoped design makes them necessary. Products, Operators, Field
Operations, Measurements, Prescriptions, and AEMP remain outside the minimum
continuity slice.

## Remaining contractual and privacy/governance questions

Official technical docs do not establish:

- which current production agreement applies to Cora or which legal entity
  must accept it;
- whether `READ`, `CACHE`, `PERSIST`, `NORMALIZE`, or `DERIVE` is permitted
  for the proposed purpose and data classes;
- retention duration, backup treatment, or permitted use after
  disconnect/revocation;
- producer export, onward sharing, institutional recipient use, replacement
  provider use, or Deere-independent rehydration;
- deletion duties for source correction/deletion, revocation, organization
  connection removal, termination, and downstream copies;
- commercial use or AI/model training, evaluation, or improvement rights; or
- applicable privacy/data-governance requirements for operator-linked data.

These remain separate from operator authorization, Cora approvals, and
recipient acceptance. See the
[Deere rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md).

The six continuity-critical rights are persistence, normalization, producer
export, recipient sharing, independent rehydration, and retention after
disconnect. A prohibition on any required operation blocks that capability;
if no lawful preservation path remains, JD001 continuity is not viable.
That conclusion is distinct from invalidating Cora's broader continuity
thesis. See the
[rights outcome matrix](CORA_JD001_RIGHTS_OUTCOME_MATRIX.md).

## Recommended routing

If separately authorized, route the three bounded technical questions to
Deere Developer Relations or the Precision Tech / Operations Center API
product owner. Route the action-specific production agreement and
retention/export/disclosure questions to an authorized Deere API contracting
or legal owner. Include Deere privacy/data-governance only for applicable
operator-data handling and onward-disclosure requirements. Do not presume a
general customer-support or sales contact is authoritative.

## Current boundary

No contact is authorized by this record. Any later outreach requires explicit
authorization of sender, recipient, channel, text/version, and scope. It must
not request credentials, a live account, producer records, or system access.

Current state remains:
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED`, and
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.
