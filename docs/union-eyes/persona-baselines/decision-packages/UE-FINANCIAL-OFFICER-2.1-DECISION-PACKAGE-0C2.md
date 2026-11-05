# Financial Officer 2.1 — Decision Package 2.1-R1

**Status: PROPOSED_FOR_RATIFICATION.** PROPOSED FOR RATIFICATION. This package is prepared for a decision by an authorized product owner. It is not a ratified canonical, not the recovered historical canonical and not an institutional authorization. Engineering cannot accept it.

- Package: `UE-FINANCIAL-OFFICER-PROPOSED-CANONICAL-2.1-R1` version `2.1-R1`
- Package register: `docs/union-eyes/convergence/register/ue-persona-decision-package-financial-officer-0c2.json`
- Package sha256: `5ec3e9a10eb6c4458f467f5b8e659d746f6631924664d9f7ca062c6e435c3889`
- Decision record: `PDR-0C2-FINANCIAL-OFFICER-V1` state `PROPOSED_FOR_RATIFICATION`
- Decision-owner role: `AUTHORIZED_PRODUCT_OWNER`
- Source baseline: `docs/union-eyes/convergence/register/ue-persona-proposed-baseline-financial-officer.json` (`01e11c12ce91b8ec96ff9d0af68595296effbc36e6f05def07ea0a02f677c216`), unchanged, status `PROPOSED_NOT_ADOPTED`
- Historical canonical recovered: **no**. UE-FINANCIAL-OFFICER-CANONICAL-2.1 is cited by a frozen disposition and its text was not recovered. This package is a reconstruction candidate built from the proposed baseline and is not that document.

## Action universe

55 requirements. Kinds: DENIAL 5, DOMAIN 29, JOURNEY 10, NAVIGATION 7, SCENARIO 4. Authority classes: ENGINEERING_REQUIREMENT 1, IMPLEMENTED_SOURCE_BEHAVIOR 5, PROPOSED_PERMISSION 49. Adopted institutional authorizations: 0.

## Visibility and workflow matrix (eleven domains)

| Domain | Coverage | Requirements | Open product decision |
| --- | --- | --- | --- |
| Identity and eligibility | COVERED | FO-NAV-7, F01, F28, FO-DENY-03 | _none_ |
| Organization and federation scope | PARTIAL | F10, FO-SCN-CAPE, FO-SCN-CUPE, FO-SCN-LIUNA, FO-SCN-SMALL-LOCAL | DEC-PD-0C2-07 |
| Case, member and document visibility | COVERED | FO-NAV-1, FO-NAV-2, FO-NAV-3, FO-NAV-4, FO-NAV-5, FO-NAV-6, F03, F08, F22 | _none_ |
| Record creation and updates | COVERED | F02, F04, F05, F07, F09, F11, F12, F13, F14, F23 | _none_ |
| Delegation and substitution | PARTIAL | FO-DENY-04 | DEC-PD-0C2-08 |
| Confidentiality and privileged records | COVERED | F25 | _none_ |
| Financial or administrative approvals | COVERED | F15, F16, F17, F18, F20, F24, FO-DENY-01, FO-DENY-02 | _none_ |
| Audit and accountability | COVERED | F19, F21, F27, FO-DENY-05 | _none_ |
| Notifications and workflow transitions | PARTIAL | F06, FJ01, FJ02, FJ03, FJ04, FJ05, FJ06, FJ07, FJ08, FJ09, FJ10 | DEC-PD-0C2-09 |
| Revocation, termination and historical access | COVERED | F26 | _none_ |
| Cross-persona handoffs | COVERED | FO-BND-WORKAID | _none_ |

