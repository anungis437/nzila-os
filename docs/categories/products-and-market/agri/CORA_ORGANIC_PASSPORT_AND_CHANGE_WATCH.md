# Organic Evidence Passport and Certification Change Watch

**Status:** read/event contracts and offline synthetic adapter proof only. No
large UI, notifications, polling, production source adapter, or persistence
workflow is enabled.

## Organic Evidence Passport read contract

The passport is a read model over independent evidence observations, not an
organic-status decision. It may expose, when evidence exists:

- operator reference/identity evidence;
- certifier and certification program;
- source-reported status, preserving exact raw vocabulary;
- evidence level (`DIRECTORY_STATUS` versus `CERTIFICATE`);
- certification scope and products;
- standard and version references;
- source institution, source URI/reference and provenance;
- observation and source publication timestamps;
- source record creation/update metadata, kept separate from status
  observation time;
- freshness and source availability;
- conflicts and each underlying source observation;
- evidence lineage/digest where available.

Unknown or missing fields remain absent/unknown. The contract does not emit a
Cora-generated `isCertified` value or a winning status. Any recipient
institution decision is separately represented with its own institution,
organization, role, disposition and evidence references.

For Pro-Cert, directory rows are `DIRECTORY_STATUS`, not certificates. The
directory's stated daily refresh cadence is descriptive metadata only. The
offline adapter cannot substitute record creation/update timestamps for an
explicit status-observation timestamp; missing or invalid time remains
unresolved. No production source mapping or freshness interval is configured.

The required presentation boundary is:

> Cora presents source evidence. Cora is not the certification body.

## Certification Change Watch event contract

`CERTIFICATION_STATUS_CHANGED` describes two source observations and their
evidence references. Its contract includes operator reference, the publishing
source institution and role, previous/new observation references, observed
time, raw previous/current values and optional normalized values.

The event reports an observed source change. It is not itself a certification
decision, an enforcement action, or an instruction to notify a user. If a
source disappears, emit no cancellation value; represent source availability
separately. Conflicting or missing observations remain explicit.

This event is contract-only. There is no active publisher, subscriber,
notification, polling schedule, or retry workflow.
