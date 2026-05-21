# OCI Privacy Position

**ARTIFACT TYPE:** Institutional Doctrine — Privacy Disclosure
**DOCTRINE_VERSION:** 1.0.0
**STATUS:** Canonical
**INTENDED READER:** institutional governance counsel, privacy officers, member representatives
**PARENT DOCTRINE:** [docs/doctrine/DOCTRINE.md](../doctrine/DOCTRINE.md)

> Privacy is not a feature of OCI. It is a condition of the work.
> This document names the privacy posture under which OCI operates,
> the choices the institution retains, and the practices that are
> not negotiable.

---

## The position, stated plainly

OCI exists to help an institution see and preserve its continuity.
It does not exist to observe individuals, to measure productivity,
to predict behaviour, or to inform managerial decisions about
specific people.

This is the position from which everything else in this document
follows.

---

## What OCI records about people

OCI records the institutional roles people hold, the continuity
responsibilities they carry, and the lineage of decisions in which
they participated. It records this so the institution can recognise
where its operational memory lives.

OCI does **not** record:

- attention metrics, focus measures, or activity timing,
- inferred behavioural traits or psychological profiles,
- communication content beyond what the institution itself files,
- relationship graphs derived from communication metadata,
- predictive scores of any kind about any individual.

These exclusions are constitutive. They are documented in
[OCI Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)
and bound by the
[Anti-Surveillance Doctrine](../doctrine/ANTI_SURVEILLANCE_DOCTRINE.md)
at the doctrine root.

---

## Lawful basis and institutional consent

OCI processes personal data on behalf of the institution. The
institution is the controller; OCI is the processor. The lawful
basis for processing is the institution's own — typically a
combination of legitimate institutional interest, contractual
necessity, and (where applicable) member or employee consent
recorded under the institution's own privacy regime.

OCI does not introduce a new consent regime. It operates under the
institution's existing one and refuses scope that would require a
new one without the institution's deliberate choice.

---

## Cross-border processing

For Canadian institutional pilots, institutional data is stored in
Canada (Azure Canada Central region) by default. Two narrow
exceptions exist, each disclosed and bounded:

1. **Hosted reasoning.** Where AI-assisted facilitation is in scope,
   inference requests may be processed through Azure OpenAI
   resources located in the United States (East US and East US 2).
   The processing is transient (no model training, no retention
   beyond request lifetime). This is documented in
   [OCI Data Handling](./OCI_DATA_HANDLING.md).
2. **Vendor support escalation.** Where Microsoft is invoked for
   support on the underlying platform, support traffic may be
   handled by Microsoft personnel outside Canada under Microsoft's
   own data-handling commitments. The institution is notified before
   any such escalation involves institutional data.

Either of these can be disabled per institution by contract. An
institution that requires fully Canadian processing can have it.

---

## Member, employee, and steward data

Where the institution's pilot scope includes member, employee, or
steward data, the following constraints apply:

- Stewardship density measures are computed at the role and
  responsibility level, not at the individual level. The Stewardship
  Density Index is an institutional figure, not a personal one.
- Memory holders are identified by the role they carry, with the
  steward's name attached only where the steward has been informed
  and the sponsor has approved.
- No member or employee is shown a personal score, ranking, or
  comparison drawn from OCI processing.

A steward who appears on a Memory Holders map is recognised, not
measured.

---

## Aggregate intelligence

If the institution opts into sector-level intelligence (Phase 5 of
the OCI Method™), the aggregate data shared is:

- anonymised to a documented standard before leaving the
  institutional boundary,
- aggregated to a level at which re-identification is
  contractually infeasible,
- reviewed by the institution's governance liaison before each
  publication or sector exchange.

The default is no participation. Participation is opt-in, per
publication, with the option to withdraw at any time.

This is documented in detail in
[OCI Data Handling](./OCI_DATA_HANDLING.md).

---

## Subject access and correction

Where institutional members or employees exercise subject access
rights under the institution's privacy regime, OCI provides the
institution with:

- the structured records held about the named individual,
- the lineage of any decisions in which the individual participated,
- a description of the processing operations performed on those
  records.

OCI does not interpret the subject's data on the institution's
behalf. The institution responds to the subject under its own
privacy regime.

---

## Retention

Institutional records are retained for the duration of the
engagement and for a period defined in the institution's contract
(typically seven years for governance records, three years for
operational records, shorter periods for working-session
transcripts). On contract close, records are returned to the
institution and deleted from OCI infrastructure on a documented
schedule.

Aggregate intelligence contributions, where the institution has
opted in, are not retracted from already-published aggregates;
future aggregates exclude the withdrawn institution.

---

## Privacy conduct rules

These rules govern facilitator and operator conduct, in addition
to the contractual privacy regime:

- A facilitator never asks for personal information beyond what
  the institution has cleared for the engagement.
- A facilitator never displays one steward's information to
  another steward without sponsor approval.
- A facilitator never copies institutional records onto
  unsanctioned devices, channels, or note systems.
- An operator never queries institutional data for purposes
  outside the scope agreed with the institution.

Violations are incidents and are handled under the incident
response process documented in
[OCI Security Overview](./OCI_SECURITY_OVERVIEW.md).

---

## Cross-references

- [OCI Anti-Surveillance Position](./OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI Data Handling](./OCI_DATA_HANDLING.md)
- [OCI AI Boundary](./OCI_AI_BOUNDARY.md)
- [OCI Security Overview](./OCI_SECURITY_OVERVIEW.md)
- [Anti-Surveillance Doctrine](../doctrine/ANTI_SURVEILLANCE_DOCTRINE.md)