- **Identity and eligibility** (COVERED): A role title carries no financial authority. Each financial duty needs a live issued mandate or appointment. No financial mandate has been issued and nothing in this package issues one.
- **Organization and federation scope** (PARTIAL): Finance is bounded to the active organization. Affiliate remittances are UNAVAILABLE_501 and the four organization scenarios are hypotheses with no source backing.
- **Case, member and document visibility** (COVERED): Balances, member financial records and reports are visible only for the accounts and fields a live mandate names. A view duty does not carry a report, member-level rows or an export.
- **Record creation and updates** (COVERED): Accounts, dues, charges, receipts, remittance sources, vendors, invoices and tax records are prepared under a prepare duty. Preparation is separate from approval and execution.
- **Delegation and substitution** (PARTIAL): A financial duty cannot be delegated. A permanent change goes through succession and revocation. A temporary absence has no specified path.
- **Confidentiality and privileged records** (COVERED): Financial personal data, banking fields and member-level rows are separate grants. External accounting export is a separate duty-checked action. Platform billing is not union finance.
- **Financial or administrative approvals** (COVERED): View, prepare, approve, execute, reconcile and audit stay separate duties. Whether one principal may hold two is decided by a separation rule evaluated against the actual transaction. No real mandate, payment or export is authorized.
- **Audit and accountability** (COVERED): Financial evidence, the audit trail, auditor and trustee duties and reconciliation are specified. A capability that is unavailable never reports success.
- **Notifications and workflow transitions** (PARTIAL): Arrears follow-up is the only notification specified. Approval, execution and reconciliation name workflow states without a notification rule.
- **Revocation, termination and historical access** (COVERED): Succession and revocation, the mandate oversight view and the audit access that survives a mandate are specified. Revocation ends the duty on the next request and keeps the historical record.
- **Cross-persona handoffs** (COVERED): The WorkAid boundary holds no referral power for the Financial Officer. Member financial records meet representation only through explicit denials and the audit trail.

## Action and visibility rows

| Requirement | Kind | Domain | Authority class | Implementation | Gate |
| --- | --- | --- | --- | --- | --- |
| FO-NAV-1 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-NAV-2 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| FO-NAV-3 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| FO-NAV-4 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| FO-NAV-5 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-NAV-6 | NAVIGATION | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-NAV-7 | NAVIGATION | IDENTITY_ELIGIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F01 | DOMAIN | IDENTITY_ELIGIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F02 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F03 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F04 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F05 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F06 | DOMAIN | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F07 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F08 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F09 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | SOURCE_PRESENT | 5 |
| F10 | DOMAIN | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F11 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F12 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F13 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F14 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F15 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | SOURCE_PRESENT | 5 |
| F16 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | SOURCE_PRESENT | 5 |
| F17 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F18 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F19 | DOMAIN | AUDIT_ACCOUNTABILITY | PROPOSED_PERMISSION | UNAVAILABLE_501 | 5 |
| F20 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F21 | DOMAIN | AUDIT_ACCOUNTABILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F22 | DOMAIN | CASE_MEMBER_DOCUMENT_VISIBILITY | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F23 | DOMAIN | RECORD_CREATION_UPDATE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F24 | DOMAIN | FINANCIAL_ADMIN_APPROVALS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F25 | DOMAIN | CONFIDENTIALITY_PRIVILEGED | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| F26 | DOMAIN | REVOCATION_TERMINATION_HISTORY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F27 | DOMAIN | AUDIT_ACCOUNTABILITY | PROPOSED_PERMISSION | PARTIAL_SOURCE | 5 |
| F28 | DOMAIN | IDENTITY_ELIGIBILITY | ENGINEERING_REQUIREMENT | NOT_IMPLEMENTED | 5 |
| FO-BND-WORKAID | DOMAIN | CROSS_PERSONA_HANDOFFS | PROPOSED_PERMISSION | PARTIAL_SOURCE | 7 |
| FO-DENY-01 | DENIAL | FINANCIAL_ADMIN_APPROVALS | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 5 |
| FO-DENY-02 | DENIAL | FINANCIAL_ADMIN_APPROVALS | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 5 |
| FO-DENY-03 | DENIAL | IDENTITY_ELIGIBILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 5 |
| FO-DENY-04 | DENIAL | DELEGATION_SUBSTITUTION | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 5 |
| FO-DENY-05 | DENIAL | AUDIT_ACCOUNTABILITY | IMPLEMENTED_SOURCE_BEHAVIOR | SOURCE_PRESENT | 5 |
| FJ01 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ02 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ03 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ04 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ05 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ06 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ07 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ08 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ09 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FJ10 | JOURNEY | NOTIFICATIONS_WORKFLOW | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-SCN-CAPE | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-SCN-CUPE | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-SCN-LIUNA | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |
| FO-SCN-SMALL-LOCAL | SCENARIO | ORG_FEDERATION_SCOPE | PROPOSED_PERMISSION | NOT_IMPLEMENTED | 5 |

