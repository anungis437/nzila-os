# Cora Organic First Live Source Decision

**Review date:** 2026-10-08  
**Decision:** `BLOCKED_RIGHTS_CONFIRMATION`  
**Scope:** Phase 2B source-rights research and first-source selection only. No
operator record was opened, exported, collected, or retained.

## Authoritative state

The review preserves the following starting state:

```text
CORA_ORGANIC_PUBLIC_EVIDENCE_FOUNDATION = PASS
CORA_ORGANIC_PHASE_2 = PASS
CORA_ORGANIC_ROUTE = READY_FOR_PUBLIC_SOURCE_PROOF
PRO_CERT_SOURCE_PROOF = REQUIRES_SOURCE_CONFIRMATION
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
COMMERCIAL_VALIDATION = NOT_YET_PROVEN
COTA_PARTNERSHIP = HYPOTHESIS_NOT_DEPENDENCY
```

The reusable institutional request and the CCFI control-point alignment are
documented separately in the [certifier data-access request](CORA_ORGANIC_CERTIFIER_DATA_ACCESS_REQUEST.md),
[source-access decision record](CORA_ORGANIC_SOURCE_ACCESS_DECISION_RECORD.md),
and [Cora Institutional Control-Point Map](CORA_INSTITUTIONAL_CONTROL_POINT_MAP.md).
These Phase 2C artifacts do not alter this rights decision or grant Phase 3
permission.

Private Agrimo governance and disclosure state remain unchanged. No source is
approved for runtime, no source registry entry was added, and no policy,
collection, database, scheduled job, Change Watch, or deployment was activated.

## Decision

`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`

The review did not find a candidate for which lawful access **and** bounded
internal processing rights are sufficiently established for the proposed
operator-level proof. Pro-Cert remains the first candidate by institutional
priority, but publication and a browser-accessible directory do not establish
automation, retention, internal reuse, or commercial verification rights. The
CFIA register establishes certification-body accreditation, not an operator's
certification status. CARTV/SIPAB has stronger public terms language against
automated collection and reuse absent written consent, while its terms for the
separate SIPAB interface were not established. Ecocert Canada is a credible
alternative certifier with a CFIA-linked operator directory, but no clearer
data-use permission was found.

Accordingly:

```text
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
PHASE_3_PERMISSION = NONE_GRANTED_BY_THIS_REVIEW
```

No source was selected merely to advance engineering.

## Candidate findings

### 1. Pro-Cert

The Pro-Cert client directory is a public, searchable source that describes
operator/product/status listings, says it is updated daily, and says it is
informational rather than a substitute for supplier certificates. The page
shows search, print, Excel, and PDF controls, including a page-size option for
all results. These facts establish that those public-facing features exist;
they do not grant rights to automated access, bulk extraction, retention,
internal reuse, republication, or commercial processing.

CFIA lists Pro-Cert as a Canada Organic Regime (COR) certification body under
accreditation number `COR00906030`, with a current effective period of
2026-02-15 through 2031-02-15. The register publishes its standards, covered
categories, and countries. This establishes the body's COR accreditation and
scope as recorded by CFIA, not the status or certification of a particular
operator.

