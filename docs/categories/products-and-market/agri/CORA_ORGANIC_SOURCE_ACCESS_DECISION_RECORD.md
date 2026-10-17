# Cora Organic Source-Access Decision Record

**Status:** reusable governance record and schema. A completed record captures
evidence of an institution's response; it does not itself grant or activate
access.

## State vocabulary

Use these exact states for permissions and capabilities:

- `ESTABLISHED_ALLOWED`
- `ESTABLISHED_PROHIBITED`
- `REQUIRES_CONFIRMATION`
- `NOT_ESTABLISHED`
- `NOT_APPLICABLE`

`UNKNOWN` may be used where the source model requires an explicit unknown
value. Do not treat `NOT_ESTABLISHED` as prohibited or silence as allowed.
Record the evidence supporting every established state. An authorization may
be purpose-, method-, field-, recipient-, and time-limited.

## Reusable record schema

This language-level schema is intentionally descriptive rather than a
runtime contract. It contains no credentials, source records, or live
operator data.

```yaml
recordId: <stable local decision-record identifier>
sourceInstitution:
  name: <institution>
  roles: [<evidenced source roles>]
  certificationScheme: <scheme or NOT_APPLICABLE>
  accreditationReference: <authority source or NOT_ESTABLISHED>
sourceContactRoute:
  route: <official institutional route>
  routeEvidence: <official URL/reference>
  namedPerson: NOT_ESTABLISHED
accessMethod:
  requested: <API | FEED | STRUCTURED_DOWNLOAD | VERIFICATION_ENDPOINT | BOUNDED_WEB | MANUAL>
  disposition: <state>
  conditions: [<documented conditions>]
allowedOperations:
  - operation: <operation>
    disposition: <state>
    evidence: <document/version/response reference>
prohibitedOperations:
  - operation: <operation>
    disposition: <state>
    evidence: <document/version/response reference>
dataClasses:
  - class: <minimum source fields/fact classes>
    disposition: <state>
    purpose: <specific purpose>
retention:
  disposition: <state>
  duration: <duration or NOT_ESTABLISHED>
  deletionTrigger: <condition or NOT_ESTABLISHED>
redistribution:
  internalRecipient: <state>
  namedExternalRecipient: <state>
  publicRepublication: <state>
commercialUse:
  disposition: <state>
  scope: <specific scope or NOT_ESTABLISHED>
attribution:
  disposition: <state>
  requiredText: <exact text or NOT_ESTABLISHED>
  linkOrMarkRules: <conditions or NOT_ESTABLISHED>
rateLimits:
  disposition: <state>
  details: <limits or NOT_ESTABLISHED>
timestampSemantics:
  statusObservation: <definition or NOT_ESTABLISHED>
  statusChange: <definition or NOT_ESTABLISHED>
  recordCreatedAt: <definition or NOT_ESTABLISHED>
  recordUpdatedAt: <definition or NOT_ESTABLISHED>
  directoryRefresh: <definition or NOT_ESTABLISHED>
changeFeed:
  disposition: <state>
  method: <method or NOT_ESTABLISHED>
  semantics: <delivery/change guarantees or NOT_ESTABLISHED>
sourceIdentifiers:
  recordIdSemantics: <definition or NOT_ESTABLISHED>
  canonicalOperatorIdSemantics: <definition or NOT_ESTABLISHED>
correctionDisputeRoute:
  route: <route or NOT_ESTABLISHED>
  pendingCorrectionHandling: <condition or NOT_ESTABLISHED>
decisionDate: <YYYY-MM-DD or NOT_ESTABLISHED>
decisionEvidence:
  - type: <terms | institutional_response | licence | policy | other>
    reference: <URL, document/version, correspondence reference>
    capturedAt: <date-time>
expiryOrReview:
  expiresAt: <date or NOT_ESTABLISHED>
  reviewAt: <date or NOT_ESTABLISHED>
conditions: [<scope, purpose, field, recipient, duration and access conditions>]
decisionOwner: <accountable role or NOT_ESTABLISHED>
humanApproval:
  state: <PENDING | APPROVED | REJECTED>
  evidence: <approval reference or NOT_ESTABLISHED>
runtimeActivation:
  state: NOT_AUTHORIZED
  separateApprovalReference: NOT_ESTABLISHED
```

