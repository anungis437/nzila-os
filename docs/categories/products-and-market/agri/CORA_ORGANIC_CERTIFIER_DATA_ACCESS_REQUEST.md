# Cora Organic Certifier Data-Access Request

**Status:** reusable institutional request and unsent outreach drafts. This
document grants no access or processing rights and does not authorize Phase 3.

## Purpose and posture

Cora is developing institutional verification infrastructure. A source
certification body remains the authority for its own operator certification
decisions. Cora would preserve that authority, source provenance, scope,
qualifications, and uncertainty; it does not recertify operators or replace a
certificate, regulator, or certification body.

The request is for the source institution's supported interoperability path,
not permission to scrape or a request for blanket access. It should be
personalized to one certification body and one proposed bounded Canada Organic
Regime (COR) proof. Ask for the applicable written terms, data-access policy,
or authorization; do not interpret silence, public access, export controls, or
robots directives as permission.

## Preferred access hierarchy

Use the highest supported and rights-cleared method available:

1. Supported API.
2. Supported institutional feed.
3. Licensed structured download.
4. Supported record-level verification endpoint.
5. Explicitly permitted bounded public-web access.
6. Written institutional confirmation for a manually bounded proof.

Scraping is not a preferred integration architecture. If no supported method
is identified, stop and keep the source blocked rather than reverse-engineering
an interface.

## Minimum information requested

Ask the certification body to identify the supported access method and answer
each item for the proposed source, data class, and purpose. A response may be
conditional, prohibited, unavailable, or unresolved. Unknown must remain
unknown.

### Access and interoperability

1. **API access:** Is a supported API available for public COR operator-status
   verification? Request documentation, authentication requirements, version,
   allowed operations, and test/sandbox availability.
2. **Machine-readable feed:** Is a supported status or certification feed
   available? Ask about protocol, schema, delivery, frequency, and authorized
   use.
3. **CSV/Excel feed:** Is a structured CSV or Excel feed available for a
   bounded verification purpose? Ask whether it is a supported export, what
   scope it contains, and whether download, retention, and processing are
   permitted.
4. **Bounded programmatic directory queries:** Are automated, limited queries
   against the public directory supported? Ask for allowed query patterns,
   frequency, concurrency, and rate limits.
5. **Record-level verification endpoint:** Is there an authorized endpoint or
   process to verify one institution-selected operator record without
   downloading a directory?
6. **Change/status feed:** Is a supported notification or change feed
   available, including its semantics, delivery guarantees, and permitted
   downstream handling?
7. **Status-specific timestamp:** Does a source field identify when the
   current status was observed, verified, or changed? Ask how that timestamp
   differs from record creation, directory refresh, publication, and export
   time; request timezone and correction semantics.
8. **Certificate validation:** Is there a verification endpoint, canonical
   reference, or certificate validation process? Ask whether the result
   validates authenticity and currentness, and what it does not establish.
9. **Source identifiers:** Which stable source record identifier and canonical
   operator identifier should a recipient use? Are identifiers stable,
   reusable, or subject to reassignment? Ask how identity aliases and
   duplicates are handled.

### Rights, handling, and governance

10. **Internal processing:** May Cora process the minimum public fields for
    one internal, non-public institutional verification, while retaining
    source authority and qualifications? Ask whether the permitted purpose is
    limited to that single case.
11. **Caching and retention:** May Cora retain the source response or a
    minimal normalized evidence record? Ask what fields, purpose, duration,
    cache lifetime, deletion trigger, backup handling, and audit metadata are
    permitted. No indefinite caching is proposed.
12. **Redistribution/republication:** May any source-derived fields be
    transmitted to a named recipient, displayed in a private interface, or
    published? Treat each as a separate permission; the initial proof requests
    no onward distribution or public display.
13. **Commercial verification use:** Is internal use within a commercial
    verification service permitted? Do not infer commercial permission from
    permission for a non-commercial test or manual consultation.
14. **Attribution:** What exact attribution, link, date, disclaimer, or
    certification-body identification is required? May source logos or marks
    be used? Do not use marks without specific authorization.
15. **Rate limits and access controls:** What rate, authentication,
    concurrency, account, network, or operational limits apply? Ask what
    should happen when limits or access controls prevent retrieval.
16. **Acceptable use:** Which purposes and operations are prohibited or
    restricted, including automated access, bulk collection, profiling,
    onward transfer, derived status claims, and service-level claims?
17. **Correction/dispute route:** How may an operator or recipient challenge
    an entry, request correction, report stale information, or resolve a
    discrepancy? Ask how Cora should represent a pending correction.

Also ask for the decision's effective date, expiration or review date,
conditions, governing document/version, and an institutional contact route for
future clarification. A contact response is evidence of what the institution
communicated, not legal advice or an evergreen grant.

## Minimum Phase 3A permission requested

Only after separate written confirmation and a separate human go/no-go, the
proposed first proof would be limited to:

- one COR operator selected by the initiating institution for verification;
- one bounded access event using a method expressly supported and permitted
  by the certification body;
- the minimum public fields necessary for identity matching, the
  source-reported COR status, relevant certification scope/product, and the
  source record reference;
- source observation/change timestamp only if the source defines its
  semantics; keep collection/check time separate;
- internal, non-public processing for that single verification purpose;
- provenance retention: source institution, source record/reference, retrieval
  time, method, permitted fields, response or evidence digest if permitted,
  source qualifications, and attribution required for internal handling;
- no bulk export, directory crawling, scraping, polling, scheduled ingestion,
  Change Watch, notification, or indefinite caching;
- no onward distribution, public display, or commercial public surface;
- no status normalization beyond an independently approved mapping and no
  representation that the directory result replaces a current certificate.

The source may require a smaller field set, shorter retention, or stricter
conditions. If rights for even this minimal internal proof are not explicit,
do not access a live record.

```text
PHASE_3_PERMISSION = NONE_GRANTED_BY_THIS_REQUEST
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
```

The source-selection decision remains in
[CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md).

## Pro-Cert inquiry — prepared, not sent

**To:** `info@pro-cert.org`  
**Subject:** Supported data-access route for one bounded COR verification

> Hello Pro-Cert team,
>
> NzilaOS is developing Cora, institutional verification infrastructure for
> sharing evidence with its source and qualifications intact. We want Pro-Cert
> to remain the authority for Pro-Cert certification decisions; Cora would not
> recertify operators or replace a supplier certificate.
>
> We are considering one non-public proof for a single Canada Organic Regime
> operator selected by the initiating institution. We are not seeking blanket
> access and do not want to use an unsupported access method. Could you
> recommend the appropriate supported access method and advise whether this
> one-record consultation may be processed internally for verification?
>
> In particular, please point us to the applicable terms or written
> authorization covering the permitted fields and operations, any API/feed or
> record-verification option, status-specific timestamp/change information,
> permitted retention/caching and deletion, required attribution, and whether
> any onward or commercial use is allowed. The proposed initial proof does not
> require bulk export, polling, public display, or onward distribution.
>
> Thank you,  
> NzilaOS

The institutional contact route was identified from Pro-Cert's official
[Contact Us page](https://www.pro-cert.org/contact-us/) and the CFIA
certification-body register. This message has **not** been sent.

## Ecocert fallback — reusable draft, not sent

Use only if the Pro-Cert route is unavailable, negative, or remains unresolved.
Do not treat Ecocert as selected: its state remains
`CREDIBLE_ALTERNATIVE_REQUIRES_RIGHTS_REVIEW`.

Replace `[CERTIFICATION BODY]`, `[INSTITUTIONAL CONTACT]`, and `[SCHEME]` only
after verifying the institution and route from its official source.

**To:** `[INSTITUTIONAL CONTACT]`  
**Subject:** Supported data-access route for one bounded [SCHEME] verification

> Hello [CERTIFICATION BODY] team,
>
> NzilaOS is developing Cora, institutional verification infrastructure for
> sharing evidence with its source and qualifications intact. We want
> [CERTIFICATION BODY] to remain the authority for its certification
> decisions; Cora would not recertify operators or replace a certificate.
>
> We are considering one non-public proof for a single [SCHEME] operator
> selected by the initiating institution. We are not seeking blanket access
> and do not want to use an unsupported access method. Could you recommend the
> appropriate supported access method and advise whether this one-record
> consultation may be processed internally for verification?
>
> Please point us to the applicable terms or written authorization covering
> the permitted fields and operations, API/feed or record-verification option,
> status-specific timestamp/change information, retention/caching and
> deletion, attribution, rate limits, correction route, and any restrictions
> on redistribution or commercial use. The proposed proof does not require
> bulk export, polling, public display, or onward distribution.
>
> Thank you,  
> NzilaOS

Do not send this template until its recipient, scheme, purpose, and request
scope are reviewed by a human.

## Source boundaries

- **CFIA:** `SCHEME_AUTHORITY`; authoritative discovery source for
  `CERTIFICATION_BODY_ACCREDITATION`. Its certifier register is not operator
  certification-status evidence. The Open Government Licence applies only to
  information specifically offered under it, not automatically to CFIA pages
  or linked certifier data.
- **CARTV/SIPAB:** preserve the
  Certification Body → CARTV/SIPAB → public aggregation provenance path.
  Aggregation does not replace the certifier's authority; access/reuse remains
  unresolved or restrictive as recorded in the Phase 2B decision.
- **Pro-Cert:** first-priority candidate, but all unresolved rights and
  source timestamp findings in Phase 2B remain in force.
- **Ecocert Canada:** credible alternative requiring its own written rights
  review; it is not selected.

See the [source-access decision record](CORA_ORGANIC_SOURCE_ACCESS_DECISION_RECORD.md)
for the reusable structured decision model and current candidate snapshots.
