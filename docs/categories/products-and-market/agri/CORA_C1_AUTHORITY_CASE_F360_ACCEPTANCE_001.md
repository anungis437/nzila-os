# CORA C1 Authority Case — Farmer 360 Acceptance Fixture

- **Case ID:** `CORA-C1-F360-ACCEPTANCE-001`
- **Classification:** `DEMO_TEST_ONLY`
- **Case instantiation:** `READY`
- **Case authority:** `BLOCKED_EVIDENCE_GAPS`
- **C1 human state:** `PENDING_SOURCE_AUTHORITY`

This dossier resolves the origin-scoped C1 model against one repository-backed
`producer.status` case. It is based only on the disposable Farmer 360
acceptance fixture and its tests. It is not a customer, pilot, cooperative,
production or live institutional case. The fixture explicitly states that no
production-derived data is used. No real producer or personal value is
identified here.

No authority decision is implied. The runtime registries remain empty, the
candidate remains `PROPOSED_NOT_ACTIVE`, and real-source disclosure remains
`WITHHOLD`. This documentation does not begin C2 or alter runtime behavior.

## 1. Case identity and evidence boundary

| Field                            | Case finding                                                                                          | Evidence state                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Case ID                          | `CORA-C1-F360-ACCEPTANCE-001`                                                                         | `ESTABLISHED`                                            |
| Environment / classification     | Disposable PostgreSQL acceptance fixture; test-only and synthetic                                     | `ESTABLISHED`                                            |
| Fact class                       | `producer.status`                                                                                     | `ESTABLISHED`                                            |
| Source system / entity           | Agrimo / `agri_producers.status`                                                                      | `ESTABLISHED`                                            |
| Source record class/reference    | Synthetic producer row `36000000-0000-4000-8000-000000000101`; reference is a fixture identifier only | `ESTABLISHED`                                            |
| Source organization              | `TEST ONLY - Cora Farmer 360 Acceptance Org`, fixture ID `36000000-0000-4000-8000-000000000001`       | `ESTABLISHED` as fixture metadata, not as a legal entity |
| Operational steward              | Agrimo is the operational product maintaining the source record                                       | `ESTABLISHED` as product/operational responsibility only |
| Fact-origin institution          | No real originating institution is identified for synthetic fixture data                              | `NOT_ESTABLISHED`                                        |
| Producer / subject relationship  | No real producer is represented; the row is explicitly synthetic                                      | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only      |
| Recipient application / surface  | Cora / Farmer 360 profile read                                                                        | `ESTABLISHED` as test scope                              |
| Recipient organization           | The same test organization ID is used for the fixture source and Cora profile                         | `ESTABLISHED` as a technical fixture relationship only   |
| Recipient institution            | No real recipient institution is identified                                                           | `NOT_ESTABLISHED`                                        |
| Intended test role               | Canonical active `viewer` membership with `cora:farmer360:read`                                       | `ESTABLISHED` as test authorization setup                |
| Test purpose                     | Exercise an organization-scoped, read-only Farmer 360 source composition                              | `ESTABLISHED` as fixture/test purpose                    |
| Institutional disclosure purpose | No actual institutional purpose is evidenced                                                          | `NOT_ESTABLISHED`                                        |
| Authority instrument candidate   | No instrument authorizing a real source-to-recipient transfer was found                               | `NOT_ESTABLISHED`                                        |
| Upstream/provider relationship   | The fixture states it contains no production-derived data; no upstream provider is represented        | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only      |
| Privacy/legal dependency         | No real data subject or transfer is represented; C3 analysis remains required for any real case       | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only      |

The source and recipient organization IDs match in the test setup. This proves
only the fixture's technical tenant scope. It does not establish that Agrimo
and Cora are the same governed institution, that the fixture organization is
a real institution, or that any party may disclose actual producer data.

## 2. Authority chain

`ESTABLISHED` means only the stated fixture or technical fact. It is not an
approval state.