| Rights/access question                        | Finding                 | Evidence boundary                                                                                                                                       |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human public access                           | `ESTABLISHED_ALLOWED`   | The public directory is browser-accessible for viewing and search. This is not permission to retain or repurpose its contents.                          |
| Automated access                              | `REQUIRES_CONFIRMATION` | No supported automation method or authorization was identified. `robots.txt` does not disallow the directory path; robots directives are not a licence. |
| API/feed                                      | `NOT_ESTABLISHED`       | No public API, documented feed, or change-notification contract was identified.                                                                         |
| Bulk export                                   | `REQUIRES_CONFIRMATION` | A page-size option for all results is visible; this establishes a UI feature, not bulk-use permission.                                                  |
| Excel export                                  | `REQUIRES_CONFIRMATION` | An Excel control is visible; download, retention, processing, and reuse permissions are unresolved.                                                     |
| PDF export                                    | `REQUIRES_CONFIRMATION` | A PDF control is visible, but `robots.txt` disallows `/pdfs/` and PDF files. Do not use or automate those paths unless Pro-Cert authorizes the method.  |
| Caching                                       | `REQUIRES_CONFIRMATION` | No cache permission, duration, or deletion rule was established.                                                                                        |
| Internal reuse for institutional verification | `REQUIRES_CONFIRMATION` | The directory's informational purpose and public visibility are not an explicit processing grant.                                                       |
| Republication/redisplay                       | `REQUIRES_CONFIRMATION` | No source-derived republication permission or attribution terms were established.                                                                       |
| Commercial verification use                   | `REQUIRES_CONFIRMATION` | No commercial-use grant or prohibition was established.                                                                                                 |
| Attribution                                   | `NOT_ESTABLISHED`       | No directory-specific attribution statement or rule was identified.                                                                                     |
| Retention                                     | `REQUIRES_CONFIRMATION` | No retention, archival, or deletion policy for exported source data was established.                                                                    |
| Rate/access restrictions                      | `NOT_ESTABLISHED`       | No documented rate limit or supported programmatic access policy was identified. Absence of a stated limit is not permission.                           |
| Terms/privacy notice                          | `NOT_ESTABLISHED`       | The tested `/terms-of-use/` and `/privacy-policy/` paths returned 404; this does not prove no applicable notice exists elsewhere.                       |
| Copyright/licence                             | `NOT_ESTABLISHED`       | No directory-specific open licence or data-use grant was identified. No licence is inferred from the directory being public.                            |
| Record-level freshness/change timestamp       | `NOT_ESTABLISHED`       | The stated daily directory refresh is not a timestamp for when a particular operator's current status was observed or changed.                          |

**Rights conclusion:** `PRO_CERT_SOURCE_PROOF = REQUIRES_SOURCE_CONFIRMATION`.
The existing offline adapter remains `OFFLINE_SOURCE_CONTRACT_PROVEN`; it is
not a live-source authorization.

### 2. CFIA / Government of Canada licensed source

