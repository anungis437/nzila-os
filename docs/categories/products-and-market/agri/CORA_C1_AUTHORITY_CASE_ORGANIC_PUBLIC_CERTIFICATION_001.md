# C1 Organic Public Certification Evidence Case

- **Case ID:** `CORA_C1_AUTHORITY_CASE_ORGANIC_PUBLIC_CERTIFICATION_001`
- **Case type:** public evidence-class authority case (not an individual operator record)
- **Scheme:** Canada Organic Regime
- **Fact class:** `organic.certification.status`
- **Recipient:** Cora evidence layer
- **Purpose:** institutional verification/composition
- **Publication authority:** `ESTABLISHED` for the specified Canada Organic Regime operator-information fields under CFIA's publication policy
- **Automated access rights:** `REQUIRES_CONFIRMATION`
- **Reuse rights:** `REQUIRES_CONFIRMATION`
- **Republication rights:** `REQUIRES_CONFIRMATION`
- **Pro-Cert source-proof disposition:** `REQUIRES_SOURCE_CONFIRMATION`
- **Cora runtime source proof:** `NOT_YET_PROVEN`

## Scope and case boundary

This case establishes a real, documented public evidence class and a source
authority path; it does not instantiate a particular operator, certificate,
status, product record, or recipient organization. No directory record was
fetched, exported, or retained. Do not represent the case as commercial
validation, a COTA partnership, a producer authorization, or Cora certification.

CFIA's published policy identifies CFIA as scheme owner of the Canada Organic
Regime and says it requires accredited certification bodies to publish
organic-operator name, contact information, certification status, certified
products, and product categories in an online directory. This establishes the
publication-authority basis for those specified fields under the scheme, once
the relevant accredited body and record are verified.

Primary source: [CFIA policy on information about organic operators under the Canada Organic Regime](https://inspection.canada.ca/en/food-labels/organic-products/guidance-documents/canada-organic-regime/information-organic-operators-under-cor).

The [CFIA list of certification bodies](https://inspection.canada.ca/en/food-labels/organic-products/certification-bodies/list-certification-bodies) is the authority discovery point for identifying and verifying an accredited body and scope. The certification body remains the origin of its own operator certification decision. Cora and any aggregator do not become the certifier.

The [Pro-Cert client directory](https://www.pro-cert.org/client-directory/)
states that it lists operators, products, and current status; is updated
daily; and is informational rather than a substitute for supplier
certificates. It describes its statuses and lists COR, USDA NOP, and COS (the
page labels COS out-of-scope for COR). CFIA's current listing identifies
Pro-Cert as COR00906030 and gives its COR scope and accreditation validity.
This verifies the source institution's COR standing, not any individual
operator's status or certificate.

## Authority and rights assessment

| Question                | Case finding                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheme authority        | CFIA is identified by CFIA's policy as the Canada Organic Regime scheme owner.                                                                                                      |
| Certification authority | Pro-Cert is listed by CFIA as COR00906030 for its stated scope; it is a reviewed source candidate, but no individual operator record or certificate is selected in this class case. |
| Publication authority   | `ESTABLISHED` for operator fields that the CFIA policy requires accredited bodies to publish.                                                                                       |
| Automated access        | `REQUIRES_CONFIRMATION`; publication in an online directory or visible export controls are not blanket permission to automate access.                                               |
| Acquisition method      | Pro-Cert's browser-accessible public directory was reviewed without opening a record or using its export controls; no acquisition is activated.                                     |
| Reuse rights            | `REQUIRES_CONFIRMATION`; no commercial, analytics, or derived-use permission is inferred.                                                                                           |
| Republication rights    | `REQUIRES_CONFIRMATION`; display in Cora requires a separate rights determination.                                                                                                  |
| Privacy/minimization    | A particular operator record and data fields have not been selected; minimize and review before any collection.                                                                     |
| Recipient decision      | Cora presents the evidence; a receiving institution independently accepts, rejects, or requests verification.                                                                       |
| Authority instrument    | CFIA's published COR policy is the publication-authority basis for the enumerated fields; it is not a blanket data-use licence.                                                     |

For the Pro-Cert directory specifically, the page visibly offers search,
print, Excel, and PDF controls, and its `robots.txt` excludes `/pdfs/` and
PDF files. The directory and controls were reviewed without opening records
or exporting data. The presence of an export control is not a grant of
automated access, retention, reuse, republication, or commercial-use rights.
The tested `/terms-of-use/` and `/privacy-policy/` URLs returned 404; this
does not prove that no other terms or directory notice applies. Those rights
remain `REQUIRES_CONFIRMATION`.

The offline adapter models directory claims as `DIRECTORY_STATUS`, keeps
program/scope/products and source timestamps distinct, and discards
non-allowlisted fields. A directory claim is never upgraded to `CERTIFICATE`.
The page's “updated daily” statement is recorded as expected refresh metadata
only, not as a freshness policy. No production source mapping or freshness
interval is introduced.

This is a class-level public-source authority finding only. A real record-level
case still needs a verified operator reference, actual certification body,
source record, scope, timestamps, access/reuse decision, and recipient-specific
purpose and decision rights.

## C1 closure and next boundary

`PUBLICATION_AUTHORITY = ESTABLISHED` applies only to the CFIA-mandated
publication class. It does not close operator-level source identity,
acquisition, reuse, republication, privacy, or recipient decisions.

`CORA_C1_ORGANIC_CASE = PUBLICATION_CLASS_ESTABLISHED`

`CORA_C1_ORGANIC_RECORD_AUTHORITY = NOT_YET_INSTANTIATED`

`PRO_CERT_SOURCE_PROOF = REQUIRES_SOURCE_CONFIRMATION`
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`

The next phase may evaluate one source only after its applicable terms,
automated access, reuse, republication, and permitted processing are confirmed.
No live collection or export is authorized by this case document.
