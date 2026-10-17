# Cora FV001 Discovery Gaps

**Status:** Public documentation exhaustion completed for the reviewed
official sources; no outreach has been sent.
**Rule:** Do not ask FieldView humans questions answered by the public API
documentation. Keep technical access confirmation separate from rights and
privacy-governance discovery.

## Classification key

- `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION`
- `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION`
- `REQUIRES_FIELDVIEW_PRIVACY_GOVERNANCE_CONFIRMATION`

## Public questions removed from the human agenda

| Question                                           | Classification                                                      | Public answer                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Does v4 list and retrieve fields?                  | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | `GET /v4/fields` and `GET /v4/fields/{fieldId}`; list supports a field-name prefix and standard pagination.                                                                                                              |
| How are fields linked to land/spatial records?     | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` for the documented v4 shape      | Field schema has UUID, boundary UUID, resource-owner UUID, and a parent UUID/type of `farm`; spatial attributes are in Boundary. This does not prove legal ownership.                                                    |
| Can a boundary be fetched by ID or batch?          | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | Get by UUID or POST-query up to ten known boundary IDs. No boundary-list operation was found.                                                                                                                            |
| What operation/activity classes are exposed?       | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | A user-accessible operations list, plus separate as-planted, as-applied, as-harvested, and scouting routes; activity summary and raw content operations are documented.                                                  |
| Are activity times and change filters documented?  | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` for activities                   | Activity summaries document several timestamps; crop layer lists accept occurrence and `updatedAfter` filters. This does not apply to land records or prove completeness.                                                |
| What are the v4 paging and large-content rules?    | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | Header paging, limits, next tokens, `206`/`304`/expired-token behavior, and ranged chunk transfer are described. `304` wording differs by context and is not an ETag guarantee.                                          |
| Is there documented shapefile export?              | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | Reviewed v4 documents GeoJSON planting/harvest exports and JSON/PDF yield reports; shapefile ZIP is documented as an upload/prescription format, not an export.                                                          |
| Can the API access a user’s shared operations?     | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | FAQ says APIs currently return only information belonging to the authorized authenticated user and do not support shared-user operation data; it recommends explicit partner-account connection.                         |
| How does platform partner onboarding begin?        | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | FAQ outlines business/value discussion, agreement on partner terms, and build/deploy; client ID/secret are provided by Climate and the API key has a partner usage plan. No Cora approval follows from that description. |
| Does OAuth use `offline_access`?                   | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` for the inspected specifications | No such scope is listed; refresh-token issuance and rotation are documented separately.                                                                                                                                  |
| Is v5 available as a released production contract? | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                                  | Published “Next Versions” schema is version `0.0.0`, with reviewed operations tagged `ALPHA`/`BETA`; do not treat it as generally released.                                                                              |

## Remaining technical questions

| Question                                                                                                                                                                              | Classification                              | Why public documentation is insufficient                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Which exact v4 endpoint-scope pairs will FieldView authorize for a qualified partner, especially `boundaries:write`, `rxZones:write`, and the export scopes described inconsistently? | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | The top-level scope catalog and endpoint/product prose do not align in all cases.                                    |
| What is the production onboarding/environment path, and what partner-specific API key/usage plan, quotas, and enablement apply to Cora?                                               | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | Public schema describes API hosts and partner usage plans, not Cora’s approval or configuration.                     |
| What are the exact farm-organization/resource-owner identity and relationship semantics, listability, and user visibility rules for the production v4 API?                            | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | v4 exposes a get-by-ID farm organization and sparse owner/field models, not a complete organization graph.           |
| What does `304` mean for each list/content endpoint, and is any endpoint using conditional cache validation?                                                                          | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | API overview and FAQ use different descriptions; no ETag/If-None-Match contract was found.                           |
| Are fields/boundaries archived, deactivated, replaced, deleted, or timestamped in production, and what reconciliation method reports each transition?                                 | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | Those lifecycle fields/events are absent from the reviewed v4 land schema.                                           |
| What are the precise units, coordinate reference, precision, and timestamp roles for each agronomic payload and exported product?                                                     | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | Semantics vary by product and raw file; the API schema is not a global unit/time ontology.                           |
| Does any supported production path provide events/webhooks or replayable deletion notifications beyond the reviewed v4 spec?                                                          | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | No such v4 API surface was identified; public omission does not establish nonexistence in partner-specific material. |
| What is the actual v5 release stage, target availability, compatibility policy, and support status for each desired route?                                                            | `REQUIRES_FIELDVIEW_TECHNICAL_CONFIRMATION` | The public “Next Versions” file is explicitly preview-stage and version `0.0.0`.                                     |

## Rights questions that remain contractual

These are not answered by API scopes, customer ownership language, user
consent, or a successful export. They must be asked against the actual
platform-partner terms applicable to Cora.

| Question                                                                                                                                                                                    | Classification                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| May Cora persist each API data class, raw payload, attachment, or export, and for what duration, purpose, and territory?                                                                    | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| May Cora normalize, map, deduplicate, combine, or create a derived semantic representation from Customer Farm Data? What source representation and provenance must be retained?             | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| May Cora export captured data to the operator or a named institution, and may that recipient retain and use it for a specified institutional purpose?                                       | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| May Cora onward-share data, or use it with a replacement provider or independent reader?                                                                                                    | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| What rights survive OAuth disconnect, user-account deletion, partner termination, or a change of provider? What must be deleted, including backups, mappings, derived values, and capsules? | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| Are commercial use and AI/model training, evaluation, or inference permitted, restricted, or excluded?                                                                                      | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |
| Which data in v4 responses is Customer Farm Data, FieldView Generated Works, or Third Party Content, and what use restrictions attach to each?                                              | `REQUIRES_FIELDVIEW_CONTRACTUAL_CONFIRMATION` |

## Privacy and governance questions

| Question                                                                                                                                                                                                                   | Classification                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| For each party and data class, who is controller, processor, service provider, or recipient, and what DPA/data protection terms are required?                                                                              | `REQUIRES_FIELDVIEW_PRIVACY_GOVERNANCE_CONFIRMATION` |
| Which personal data (including resource-owner email, account identifiers, or operator/user attribution) may the partner API disclose, and what notice, lawful basis, minimization, security, and retention controls apply? | `REQUIRES_FIELDVIEW_PRIVACY_GOVERNANCE_CONFIRMATION` |
| What happens to Cora-held personal data and derived identifiers when the user withdraws consent, closes the FieldView account, or exercises a privacy right?                                                               | `REQUIRES_FIELDVIEW_PRIVACY_GOVERNANCE_CONFIRMATION` |

## Narrow initial discovery agenda

If human discovery is later authorized, route only these items:

1. **Partner and technical route:** confirm Cora’s eligibility, applicable
   partner agreement and production onboarding, the v4 endpoint/scope matrix
   where the public OpenAPI conflicts, user/resource-owner visibility, and
   supported change/deletion semantics.
2. **Data-use rights:** obtain express terms for persistence duration,
   normalization/derived representation, producer/recipient export,
   onward-sharing, replacement-provider/independent rehydration,
   disconnect/revocation/termination and deletion, commercial use, and
   AI/model use.
3. **Privacy governance:** determine role allocation, permitted personal
   data, notices/bases, DPA requirements, and deletion/retention duties.

No questions about basic v4 list/get paths, OAuth flow, token lifetimes,
pagination rules, basic activity types, or the documented shared-user access
limitation should be sent; public official materials already address those.
No outreach has been sent.