| Link                       | Case finding                                                                                                                                 | Evidence state                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Operational origin         | The acceptance fixture inserts a synthetic row into `agri_producers`; the Cora adapter reads the organization-scoped Agrimo producer record. | `ESTABLISHED`                                                      |
| Fact origin                | No real person or institution originated the synthetic value; it is test data. Production origin remains unknown.                            | `NOT_ESTABLISHED` for any real fact                                |
| Operational steward        | Agrimo owns the operational product/source-record responsibility in the product boundary doctrine.                                           | `ESTABLISHED` as operational stewardship only                      |
| Producer relationship      | There is no actual producer relationship or producer instruction, consent, correction or revocation evidence for the synthetic row.          | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only                |
| Source institution         | The fixture organization is a synthetic acceptance scope, not an identified legal/source institution.                                        | `NOT_ESTABLISHED`                                                  |
| Source delegate            | Repository routing aliases are not a delegated approver for this case. No person/body with a verified mandate is identified.                 | `NOT_ESTABLISHED`                                                  |
| Authority instrument       | No executed source mandate, agreement or decision covers this fact, recipient and purpose; repository search found none for this case.       | `NOT_ESTABLISHED`                                                  |
| Upstream restrictions      | No upstream provider is represented in the synthetic fixture; production terms remain unknown.                                               | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only                |
| Recipient institution      | The Cora application and test organization are identified technically; no recipient institution is identified.                               | `NOT_ESTABLISHED`                                                  |
| Recipient purpose          | The test exercises read-only profile composition; no real recipient purpose or necessity determination exists.                               | `ESTABLISHED` for the test only; `NOT_ESTABLISHED` institutionally |
| Producer-control mechanism | No producer can exercise rights against the synthetic row; any real-case mechanism is unknown and referred to C3.                            | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only                |
| Privacy/legal gate         | No real transfer is represented. For a real case, legal roles, rights, lawful basis, jurisdiction and safeguards remain for Privacy/Legal.   | `NOT_APPLICABLE_WITH_EVIDENCE` to this fixture only                |

## 3. Role separation

| Role                         | Case assignment                                                                                             | Evidence and limit                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Platform owner/operator      | Nzila Ventures is named in generic corporate/privacy material as the platform operator/controller candidate | Candidate only; generic platform ownership does not establish record control or disclosure authority. |
| Product owner                | Cora is the receiving product; Agrimo is the operational source product                                     | Product responsibility is not institutional authority.                                                |
| Operational record steward   | Agrimo                                                                                                      | Established for operational custody/responsibility, not legal control.                                |
| Originating institution      | None identified for synthetic data                                                                          | The test organization name is not a real institution.                                                 |
| Data/controller candidate    | Unresolved                                                                                                  | Privacy/Legal must determine applicable roles for a real origin and relationship.                     |
| Producer/subject             | No real producer; synthetic fixture row                                                                     | No personal record is represented.                                                                    |
| Source disclosure authority  | None identified                                                                                             | No mandate or approval is established.                                                                |
| Legal signatory              | Corporate legal/signatory routing is described in general governance material                               | No evidence delegates authority over this source fact or this transfer.                               |
| Recipient institution        | None identified                                                                                             | Cora/Farmer 360 is the receiving application in the test only.                                        |
| Recipient decision authority | None identified                                                                                             | A test viewer role is not authority to accept or rely on real evidence.                               |

If the same party holds multiple roles in a future real case, each role still
requires its own evidence. No role is inferred from application ownership,
database tenancy, membership, provenance labels or platform access.

## 4. Same-institution or cross-institution

**Technical fixture relationship:** `SAME_ORGANIZATION_ID` — the source row,
profile and viewer membership use the same test organization ID.

**Institutional relationship:** `NOT_ESTABLISHED` — the fixture's organization
is explicitly a synthetic Cora acceptance organization. Its identifier does
not show that source and recipient are one governed legal institution. No
equal-tenant shortcut is used to claim same-institution authority.

The runtime candidate remains same-organization-only. This fixture neither
proves that a real case is same-institution nor supports cross-institution
portability. If a real case is cross-institution, current runtime scope is
`NOT_SUPPORTED_BY_CURRENT_CANDIDATE`; stop before runtime use.

## 5. Authority-instrument search

The repository-bounded C1 search covered the agricultural governance and
architecture material, corporate legal/governance and privacy documents, and
the Farmer 360 acceptance fixture. It did not access external legal archives,
customer records, institutions, production databases or email.

| Instrument class                                            | Result           | Case-specific finding                                                                                                 |
| ----------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Customer / pilot agreement                                  | `NOT_FOUND`      | No executed instrument for this synthetic case or a real source-to-recipient transfer.                                |
| Cooperative / program / operating agreement                 | `NOT_FOUND`      | No case-specific source institution or agreement is identified.                                                       |
| Producer terms / consent / instruction                      | `NOT_FOUND`      | No real producer is represented; no production rights are inferred.                                                   |
| Data-sharing agreement / institutional mandate / delegation | `NOT_FOUND`      | No source institution, delegate or mandate is identified.                                                             |
| Source-provider terms                                       | `NOT_FOUND`      | No upstream provider is represented in the fixture.                                                                   |
| Venture-level operating agreement                           | `TEMPLATE_ONLY`  | The repository contains a generic template; it is not an executed source authority instrument.                        |
| Data-processing agreement                                   | `TEMPLATE_ONLY`  | Generic template for specified cases; it does not establish the controller relationship or authorize this disclosure. |
| Privacy notice                                              | `NOT_APPLICABLE` | Generic notice is not a case-specific source mandate or producer instruction.                                         |
| Dated C1 decision record                                    | `NOT_FOUND`      | The repository record template is not an executed decision. No request was sent and no decision was recorded.         |

These are repository findings only. External instruments may exist; none is
assumed absent outside the inspected repository.

## 6. Producer-control and recipient decision rights

