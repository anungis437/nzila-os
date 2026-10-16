# JD001 Deere Rights Question Set

**Status:** Prepared for internal authorization review only.  
**Contact state:** `PREPARED_NOT_AUTHORIZED_TO_SEND`  
**Scope:** Deere contractual/privacy-governance rights; no permission is
presumed.

## Public-evidence boundary

The official docs now establish a technical OAuth and organization-connection
model, land-resource capabilities, selected events/change signals, and
adjacent export/sharing surfaces. They do not establish a Cora production
agreement or grant any data-use right. This question set therefore preserves
the rights wall. Technical scope, selected-organization connection, Field
Sync, a partnership permission, an event token, or an available shapefile
does not answer any question below.

The displayed [API Development License Agreement](https://developer.deere.com/clickThroughAPIAgreement.html)
is treated as public text, not accepted/current terms or a production grant.
It is described as internal development/testing, restricts storage and
distribution under that license, and says third-party release needs a
separate Production Agreement. Its displayed version contains a placeholder
and no visible effective date.

## Classification vocabulary

- `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `REQUIRES_DEERE_TECHNICAL_CONFIRMATION`
- `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`
- `REQUIRES_DEERE_PRIVACY_GOVERNANCE_CONFIRMATION`

## Bounded rights-discovery scope

The governing question is whether, after operator authorization, Cora may
preserve a bounded, purpose-limited historical representation of
Deere-originated land information for operator understanding and legitimate
reuse after the Deere connection ends.

Limit the initial discussion to `Organization`, `Client`, `Farm`, `Field`,
`Boundary`, and metadata necessary for identity, source provenance,
relationships, timestamps, status, units, and capture history. Exclude
Machine/AEMP telemetry, Field Operations, Measurements, Products, Operators,
Work Plans, Prescriptions, shapefile exports, and files generally.

Request a distinct written answer for every operation, data class, field,
purpose, recipient class, and lifecycle trigger. For each answer capture:

- outcome: allowed, prohibited, conditional, or inconclusive;
- governing agreement, version/date, exact section, and whether binding;
- data classes, fields, purpose, and conditions precedent;
- retention period, residency/location, backups, and legal-hold treatment;
- recipient classes, onward disclosure, and commercial-use limits;
- revocation, termination, deletion, and post-termination handling.

An operator authorization, OAuth scope, technical API capability, or
receiving-party acceptance does not itself authorize Deere-originated data
processing or persistence. Route privacy/data-governance questions to the
authoritative Deere function when operator-linked data, residency, onward
disclosure, deletion, or legal-hold obligations require its determination;
do not treat privacy review as a substitute for contractual permission.

## Action-by-action rights schedule

Every action below remains unresolved and requires authoritative written
Deere contractual confirmation. Answers must be distinct by data class,
field, purpose, recipient, and lifecycle event; no general “yes” transfers
between rows.

| Operation                 | Classification                                                                                 | Exact rights question                                                                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `READ`                    | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May the approved application read each named data class and field for the bounded producer-authorized purpose? Identify applicable production agreement, product terms, subject/account requirements, and conditions. |
| `CACHE`                   | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May the application temporarily cache data? Specify fields, purpose, location, expiry, backup/replica handling, and deletion trigger.                                                                                 |
| `PERSIST`                 | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May it create a durable bounded copy? Identify eligible objects/fields, purpose, location/residency, retention duration, backups, and legal-hold treatment.                                                           |
| `NORMALIZE`               | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May it map source values into a stable vendor-neutral representation while retaining attribution, originals/units, and mapping version? What constraints apply?                                                       |
| `DERIVE`                  | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May it create derived semantic values or relationships? Identify prohibited derivations, attribution requirements, permitted purposes, and rights in outputs.                                                         |
| `SHARE`                   | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May it disclose the specified data/representation to a separately authorized institution or service? Name recipient classes, purposes, retention, onward-disclosure limits, and verification conditions.              |
| `EXPORT`                  | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May the producer export the bounded source data or representation? Identify permitted content/format, access method, recipient restrictions, and post-export terms.                                                   |
| `REHYDRATE`               | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May the producer, replacement provider, or receiving system independently parse, interpret, and use the representation without an active Deere connection? Which IDs and semantics may be included?                   |
| `RETAIN_AFTER_DISCONNECT` | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | After each disconnect/revocation event, may the application retain historical copies? Specify eligible classes, historical purposes, duration, future-use limits, and deletion/backup rules.                          |
| `DELETE_ON_REVOCATION`    | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION` and `REQUIRES_DEERE_PRIVACY_GOVERNANCE_CONFIRMATION` | For each trigger, what must be deleted, by when, from which stores, backups, derived outputs, audit records, and downstream recipients? What evidence and exceptions apply?                                           |
| `COMMERCIAL_USE`          | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | May these operations support paid/commercial service? Identify required production/commercial arrangements, fees, restrictions, and whether recipient use changes the answer.                                         |
| `USE_FOR_AI_TRAINING`     | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION` and `REQUIRES_DEERE_PRIVACY_GOVERNANCE_CONFIRMATION` | May any data class be used for training, fine-tuning, evaluation, or model improvement? Identify data, model purpose, retention, withdrawal/deletion, outputs, and explicit prohibitions.                             |

For every answer, record allowed/prohibited/conditional; agreement name,
version/date/section; covered data classes and fields; purpose; location and
retention; backups and legal hold; recipient/onward disclosure; commercial
limits; deletion/revocation/termination duties; conditions precedent; and
whether the answer is binding written language or non-binding guidance.
Treat an omitted operation or lifecycle event as unanswered, not implicitly
allowed.

## Core continuity rights question

If an operator authorizes Cora to receive Deere-originated land information,
may Cora preserve a bounded, purpose-limited historical representation so
that the operator can understand and reuse legitimate historical state after
the Deere connection ends?

Answer separately whether independent persistence, source-ID/provenance
retention, normalization, vendor-neutral representation, producer export,
independent interpretation, replacement-provider consumption, downstream
institutional use, and post-disconnect historical use are permitted. Identify
the allowed objects/fields, periods, recipients, and conditions for each.
Do not conflate portability with redistribution or imply copying all
Operations Center data.

The six continuity-critical rights are persistence, normalization, producer
export, recipient sharing, independent rehydration, and retention after
disconnect. Their possible outcomes and architectural consequences are
defined in the [rights outcome matrix](CORA_JD001_RIGHTS_OUTCOME_MATRIX.md).
All other actions in the rights schedule remain independently gated.

## Event-specific exit schedule

| Event                                             | Classification                                                                                 | Clarification required                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Producer disconnects the app                      | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | Does disconnect stop future calls only, or trigger deletion/another duty? What lawful historical use, if any, remains?                               |
| App access grant is revoked                       | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | Which authorization is revoked, when effective, and what happens to copies already lawfully received?                                                |
| Organization connection is removed in Connections | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | Public docs explain this can end the refresh-token connection; what contractual duties govern retained copies, derivatives, exports, and recipients? |
| Source record is corrected, archived, or deleted  | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION` and `REQUIRES_DEERE_PRIVACY_GOVERNANCE_CONFIRMATION` | What correction/deletion must propagate downstream? May a rights-cleared historical prior state remain, and under what audit/notice conditions?      |
| Account is closed                                 | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | What access, retention, export, deletion, and audit rules apply to existing copies?                                                                  |
| Production agreement is terminated                | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | What wind-down, export, deletion deadline, permitted archive, backup treatment, and downstream duties apply?                                         |
| API product is discontinued                       | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`                                                      | What notice, transition, export, retention, or deletion terms apply?                                                                                 |

For each event, distinguish future access, required deletion, permitted
retention, historical use, audit obligations, backup handling, and downstream
copy duties. Public OAuth mechanics and eTag/event behavior do not answer
these contractual questions.

## Authority boundary

Operator authorization, Deere contractual/API permission, Cora governance,
and receiving-institution authority are independent decisions.
`FARMER_AUTHORIZED = CORA_MAY_PERSIST` is not established. A producer grant
cannot expand Deere's contract; Deere permission cannot compel Cora to
process; neither establishes a recipient's right to receive or rely on data.

See the [human-discovery contract](CORA_JD001_DEERE_HUMAN_DISCOVERY_CONTRACT.md),
[technical question set](CORA_JD001_DEERE_TECHNICAL_QUESTION_SET.md), and
[official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md).
