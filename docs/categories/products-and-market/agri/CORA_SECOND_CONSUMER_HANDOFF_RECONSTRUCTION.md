# Second-Consumer Handoff Reconstruction

**Scope:** public-evidence-only comparison of SCIC and Walmart Canada. No
consumer is selected. No source, supplier portal, or live operator record was
accessed.

## Handoff chain comparison

### SCIC — crop insurance

| Edge                                        | Authority                                                                                           | Evidence moved / requirement                                  | Apparent mechanism                                                                                    | Known rights                                              | Unknown rights                                                                                               | Reconstruction point                                                 | Possible reusable reference                                                    | Failure state                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Certification body → authoritative evidence | Certification body certifies; SCIC requires an SCIC-approved body.                                  | Current-year certification for land under organic coverage.   | Issuer-originated certification exists in principle; SCIC does not name its accepted artifact.        | SCIC can require proof from the insured operator.         | Cora's source access, purpose, retention, redistribution, and source/provider license.                       | Not established at the source-to-record level.                       | Issuer-attributed record ID/reference, only if one exists and SCIC accepts it. | Certification not current, approved, or adequate for scope.               |
| Authoritative evidence → operator           | Certification body is the evidence issuer; operator is the insured party expected to provide proof. | Certification proof, with land relevance.                     | SCIC says proof is supplied when requested; operator's actual receipt/record workflow is unpublished. | Operator's response to SCIC's proof request is described. | Rights to make a copy or disclose particular certificate fields beyond that request; Cora's separate rights. | `RECONSTRUCTION_NOT_PUBLICLY_ESTABLISHED`.                           | Existing certificate/source reference carried under operator authorization.    | Operator cannot provide proof or scope does not cover insured land.       |
| Operator → receiving institution            | SCIC receives proof for its coverage rule.                                                          | Proof of current-year certification.                          | “When requested”; no channel or evidence format specified.                                            | Recipient may request proof under the published rule.     | Whether SCIC needs a retained copy, can verify a reference, or allows onward use.                            | Repeated upload, re-entry, and independent lookup are not described. | Reference supplied by operator, pending SCIC acceptance.                       | Proof absent, stale, mismatched, or rejected.                             |
| SCIC → requirement                          | SCIC owns the insurance rule.                                                                       | Current-year certification by an approved certification body. | Public organic-coverage program terms.                                                                | The rule is public.                                       | Full current contract procedure and case-specific evidence standards.                                        | No reconstruction inference.                                         | None established as a required reference.                                      | Requirement not met; organic coverage treatment may not apply.            |
| Requirement → independent decision          | SCIC makes coverage/price decisions; certifier makes certification decisions.                       | Evidence is used in SCIC's insurance context.                 | SCIC program and appeal procedures.                                                                   | Institutional decision separation is apparent.            | Operational decision owner, evidence review log, correction to source data.                                  | Not established.                                                     | Reference could support decision if SCIC authorizes it.                        | SCIC denies/defer coverage or applies commercial insured price per terms. |
| Decision → outcome                          | SCIC determines organic coverage and price treatment.                                               | Coverage and insured price.                                   | Published consequence: lost/not attained certification leads to commercial insured price.             | Outcome authority belongs to SCIC.                        | Exact timing and treatment of individual status changes.                                                     | No evidence about producer reconstruction.                           | Audit record of source reference plus SCIC disposition, if permitted.          | Commercial rather than organic insured price; appeal route as published.  |

### Walmart Canada — supplier/product procurement

| Edge                                        | Authority                                                                                                | Evidence moved / requirement                                                                  | Apparent mechanism                                                                     | Known rights                                                   | Unknown rights                                                                             | Reconstruction point                                                    | Possible reusable reference                                                              | Failure state                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Certification body → authoritative evidence | Certification bodies support covered Canadian organic claims under the applicable regime.                | Certification supports a compliant organic product claim.                                     | Regulatory certification process; no Walmart-specific issuer route located.            | Public regulatory framework defines certification roles.       | Source record access, reuse, commercial redistribution, retention, and correction rights.  | Walmart-linked source record not established.                           | Issuer-attributed certificate/status/scope reference, if issued and accepted by Walmart. | Claim lacks valid certification or correct product scope.                        |
| Authoritative evidence → operator           | Product supplier/operator is responsible for compliant claim and supplier obligations.                   | Organic claim support and any required supplier compliance evidence.                          | Supplier's evidence transfer to Walmart was not specified for organic material.        | General supplier compliance expectation is public.             | Operator's ability to share/copy the specific certificate and Cora's rights to process it. | `RECONSTRUCTION_NOT_PUBLICLY_ESTABLISHED`.                              | Existing operator-held evidence reference, if stable and usable.                         | Supplier cannot substantiate claim or qualify product.                           |
| Operator → receiving institution            | Walmart is the named potential buyer; its public supplier materials cover suppliers of goods for resale. | General applicable-law and supplier requirements; organic-specific evidence format not found. | Supplier Center/portal exists, but organic certificate intake was not verified.        | General supplier rules are public.                             | Exact intake, retention, redisplay, onward disclosure, and verifier terms.                 | No public evidence of repeated upload, re-entry, or independent lookup. | Reference or certificate could be supplied only if buyer accepts and rights permit.      | Supplier/product may fail Walmart requirements; specific organic remedy unknown. |
| Walmart → requirement                       | Walmart owns its supplier and product-commercial requirements; CFIA owns organic-regime oversight.       | Walmart's general compliance expectation intersects with applicable organic-claim rules.      | Supplier requirements plus product law; no specific organic onboarding rule evidenced. | Division of buyer and regulator roles is clear.                | Organic-specific buyer policy and responsible decision role.                               | No reconstruction inference.                                            | No buyer-required reference established.                                                 | Product may not meet legal claim conditions or buyer rules.                      |
| Requirement → independent decision          | Walmart retains commercial supplier/product decisions; CFIA retains its regulatory role.                 | Supplier/product qualification and sale decision.                                             | Walmart supplier process at a general level.                                           | Walmart is distinct from the certification body and regulator. | Evidence review criteria, appeal/correction, and issuer-reference acceptance.              | Not established.                                                        | Could be an issuer reference if Walmart adopts it.                                       | Commercial rejection, delisting, or other remedy not specified publicly.         |
| Decision → outcome                          | Walmart controls assortment/supplier decisions; organic law constrains product claims.                   | Product/supplier commercial status and claim compliance.                                      | No organic-specific event/outcome protocol found.                                      | Commercial decision is buyer-controlled.                       | Exact consequences, review path, evidence retention, and expiry response.                  | No evidence about reconstruction.                                       | Auditable reference disposition possible in principle.                                   | Organic claim cannot be represented as compliant; buyer consequence unknown.     |