The official [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
grants broad use, including commercial use, for information actually offered
under that licence. It allows copying, modification, publication, adaptation,
and distribution, subject to the licence, attribution, and exclusions. The
licence does not automatically cover every Government of Canada webpage; it
excludes personal information, third-party rights the provider cannot
license, official symbols, and other protected rights.

The bounded search of the official Open Government Portal catalogue on
2026-10-08 did not identify a Canada Organic Regime certification-body or
operator-status resource with a dataset/resource ID and an explicit OGL
designation. The exact phrase search for “Canada Organic Regime” returned no
catalogue result. This is a bounded search result, not proof that no related
resource could exist under another title.

The official CFIA [certification-body register](https://inspection.canada.ca/en/food-labels/organic-products/certification-bodies/list-certification-bodies)
is a current HTML register; its page metadata reports modification on
2025-12-29. It provides certification-body identity, scope, country coverage,
and links to the bodies' own operator lists. No applicable OGL notice,
machine-readable COR dataset, CSV/JSON feed, API, or update contract for this
register was established in this review.

| Dataset/resource                                  | Publisher                                | Licence/formats/update                                                                                                                                                                                                              | Evidence class                                                          |
| ------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Canada Organic Regime certification-body register | CFIA                                     | No matching Open Government Portal dataset ID identified; register is an HTML page. No OGL designation for this page established. Page metadata modified 2025-12-29; this is page metadata, not an operator-status update interval. | `CERTIFICATION_BODY_ACCREDITATION`; not `OPERATOR_CERTIFICATION_STATUS` |
| COR operator status                               | Respective accredited certification body | CFIA links out to operator directories; no national CFIA operator-level OGL dataset/resource ID or operator-level API/feed was identified.                                                                                          | Source-body assertion only; unavailable from CFIA register itself       |
| Open Government Portal catalogue                  | Treasury Board of Canada Secretariat     | Catalogue search API is machine-readable; it is metadata about portal datasets and is not an organic operator-status dataset.                                                                                                       | Dataset discovery metadata, not organic certification evidence          |

If a relevant dataset is later found explicitly under OGL, its specific
resource metadata and attribution statement must be captured before use. Where
no provider-specific attribution is supplied, OGL v2.0 gives the fallback:
“Contains information licensed under the Open Government Licence – Canada.”
That fallback cannot be used to imply that this CFIA register is OGL-licensed.

**Rights/source conclusion:** CFIA is authoritative for COR scheme oversight
and certification-body accreditation. It is not a first operator-status
source for this proof, and no licensed CFIA operator-level dataset was
identified.

### 3. CARTV / SIPAB / Portail Bio Québec

CARTV's official [certification-body page](https://cartv.gouv.qc.ca/en/protection-of-appellations/accreditation-of-certification-bodies/certification-bodies/)
identifies bodies accredited for Québec's reserved “Organic” designation and
their scopes. The official public [Portail Bio Québec](https://portailbioquebec.info/node/3)
page identifies it as a provincial portal. The intended provenance path is
certification body → CARTV/SIPAB → public portal: the certifier remains the
origin of its own operator-status assertion; aggregation does not make CARTV
or the portal the certification body. However, the current materials reviewed
did not establish field-level provenance, record-level source links, or the
status/timestamp transfer from each certifier through SIPAB to the portal.
Those provenance details must be confirmed before any operator-level proof.

CARTV publishes [website terms of use](https://cartv.gouv.qc.ca/termes-dutilisation/)
that require browser access and prohibit using automated or manual processes
to access, collect, browse, or scan the CARTV website. They also state that
reproducing, reusing, or redistributing site content outside the stated
conditions requires prior written consent. These terms are a meaningful
restriction on using the CARTV website, but the SIPAB directory is hosted on
a separate domain; this review did not establish whether those CARTV website
terms also govern the separate interface.

No public API, structured bulk download, dataset-specific open licence, or
clear commercial/internal reuse grant for SIPAB/Portail Bio Québec was
established. The SIPAB interface's own access conditions and the source-data
transfer/provenance documentation require confirmation.

**Rights/source conclusion:** not selected. CARTV's public accreditation
information is useful authority evidence, but the separate directory's
access/reuse terms are unresolved; do not automate or reuse SIPAB data absent
direct confirmation.

### 4. Alternative certifier reconnaissance: Ecocert Canada

The CFIA register identifies Ecocert Canada as a COR certification body with
Canadian agricultural and aquaculture scope, and links to a directory
maintained by Ecocert. The [Ecocert customer-directory announcement](https://www.ecocert.com/en/article/news-our-new-customer-directory-is-online-5092383)
says the new directory consolidates certification/customer information and
that advanced search would be a future enhancement. This is a credible
certifier-origin operator directory, but those statements do not establish
API/feed availability, export permission, automated access, retention,
reuse, republication, commercial use, or attribution.

No explicit source-data licence or rights terms sufficient for the proposed
proof were established from the reviewed official directory and announcement.
Ecocert therefore is not a clearer rights path than Pro-Cert and is not
selected. It is a reasonable institution to approach only if Pro-Cert cannot
confirm a supported path.

## Source-decision matrix

“Not established” means the review did not find adequate evidence; it does not
mean prohibited. CARTV website restrictions are not silently applied to the
separately hosted SIPAB interface.

| Dimension                 | Pro-Cert                                                                                 | CFIA / Government of Canada                                                                                           | CARTV / SIPAB                                                                                                                | Best alternative: Ecocert Canada                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Institutional authority   | Direct COR certifier for its accredited scope; CFIA register is accreditation authority. | Scheme owner and accreditation register; not operator certifier.                                                      | Provincial appellation authority/registry operator; certifier remains the origin of its decision.                            | Direct certifier for the CFIA-listed COR scope; CFIA is accreditation authority.                          |
| Operator-level evidence   | Public operator directory; directory status is not a certificate.                        | Register is certification-body-level and links to bodies' operator lists; no CFIA operator-status dataset identified. | Public portal/registry path is described; exact interface terms and field provenance need confirmation.                      | CFIA links to Ecocert-maintained certified-customer directory.                                            |
| Machine-readable          | Search and Excel/PDF controls observed; no API/feed contract identified.                 | HTML register; no relevant OGL machine-readable operator dataset identified.                                          | No public API/structured dataset established.                                                                                | Web customer directory; public announcement says advanced search is future work; no API/feed established. |
| Automated access rights   | `REQUIRES_CONFIRMATION`                                                                  | `NOT_ESTABLISHED` for this page; OGL not established for it.                                                          | CARTV website terms restrict automated/manual collection; their applicability to the separate SIPAB interface is unresolved. | `NOT_ESTABLISHED`                                                                                         |
| Internal reuse            | `REQUIRES_CONFIRMATION`                                                                  | OGL would allow this only for information explicitly covered; none identified for COR operator records.               | `REQUIRES_CONFIRMATION`; written consent required for reuse of CARTV site content; SIPAB-specific scope unresolved.          | `NOT_ESTABLISHED`                                                                                         |
| Republication rights      | `REQUIRES_CONFIRMATION`                                                                  | No relevant OGL resource established; no operator-status source to republish.                                         | `REQUIRES_CONFIRMATION`; prior written consent for CARTV site content; SIPAB scope unresolved.                               | `NOT_ESTABLISHED`                                                                                         |
| Commercial-use rights     | `REQUIRES_CONFIRMATION`                                                                  | OGL permits commercial use for covered information, but no relevant COR resource identified.                          | `REQUIRES_CONFIRMATION`; no commercial permission established for SIPAB.                                                     | `NOT_ESTABLISHED`                                                                                         |
| Attribution defined       | `NOT_ESTABLISHED`                                                                        | OGL attribution rule applies only if a specific resource is under OGL.                                                | `NOT_ESTABLISHED` for SIPAB data.                                                                                            | `NOT_ESTABLISHED`                                                                                         |
| Freshness/change metadata | Daily directory refresh stated; no per-record status timestamp/change feed established.  | Accreditation effective/expiry dates; not operator-status freshness.                                                  | Record-level status timestamps/change feed not established.                                                                  | Per-record status timestamp/change feed not established.                                                  |
| Provenance quality        | Strong for its own certification assertions; direct certifier source.                    | Strong for accreditation; not operator status.                                                                        | Aggregated provenance path; certifier origin must be retained and verified.                                                  | Strong potential for its own assertions; direct certifier source.                                         |
| Implementation complexity | Low for one manual proof; offline adapter already exists. Rights remain blocker.         | Low for accreditation checking; cannot alone prove operator status.                                                   | Moderate; separate portal and unclear interface/data-use terms.                                                              | Moderate; new directory; no rights-backed API/export identified.                                          |
| Partnership dependency    | No partnership presumed; source confirmation/data-access agreement may be needed.        | No partnership needed for eligible OGL datasets; no relevant one identified.                                          | Written source confirmation/consent may be needed.                                                                           | No partnership presumed; source confirmation may be needed.                                               |
| Phase 3 disposition       | Not cleared                                                                              | Not suitable for operator-level status proof                                                                          | Not cleared                                                                                                                  | Not clearer than Pro-Cert; not selected                                                                   |

## Pro-Cert institutional contact route and prepared inquiry

The preferred route is the institutional contact `info@pro-cert.org`, listed
on Pro-Cert's official [Contact Us page](https://www.pro-cert.org/contact-us/)
and in the CFIA certification-body register. No individual employee is
inferred. **This inquiry is prepared but has not been sent.**

> Subject: Supported data-access route for a bounded COR status verification
>
> Hello Pro-Cert team,
>
> NzilaOS is evaluating a strictly bounded, non-public verification proof for
> one Canada Organic Regime operator. We want to use the appropriate
> institutionally supported access method, not scrape the directory. Could
> you please advise:
>
> 1. Whether a supported API, feed, or other access method is available, and
>    any applicable access/rate requirements.
> 2. Whether one COR operator record may be consulted manually or through a
>    supported programmatic route, and whether Excel/PDF exports may be
>    downloaded or retained for this bounded verification purpose.
> 3. Whether the operator name, current COR status, relevant scope/products,
>    source reference/URL, and source timestamps may be processed internally
>    for institutional verification.
> 4. Whether source-derived fields may be redisplayed to a recipient or
>    publicly, and whether commercial verification use is permitted.
> 5. Required attribution, retention/deletion, caching, and any limits on
>    onward use.
> 6. Whether a record-level timestamp identifies when the current status was
>    observed, verified, or changed, separately from record creation or the
>    directory's daily refresh.
> 7. Whether a notification or status-change feed is available.
>
> Please point us to the applicable terms or written authorization and
> recommend the supported institutional data-access method.
>
> Thank you,  
> NzilaOS

## Exact proposed Phase 3 scope (not authorized)

If Pro-Cert confirms the applicable rights in writing and a separate
go/no-go approves the proof, the proposed Phase 3A proof would be limited to:

- one operator selected for verification by the initiating institution;
- the Canada Organic Regime program only;
- one access event, using only the source-approved access method;
- the minimum fields needed to establish record identity, source-reported COR
  status, relevant scope/product, source reference, and available status
  observation/change time;
- provenance and source-check time recorded as permitted by the source;
- no contact details or unrelated source fields;
- no bulk/Excel/PDF export, automated collection, scraping, polling, cache,
  scheduled job, database ingestion, Change Watch, public display, or
  republication unless separately and explicitly authorized;
- internal, non-public verification only; no commercial republication claim
  and no inference that the directory entry replaces a supplier certificate.

Until written rights and source-timestamp semantics are confirmed, this is a
proposed future scope only: `PHASE_3_PERMISSION = NONE_GRANTED_BY_THIS_REVIEW`.
No record was selected, and Phase 3 must not begin automatically.

## Sources reviewed

Official sources reviewed on 2026-10-08:

- [CFIA policy: Information about organic operators under the Canada Organic Regime](https://inspection.canada.ca/en/food-labels/organic-products/guidance-documents/canada-organic-regime/information-organic-operators-under-cor)
- [CFIA: List of certification bodies under the Canada Organic Regime](https://inspection.canada.ca/en/food-labels/organic-products/certification-bodies/list-certification-bodies)
- [Open Government Licence – Canada, version 2.0](https://open.canada.ca/en/open-government-licence-canada)
- [Open Government Portal catalogue search API](https://open.canada.ca/data/api/3/action/package_search?q=%22Canada%20Organic%20Regime%22&rows=100)
- [Pro-Cert Client Directory](https://www.pro-cert.org/client-directory/)
- [Pro-Cert Contact Us](https://www.pro-cert.org/contact-us/)
- [Pro-Cert robots.txt](https://www.pro-cert.org/robots.txt)
- [CARTV: Certification bodies for the Québec Organic designation](https://cartv.gouv.qc.ca/en/protection-of-appellations/accreditation-of-certification-bodies/certification-bodies/)
- [CARTV website Terms of Use (French)](https://cartv.gouv.qc.ca/termes-dutilisation/)
- [Portail Bio Québec provincial portal page](https://portailbioquebec.info/node/3)
- [SIPAB public-directory entry point](http://www.produitsbioquebec.info/interroGrandPublicEn.do)
- [Ecocert certified-customer directory](https://certificat.ecocert.com/)
- [Ecocert directory announcement](https://www.ecocert.com/en/article/news-our-new-customer-directory-is-online-5092383)

## Next gate

Await Pro-Cert's written response. If it confirms a supported access and
internal-processing path, review the exact terms and timestamp semantics, then
seek separate approval for one manual record proof. If not, approach Ecocert
through its institutional channel with the same bounded questions. Do not
switch to CARTV/SIPAB or a scraper as a workaround. Keep all runtime and
commercial states unchanged until rights and governance are separately
resolved.