If the institution has not responded, populate no positive permission values.
Use `REQUIRES_CONFIRMATION` or `NOT_ESTABLISHED` and state why. Preserve
prohibitions as separate facts from unconfirmed permissions.

## Phase 2B candidate snapshots

These are documentation snapshots, not source approvals. Dates reflect the
Phase 2B review; update only on new authoritative evidence.

### Pro-Cert

```yaml
recordId: CORA-PRO-CERT-PHASE-2B-2026-10-08
sourceInstitution: Pro-Cert Certifications Inc.
sourceContactRoute: info@pro-cert.org
accessMethod:
  requested: BOUNDED_WEB
  disposition: REQUIRES_CONFIRMATION
allowedOperations:
  one_record_internal_verification: REQUIRES_CONFIRMATION
prohibitedOperations:
  automation: REQUIRES_CONFIRMATION
  bulk_export_or_processing: REQUIRES_CONFIRMATION
  public_republication: REQUIRES_CONFIRMATION
dataClasses:
  operator_status_scope_provenance: REQUIRES_CONFIRMATION
retention:
  disposition: REQUIRES_CONFIRMATION
redistribution:
  internalRecipient: REQUIRES_CONFIRMATION
  publicRepublication: REQUIRES_CONFIRMATION
commercialUse:
  disposition: REQUIRES_CONFIRMATION
attribution:
  disposition: NOT_ESTABLISHED
rateLimits:
  disposition: NOT_ESTABLISHED
timestampSemantics:
  statusObservation: NOT_ESTABLISHED
  statusChange: NOT_ESTABLISHED
  directoryRefresh: DAILY_STATED_NOT_STATUS_OBSERVATION
changeFeed:
  disposition: NOT_ESTABLISHED
decisionDate: 2026-10-08
decisionEvidence:
  - public_directory_and_robots_review
  - CFIA_COR00906030_register
  - no institutional response received
expiryOrReview:
  reviewAt: upon_institutional_response
conditions:
  - no live record accessed
  - inquiry prepared but unsent
humanApproval:
  state: PENDING
runtimeActivation:
  state: NOT_AUTHORIZED
```

The source's visible controls, public availability, and robots directives do
not change these states. See
[Phase 2B source selection](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md) for
evidence and limitations.

### Ecocert Canada

```yaml
recordId: CORA-ECOCERT-RECONNAISSANCE-2026-10-08
sourceInstitution: Ecocert Canada
sourceContactRoute: NOT_ESTABLISHED
accessMethod:
  requested: NOT_ESTABLISHED
  disposition: NOT_ESTABLISHED
allowedOperations:
  one_record_internal_verification: NOT_ESTABLISHED
prohibitedOperations: NOT_ESTABLISHED
dataClasses:
  operator_status_scope_provenance: NOT_ESTABLISHED
retention:
  disposition: NOT_ESTABLISHED
redistribution:
  internalRecipient: NOT_ESTABLISHED
  publicRepublication: NOT_ESTABLISHED
commercialUse:
  disposition: NOT_ESTABLISHED
attribution:
  disposition: NOT_ESTABLISHED
rateLimits:
  disposition: NOT_ESTABLISHED
timestampSemantics:
  statusObservation: NOT_ESTABLISHED
  statusChange: NOT_ESTABLISHED
changeFeed:
  disposition: NOT_ESTABLISHED
decisionDate: 2026-10-08
decisionEvidence:
  - CFIA_register_links_Ecocert_maintained_directory
  - Ecocert_directory_announcement
  - no rights response received
expiryOrReview:
  reviewAt: before_any_live_access
conditions:
  - CREDIBLE_ALTERNATIVE_REQUIRES_RIGHTS_REVIEW
humanApproval:
  state: PENDING
runtimeActivation:
  state: NOT_AUTHORIZED
```

## Decision controls

Before considering any live proof:

1. Link each permission and prohibition to a current authoritative term,
   licence, policy, or written institutional response.
2. Restrict every permission to exact data classes, method, purpose,
   recipient, operations, retention period, and expiry/review date.
3. Keep certification-body status authority distinct from CFIA scheme and
   accreditation authority and from any aggregator.
4. Verify status-specific observation/change timestamps independently of
   record creation and directory refresh time.
5. Obtain separate human approval for the bounded proof and any runtime
   activation. This record alone cannot authorize either.

Current top-level disposition remains:

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
PHASE_3_PERMISSION = NONE_GRANTED
```