## What counts as reuse here

| Form                      | What it proves                                                                                | Candidate status                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| File reuse                | The same document is copied or re-uploaded.                                                   | Not sufficient by itself for the proof contract's same-reference event.                                                                               |
| Certificate upload reuse  | An existing certificate is submitted again.                                                   | May avoid re-creating the underlying fact, but does not establish source-reference reuse or acceptance of a reusable issuer reference.                |
| Source-reference reuse    | The same issuer-attributed reference is authorized for the independent recipient requirement. | The narrowest plausible target; neither SCIC nor Walmart's acceptance is publicly established.                                                        |
| Direct verification reuse | Recipient checks status/scope with the issuer or issuer-supported endpoint.                   | Not evidenced for either recipient; requires source authorization and receiver acceptance.                                                            |
| Normalized evidence reuse | A transformed Cora representation is reused.                                                  | Not the preferred first proof because transformation could obscure issuer authority; requires explicit lineage, permission, and recipient acceptance. |

## Architecture comparison

Ratings are ordinal: 5 is more favorable to a bounded first proof; source
dependency is scored 5 when dependence is low. Evidence integrity and
recipient trust measure publicly supported feasibility, not assumed
participation.

### SCIC

| Architecture                                  | Rights burden | Implementation burden | Integrity | Freshness | Operator burden | Recipient trust | Auditability | Repeatability | Source dependency |
| --------------------------------------------- | ------------- | --------------------- | --------- | --------- | --------------- | --------------- | ------------ | ------------- | ----------------- |
| A. Operator-carried existing evidence         | 3             | 4                     | 4         | 3         | 2               | 3               | 3            | 2             | 4                 |
| B. Source-reference verification              | 2             | 2                     | 5         | 5         | 4               | 2               | 4            | 3             | 1                 |
| C. Supported institutional source integration | 1             | 1                     | 5         | 5         | 4               | 3               | 5            | 4             | 1                 |

### Walmart Canada

| Architecture                                  | Rights burden | Implementation burden | Integrity | Freshness | Operator burden | Recipient trust | Auditability | Repeatability | Source dependency |
| --------------------------------------------- | ------------- | --------------------- | --------- | --------- | --------------- | --------------- | ------------ | ------------- | ----------------- |
| A. Operator-carried existing evidence         | 3             | 3                     | 4         | 3         | 2               | 2               | 3            | 2             | 4                 |
| B. Source-reference verification              | 2             | 2                     | 5         | 5         | 4               | 1               | 4            | 3             | 1                 |
| C. Supported institutional source integration | 1             | 1                     | 5         | 5         | 4               | 2               | 5            | 4             | 1                 |

Architecture A may avoid Cora's direct source access but requires explicit
operator authority and a recipient-defined evidence route; its use of a copy
does not itself meet same-reference reuse. B is a plausible target only after
recipient acceptance and all source/provider/operator permissions are
established. C must not be pursued without documented source support and
rights. No architecture is approved for execution.

## Rights and decision safeguards

- Recipient evidence requirement, operator authority to provide a document,
  source/provider permission, and Cora's processing rights are separate
  questions.
- Neither public evidence set shows whether the receiver needs a copy or only
  verification, its retention period, onward disclosure, correction route,
  or whether commercial use changes permissions.
- A verification endpoint may improve freshness, provenance, and operator
  burden; it cannot create permission.
- The receiving institution must retain independent authority to accept,
  reject, defer, request further evidence, and make its own decision.
- Pro-Cert/Ecocert rights remain unresolved. No direct-source architecture is
  eligible for implementation on the current record.

## Disposition

SCIC has the stronger public proof context: a named institution, an explicit
current-year certification requirement, a proof-on-request statement, and a
material insured-price consequence. Its same-reference acceptance and
reconstruction burden remain unknown. Walmart Canada is a named buyer
candidate, but the reviewed public record establishes only general supplier
compliance plus applicable organic claim rules, not a buyer-side organic
evidence handoff. Recipient discovery about SCIC's acceptance of
issuer-attributed references is justified as a future authorized step; no
outreach is drafted or sent. Source-rights outreach remains premature.

```text
SCIC_RECONSTRUCTION = NOT_PUBLICLY_ESTABLISHED
WALMART_RECONSTRUCTION = NOT_PUBLICLY_ESTABLISHED
SECOND_CONSUMER = UNRESOLVED
```