## Negative security and tenant-isolation criteria

- **NSC-FO-01** (TENANT_ISOLATION): In a synthetic two-organization fixture, a mandate holder in organization A cannot view, prepare, approve or export an account, charge, receipt or report of organization B. Requirements: F03, F08, F15, F22.
- **NSC-FO-02** (ROLE_TITLE_IS_NOT_MANDATE): A principal with a finance, treasurer or officer role title and no live mandate performs no financial action and sees no financial navigation. Requirements: FO-DENY-01, FO-NAV-1, F01.
- **NSC-FO-03** (SEPARATION_RULE): Where an institution has adopted a separation rule, the same principal is refused both halves of the protected pair on the same transaction, and the refusal names the rule. Requirements: FO-DENY-03, F15, F16, FJ01, FJ05.
- **NSC-FO-04** (PLATFORM_BILLING_IS_NOT_UNION_FINANCE): Nzila platform billing and entitlement confer no union financial authority and are never offered as a union finance destination. Requirements: FO-DENY-02, FO-NAV-1.
- **NSC-FO-05** (REPORT_EXPORT_MEMBER_ROWS_ARE_SEPARATE): A view duty does not carry a report, member-level rows or an export. Each is checked as its own duty and field grant. Requirements: F08, F22, F25.
- **NSC-FO-06** (UNAVAILABLE_IS_NOT_SUCCESS): A capability that is NOT_IMPLEMENTED or answers HTTP 501 never reports success, and its navigation entry is not advertised as usable. Requirements: FO-DENY-05, F10, F11, F17.
- **NSC-FO-07** (NO_REAL_MANDATE_OR_PAYMENT): No real financial mandate is issued and no real payment, payment rail or external accounting export is executed from any test or fixture. Requirements: F01, F16, F25.
- **NSC-FO-08** (REVOKED_MANDATE): After a mandate is revoked or succeeded, the holder’s next request is refused and the historical record stays. Requirements: F26, FJ10.
- **NSC-FO-09** (NO_DELEGATION): A financial duty cannot be delegated or lent, and an attempt is refused and audited. Requirements: FO-DENY-04.
- **NSC-FO-10** (HIERARCHY_IS_NOT_SCOPE): A mandate holder in a local, region or national office gains no view of, and no duty over, another organization’s finances from the organization hierarchy. Cross-organization finance scope exists only as an issued instrument (DEC-PD-0C2-07). Requirements: F03, F10, F22.

## Dependencies on other personas

- representative via RELATED_REQUIREMENT: FO-BND-WORKAID->R18, FO-BND-WORKAID->REP-ACT-24
- representative via SHARED_OBLIGATION: SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-WORKAID-REFERRAL
- steward via SHARED_OBLIGATION: SHR-0C2-LANGUAGE-ACCESSIBILITY, SHR-0C2-WORKAID-REFERRAL

## Outstanding product decisions

- `DEC-IA-16` Financial mandate issuance rule (OUTSTANDING)
- `DEC-IA-24` Strike and restricted funds authority (OUTSTANDING)
- `DEC-IA-25` Affiliate remittance and per-capita authority (OUTSTANDING)
- `DEC-IA-26` Pension and benefit financial administration (OUTSTANDING)
- `DEC-IA-31` Financial adoption by organization (OUTSTANDING)
- `DEC-PD-09` Financial Officer domain map (OUTSTANDING)
- `DEC-PD-10` Financial navigation names (OUTSTANDING)
- `DEC-PD-11` Financial journeys FJ01–FJ10 (OUTSTANDING)
- `DEC-PD-13` Financial reporting scope (OUTSTANDING)
- `DEC-PD-14` Organization scenario coverage (OUTSTANDING)
- `DEC-PD-0C2-07` Finance scope across affiliates and multiple organizations (OUTSTANDING)
- `DEC-PD-0C2-08` Absent mandate holder without delegation (OUTSTANDING)
- `DEC-PD-0C2-09` Financial notifications and workflow transitions (OUTSTANDING)
- `DEC-PD-0C2-10` Order of product acceptance and the Steward structure (OUTSTANDING)

