# Cora Organic Public Source Authority and Registry

**Status:** source review and offline synthetic adapter proof only. No source
is registered for runtime collection, and no operator record was fetched,
exported, or retained.

## Phase 2B first-source decision

The bounded source-rights review did not clear a first live operator-level
source. The current outcome is
[`CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md`](CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md):

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PRO_CERT_SOURCE_PROOF = REQUIRES_SOURCE_CONFIRMATION
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
PHASE_3_PERMISSION = NONE_GRANTED_BY_THIS_REVIEW
```

Pro-Cert remains the first candidate by institutional priority, not an
approved runtime source. No operator record was accessed or exported, and no
source was added to runtime configuration.

Use the [certifier data-access request](CORA_ORGANIC_CERTIFIER_DATA_ACCESS_REQUEST.md)
for the source-neutral question set and unsent institutional drafts, and the
[source-access decision record](CORA_ORGANIC_SOURCE_ACCESS_DECISION_RECORD.md)
to capture source-specific conditions. Neither document grants rights or
activates a source.

## Publication authority is not collection or reuse authority

CFIA identifies itself as the scheme owner of the Canada Organic Regime and
states that it requires CFIA-accredited certification bodies to publish
specified organic-operator information, including certification status,
products, and categories, in an online directory. This supports
`PUBLICATION_AUTHORITY = ESTABLISHED` for those required fact classes under
that regime, where the relevant certification body and source are verified.

The publication requirement does **not** itself grant unrestricted scraping,
automated access, bulk collection, commercial reuse, republication, enrichment,
or inference of private facts. Record each permission separately. Rights that
are unresolved remain `UNKNOWN`, `NOT_ESTABLISHED`, or
`REQUIRES_CONFIRMATION`, never an implied grant.

Official references:

- [CFIA: Information about organic operators under the Canada Organic Regime](https://inspection.canada.ca/en/food-labels/organic-products/guidance-documents/canada-organic-regime/information-organic-operators-under-cor) — publication policy and the specified operator fields.
- [CFIA: List of certification bodies under the Canada Organic Regime](https://inspection.canada.ca/en/food-labels/organic-products/certification-bodies/list-certification-bodies) — current accreditation and scope reference; identifies Pro-Cert as COR00906030, with published effective and expiration dates.
- [Pro-Cert client directory](https://www.pro-cert.org/client-directory/) — direct public directory reviewed for its declared purpose, status language, listed programs, and visible access controls. No operator row or export was opened or retained.
- [CARTV certification bodies](https://cartv.gouv.qc.ca/en/protection-of-appellations/accreditation-of-certification-bodies/certification-bodies/) and [Portail Bio Québec resources](https://cartv.gouv.qc.ca/en/tools-and-resources/information-for-the-public-and-for-businesses/useful-resources/) — Québec authority and directory discovery references; dataset-specific source roles and rights must be checked.
- [COTA directory](https://canada-organic.ca/en/directory) and [COTA data and research](https://canada-organic.ca/en/what-we-do/research) — sector/member and market-information sources; not certification authority.

## Registry entry design

The local `organicSourceRegistryEntrySchema` represents:

| Field                                       | Meaning                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institution and explicit roles              | Scheme authority, conformity verification body, certification body, aggregator, interpretation authority, sector convenor, or market-intelligence publisher |
| Source class, URL, exposed data classes     | What source is being considered and which fact classes it exposes                                                                                           |
| Publication authority                       | State, basis, and evidence reference                                                                                                                        |
| Access method                               | Public web, manual request, API, bulk file, or unknown                                                                                                      |
| Automated access, reuse, republication      | Independent states: established allowed/prohibited, not established, requires confirmation, not applicable, unknown; legacy states remain accepted          |
| Terms reference and last legal/terms review | Traceable basis and review record, if actually available                                                                                                    |
| Expected refresh metadata                   | Source-declared cadence and observation/check time only; never an inferred authorization threshold                                                          |

The schema is a contract, not a production allowlist or source configuration.
There is no active CFIA, certification-body, CARTV/SIPAB, Portail Bio Québec,
or COTA connector.

## Pro-Cert source review

The public Pro-Cert page says its directory lists certified operators,
products, and current certification status; that it is updated daily; and that
it is informational, not a substitute for collecting certificates from
suppliers. It describes `Certified` as good standing, says suspended
operations may not transact organic products until reinstated, and says
cancelled, revoked, or denied operations must not represent products as
compliant. The page lists COR, USDA NOP, and COS programs, with COS explicitly
identified as out of scope for COR. These are source statements, not Cora
conclusions or certificate evidence.

CFIA's current certification-body listing identifies Pro-Cert as COR00906030,
effective February 15, 2026 through February 15, 2031, and gives its COR
standards and categories. Combined with CFIA's COR publication policy, this
supports publication authority for the policy's required COR operator fields
where a COR record and field are actually established. It does not extend
that conclusion to the directory's NOP/COS records.

The directory visibly offers search, print, Excel and PDF controls and page
sizes including `All`. `robots.txt` does not disallow the directory URL, but
does disallow `/pdfs/` and PDF files. No export, bulk download, record search,
or PDF path was used. A visible export control or non-disallowance in
`robots.txt` is not permission for automated access, reuse, republication, or
commercial processing. No API/feed contract was identified in this bounded
review.

The tested Pro-Cert `/terms-of-use/` and `/privacy-policy/` URLs returned 404.
This does not establish that no other terms, directory notice, licence, or
privacy conditions apply. The directory page did not expose a terms link in
the reviewed content. Accordingly, automated access, reuse, and republication
remain `REQUIRES_CONFIRMATION`; an absent terms page is not treated as
permission or prohibition. `sourceAccessMethod = PUBLIC_WEB` records only
the observed browser-accessible page.

The offline adapter preserves only a source registry reference, raw status,
program, scope, products, explicit status-observation time, and separate
record-created/record-updated metadata. Unknown source fields (including
synthetic name, contact, telephone, and address fields) are discarded. A
record is typed `DIRECTORY_STATUS`, never `CERTIFICATE`. The source's daily
refresh statement remains descriptive metadata and is not used as a
freshness threshold. Missing or invalid status-observation time is unresolved
and cannot be supplied by record creation/update metadata.

`PRO_CERT_SOURCE_PROOF = REQUIRES_SOURCE_CONFIRMATION`
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`

