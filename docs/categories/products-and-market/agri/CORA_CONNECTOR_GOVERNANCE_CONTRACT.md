# Cora Connector Governance Contract

**Status:** Design-only governance contract; no connector lifecycle action is
authorized.  
**Applies to:** Future Cora external-source connectors, including reference
profile `JD001`.

## Governing rule

A connector is a constrained mechanism for a named, authorized purpose. It is
not a general-purpose right to access, copy, interpret, retain, or distribute
everything an external system makes technically reachable.

`API_CAN_READ != CORA_MAY_RETAIN`  
`CORA_MAY_RETAIN != CORA_MAY_REUSE`  
`CORA_MAY_REUSE != CORA_MAY_REHYDRATE`

The platform's integration fabric may supply generic orchestration patterns.
It does not own Cora vertical semantics, authorize a source, prove provider
capabilities, or approve a business decision. See
[`@nzila/platform-integrations`](../../../../packages/platform-integrations/README.md)
and the [integration security model](../../platform-and-operations/platform/integration-security-model.md).

## Connector contract

Every connector proposal must have an immutable, reviewed profile that names:

- provider, service, supported source account type, and authoritative
  documentation version/date;
- each operation, direction, field, scope, and object type separately;
- source-origin reference and schema/version, including how unsupported
  fields remain explicit;
- intended actor, organization, purpose, recipient, and legal/contractual
  authority for each processing action;
- identity binding and tenant-isolation strategy;
- credentials as opaque, environment-scoped references only, if later
  approved; never in logs, exports, capsule, or source control;
- validation, freshness semantics, duplicate handling, conflict treatment,
  rate limits, retry, quarantine, audit, deletion, export, and incident
  behavior;
- portability and rehydration plan that does not depend on the provider being
  online;
- accountable technical, product, security, privacy/legal, and data-owner
  approvers; and
- explicit non-goals and fail-closed conditions.

Unspecified operation, scope, data category, recipient, or right is denied.
“Read-only” is not a full rights classification: a read can still entail
processing, storage, profiling, or onward disclosure.

## Lifecycle gates

| Gate                         | Evidence required                                                                                                                                                | What it does not grant                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Reference registration       | Named provider and discoverable primary public documentation links; all content/capability gaps recorded.                                                        | Account access, a supported API, or any rights.                        |
| Technical capability review  | Current provider-published schema, operation, version, scope, rate, and error semantics for each exact capability.                                               | Permission to invoke, persist, or commercialize a capability.          |
| Rights and privacy approval  | Written authority for access, processing, each retention period, transformation, export, recipient, reuse, and rehydration; purpose and jurisdiction assessment. | Rights outside the named actions, fields, subjects, or periods.        |
| Contract and security design | Threat model, data minimization, tenant isolation, credential handling, audit, deletion, incident and recovery plans.                                            | Production permission or a source-provider integration.                |
| Synthetic validation         | Test fixtures, schemas, failure behavior, integrity, export and independent-reader results.                                                                      | Permission to use real records.                                        |
| Bounded pilot authorization  | Explicit accountable approval with cohort, environment, time window, rate/volume ceilings, support, stop conditions, and rollback.                               | Expansion beyond its written limits.                                   |
| Production approval          | All legal, provider, operator, recipient, privacy, security, and operational gates complete; independently evidenced readiness.                                  | An irrevocable or universal right. Continued review remains mandatory. |

Every gate is fail-closed. A prepared request, public API description, test
success, or valid OAuth grant is not a substitute for the approvals above.

## Rights ledger

The permission record must distinguish, at minimum:

1. source authentication and authorization;
2. read/query and permitted fields;
3. transient processing and validation;
4. persistence and the permitted retention duration;
5. normalization, derivation, and display;
6. export and independent rehydration;
7. reuse for a second purpose or recipient;
8. onward disclosure, including institutional sharing;
9. commercial use and monetization; and
10. correction, revocation, deletion, and backup-expiry behavior.

For each action record the grantor, authority basis, named subject or allowed
cohort, data scope, purpose, recipient, effective/expiry times, revocation
path, and proof artifact. The decision must not inherit permission by
proximity from an adjacent action. If a right cannot be confirmed, mark it
`NOT_ESTABLISHED` and block the affected action.

## Operational invariants

- Derive organization and actor from canonical platform authority; do not
  trust connector-supplied tenant context.
- Enforce the same organization boundary at connection, run, identity link,
  quarantine, export, audit, and deletion boundaries.
- Store secret references only. Do not serialize credentials into records,
  evidence, diagnostics, or portability capsules.
- Validate external input before mapping. Preserve original units, values,
  qualifiers, and version where authorized; label any normalized value as a
  separate derived representation.
- Keep provider status, Cora technical processing status, and institutional
  decisions as distinct values and authorities.
- Audit actor, organization, action, purpose, recipient, exact capability
  profile, and result. Exclude raw secrets and minimize subject-level values.
- Treat schema changes, provider terms changes, and rights changes as a
  re-review trigger. Disable affected operations until re-approved.
- Make export and deletion testable. Deletion includes derived records,
  indexes, caches, queues, logs where lawful/required, replicas, and expiry
  of backup copies; document any legal hold or immutable audit exception.
- No platform, application, or connector owner may silently turn a source
  fact into a Cora-owned operational fact.

## Stop conditions

Stop the affected connector action and preserve a redacted audit trail if:

- permissions are absent, ambiguous, expired, or no longer match the purpose;
- actor, operator, provider identity, or organization cannot be bound
  unambiguously;
- data scope exceeds the approved profile;
- source attribution, integrity, schema, or freshness cannot be established;
- the requested retention/export/reuse exceeds documented rights;
- a provider or recipient decision is being inferred by Cora;
- independent export cannot be parsed or verified; or
- a source outage would cause a stale or missing value to appear current.

The canonical architecture and status are tracked in
[Cora Data Sovereignty and Continuity Architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md).