For this synthetic fixture, the source row is prepared by a test SQL fixture,
not supplied by a real producer. The repository does not establish producer
view, correction, authorization, withdrawal, revocation or objection rights
for any corresponding real `producer.status` fact. It also does not establish
that a real institution independently maintains or assigns that status, or
that it originates upstream. Those questions remain unresolved for any
production case and must be referred to Privacy/Legal and the relevant source
authority.

The fixture tests a read-only profile composition with no history, export,
onward disclosure or source writes. That technical scope is not a human
recipient decision. For a real transfer, a recipient institution may
independently accept, reject, request verification, assign confidence or
limit use within its process; receipt does not certify the fact or authorize
reuse.

## 7. C1 case closure test

| #   | Required element                                  | Result                                                                                                |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Origin identified                                 | `ESTABLISHED` for the synthetic fixture row only; a real fact origin is `NOT_ESTABLISHED`.            |
| 2   | Operational steward identified                    | `ESTABLISHED` as Agrimo operational product responsibility.                                           |
| 3   | Source institution identified                     | `NOT_ESTABLISHED`.                                                                                    |
| 4   | Producer/source relationship established          | `NOT_APPLICABLE_WITH_EVIDENCE` for the synthetic row; not established for a real case.                |
| 5   | Required source-authority institutions identified | `NOT_ESTABLISHED`.                                                                                    |
| 6   | Delegated approver identified                     | `NOT_ESTABLISHED`.                                                                                    |
| 7   | Authority instrument identified                   | `NOT_ESTABLISHED`; repository instrument classification is `NOT_FOUND`.                               |
| 8   | Upstream restrictions resolved                    | `NOT_APPLICABLE_WITH_EVIDENCE` for the synthetic fixture only; production terms are not established.  |
| 9   | Recipient institution/organization identified     | Test organization and application are identified; real recipient institution is `NOT_ESTABLISHED`.    |
| 10  | Exact purpose identified                          | Test-only profile-read purpose is established; institutional purpose is `NOT_ESTABLISHED`.            |
| 11  | Permitted scope established                       | Test-only read scope is established; real disclosure scope is `NOT_ESTABLISHED`.                      |
| 12  | Durable authority evidence available              | Fixture sources are durable test evidence, but case-specific authority evidence is `NOT_ESTABLISHED`. |

Disposition: `C1_CASE_AUTHORITY = BLOCKED_EVIDENCE_GAPS`. The case itself is a
valid repository-backed demo/test case; it is not sufficiently evidenced for
a real source-authority decision. The blockers are the real origin and source
institution, their relationship to the producer and recipient, required
delegates and mandates, applicable upstream/producer instruments, and the
real recipient institution, purpose and permitted scope.

## 8. Human decision routing

**Not routable; do not send.** The identified case is synthetic and has no
actual source authority, producer, recipient institution or delegated
approver. Existing Agrimo business and engineering aliases are routing
contacts only and cannot be treated as approvers.

Once an actual case and authority chain are externally identified, the
smallest case-specific request can be completed as follows:

> For case `<verified-case-id>`, does `<identified source authority and
delegated approver>` authorize disclosure of the current `producer.status`
> fact from `<verified origin>` to `<verified recipient institution and
organization>` for `<specific purpose>`, limited to
> `<permitted read operation and scope>`, excluding
> `<prohibited uses>`, under `<verified authority instrument>` and its stated
> conditions? This request is for a decision record only; it does not waive
> C2-C9 conditions or activate runtime disclosure.

All placeholders must be supported by durable evidence before routing. No
request or decision is created by this dossier.

## 9. Evidence references

1. [`cora-farmer360-acceptance-fixtures.sql`](../../../../packages/db/bootstrap/cora-farmer360-acceptance-fixtures.sql) — test-only database guard, named fixture organizations, synthetic producer row, active viewer membership and read permission.
2. [`acceptance.integration.test.ts`](../../../../apps/cora/lib/farmer-360/acceptance.integration.test.ts) — verifies the fixture marker and source-composition path.
3. [`adapters.test.ts`](../../../../apps/cora/lib/farmer-360/adapters.test.ts) — verifies organization-scoped source read, Agrimo provenance and fact projection.
4. [`CORA_C1_SOURCE_AUTHORITY_INTAKE.md`](CORA_C1_SOURCE_AUTHORITY_INTAKE.md) — repository evidence limits, authority classes and source-instrument search.
5. [`CORA_DISCLOSURE_SOURCE_AUTHORITY_PACKET.md`](CORA_DISCLOSURE_SOURCE_AUTHORITY_PACKET.md) — exact proposed technical fact, application, same-organization scope and purpose; all human authority answers remain unset.

## 10. Validation and stop

This is documentation-only evidence instantiation. No runtime code,
configuration, registry, database, human decision, deployment or authenticated
HTTP acceptance was changed or used. Do not begin C2. The next case must be
identified from verified external institutional evidence; do not upgrade this
synthetic fixture into a production case.