Prepared, not sent, source question: “Please identify the current terms or
directory notice governing manual and automated access, Excel/PDF export,
retention, reuse, republication, attribution, and commercial processing of
directory records. Does the directory provide a record-level timestamp that
specifically represents when the current certification status was observed
or changed, rather than record creation or the directory's daily refresh?”

## Source-role handling

- **CFIA:** scheme authority; its accredited-body list establishes where to
  look for the responsible certification body, not an operator status.
- **Certification body:** source authority for its own certification decision
  and status assertion, subject to verified scheme accreditation and
  case-specific evidence.
- **CARTV/SIPAB and Portail Bio Québec:** record the role actually evidenced
  for each provincial authority/directory/aggregation dataset. Do not replace
  the certifier as origin.
- **COTA:** sector convenor and market-intelligence publisher where the
  specific publication establishes those roles. Any aggregated fact retains
  the origin and source reference; membership is separate from certification.
- **Pro-Cert:** certification body for its verified COR scope and direct
  publisher of its own directory assertions. Directory rows remain
  `DIRECTORY_STATUS` evidence, not certificates; rights for automated access,
  reuse, and republication still require confirmation.

## Acquisition gate

Before any future live proof, document the exact source and data class, source
authority, human access path, technical access method, terms, automated access
permission, permitted processing/reuse, republication rights, privacy and
minimization, refresh metadata, and review date. Do not persist source data
until that review and a bounded Phase 2 test plan are approved. No live public
source access, crawling, polling, or notification was performed or enabled in
the foundation phase.