## Outstanding institutional authority decisions

These are institutional decisions. A product acceptance of this package cannot issue them. They are outstanding and stay so.

- `DEC-IA-12` WorkAid referral authority and consent wording (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-16` Financial mandate issuance rule (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-17` Delegation of financial duties (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-18` Monetary limits and required approvals (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-19` Expenditure approval policy (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-20` Payment execution and rails (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-21` Reconciliation authority (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-22` Trustee authority and administration (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-23` Auditor appointment and access scope (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-24` Strike and restricted funds authority (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-25` Affiliate remittance and per-capita authority (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-26` Pension and benefit financial administration (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-27` Dues data access for presidents and administrators (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-28` Financial succession and revocation (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-29` External accounting export and retention (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-30` Tax slip issuance authority (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)
- `DEC-IA-31` Financial adoption by organization (OUTSTANDING, owner TO_BE_NAMED_BY_INSTITUTION)

## Known source gaps and irreducible historical uncertainty

- `GAP-FO-CANONICAL-CITED-NOT-RECOVERED` (IRREDUCIBLE_HISTORICAL): UE-FINANCIAL-OFFICER-CANONICAL-2.1 is cited as FROZEN (design only) and exists in no ref. The package is a reconstruction candidate and is not that document.
- `GAP-FO-IDENTIFIERS-UNSPECIFIED` (IRREDUCIBLE_HISTORICAL): Of the 38 historical identifiers, four carry their own title or status, six carry only group labels and twenty-eight have no individual meaning in any source. F01 to F28 meanings are new design under a historical status or group.
- `GAP-FO-NO-FINANCE-SOURCE` (SOURCE): No source describes any organization’s finance structure. The four organization scenarios are hypotheses. The existing finance page is Nzila platform billing and is not union finance.
- `GAP-FO-NO-CAPABILITY-OWNER` (ENGINEERING_OWNERSHIP): The navigation and several domain contracts have no implementation capability. Their completion owner is the Financial Officer tracking capability UE-OMIT-FINANCE-RANGE-UNSPECIFIED until a finance capability exists.

Historical evidence by class: DIRECT_INDIVIDUAL 7, GROUP_LABEL_ONLY 6, NAME_RANGE_ONLY 15, NONE 9, STATUS_ONLY 18.

## Implementation obligations by engineering gate

- Gate 5 (Finance operating model): 54 requirements. NOT_IMPLEMENTED 27, PARTIAL_SOURCE 10, SOURCE_PRESENT 8, UNAVAILABLE_501 9.
- Gate 7 (WorkAid union-side completion): 1 requirements. PARTIAL_SOURCE 1.

Obligations to build and prove. Nothing here claims an implementation, a security status or a runtime qualification.

## Decision options

- **APPROVE** → `ACCEPTED_BY_AUTHORIZED_PRODUCT_OWNER`. Establishes the named artifact version as the engineering canonical for this persona. Settles or explicitly defers each listed product decision. Issues no institutional authority and activates nothing.
- **REJECT** → `REJECTED_BY_AUTHORIZED_PRODUCT_OWNER`. The artifact version is not the engineering canonical. The persona stays unresolved and its Gate 0 blocker stays.
- **RETURN_FOR_REWORK** → `RETURNED_FOR_REWORK`. The named reasons are recorded and a new artifact version is prepared. The returned version stays preserved.

A product approval does not:

- Issue, approve or activate any of the 79 outstanding institutional decisions or the 32 baseline institutional authority decisions.
- Issue a financial mandate, a triage designation, a supervisory mandate, a delegation, an appointment or any other instrument.
- Create, name or fill an institutional office, including a steward office.
- Change an implementation status, a security status, a release disposition or a runtime qualification status.
- Resolve any ratchet, test or route defect.

