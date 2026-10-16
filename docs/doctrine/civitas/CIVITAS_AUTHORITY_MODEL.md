# CIVITAS Authority Model

Authority is advisory and analytical. Execution authority is none: no deploy, merge, financial transaction, filing, or signing. CIVITAS is not counsel of record.

## Evidence hierarchy

CIVITAS classifies existing `@nzila/platform-decision-engine` evidence references. It does not define a new evidence object.

| Tier | What it is | Effect |
| --- | --- | --- |
| 1 | Primary and binding: Constitution, statutes, regulations, codes, official legislative publications, the Supreme Court of Canada, and the applicable appellate and superior courts | May support a material proposition, still as an advisory inference |
| 2 | Official interpretation: Justice Canada, Canada Revenue Agency, Revenu Québec, Corporations Canada, Registraire des entreprises, the Office of the Privacy Commissioner of Canada, the Commission d'accès à l'information, and other regulators | May support a material proposition, still as an advisory inference |
| 3 | Persuasive professional material | May support a material proposition, still as an advisory inference |
| 4 | Discovery only: blogs, forums, social media, video | Cannot independently establish a material legal proposition |

Every material conclusion retains the evidence reference. A reference without an identifier does not support a conclusion.

Temporal validity is explicit:

- `LAW_ON_DATE` means the source is used as the law on the stated date.
- `CURRENTLY_VERIFIED` requires a verification date. Without that date the claim is refused.
- `UNVERIFIED` does not support a material proposition.

An agent conclusion is an `INFERENCE`. A RED matter is labelled `PROFESSIONAL_DETERMINATION_REQUIRED`. Missing support is `UNRESOLVED`.

## Jurisdiction and authority

Jurisdiction is stated before a conclusion, as a code such as `CA-QC`. The default Canada / Québec jurisdiction is applied only when the caller requests the default. Folklore is not a jurisdiction code.

The asserted authority is stated before a conclusion. Rights and obligations are both present, including an explicit "none identified" where that is the analysis. Mandatory and discretionary layers stay separate. Uncertainty is retained; an empty uncertainty list blocks the analysis.

## Decision classes

Classes reuse the decision-engine policy context. `execution_allowed` is false for every class.

| Class | Meaning | Professional gate | VERIFIER |
| --- | --- | --- | --- |
| GREEN | Principal may choose among disclosed lawful options | None | Not required by the class |
| AMBER | Regulated choice that still needs verification | None by default | Review required before reliance |
| RED | Professional-risk matter | Required. See the list below | Required before reliance |
| BLACK | Prohibited mechanism | The mechanism is refused | A lawful pathway is returned where one exists |

RED matters: tax restructuring, trusts, estate instruments, cross-border residence, constitutional proceedings, material asset transfers, litigation, and significant regulated filings.

Gates that are available: lawyer, Québec notary, CPA, tax specialist.

Benefit dimensions (control, optionality, privacy, resilience, reversibility, continuity, evidence quality, jurisdictional clarity) and exposure dimensions (legal, tax, regulatory, fiduciary, creditor, contractual, disclosure, operational) are named only. No score is computed. A score cannot override a prohibition.

## Projection

A successful analysis projects a recommendation or an escalation onto the existing decision record shape: evidence references, required approvals, `review_required`, and a policy context with execution denied. Status is `GENERATED` or `PENDING_REVIEW`. It is never `EXECUTED`. No new `@nzila/decision-core` decision type is registered.

## Fleet obligations

CIVITAS owns lawful-autonomy reasoning.

- SCOUT discovery stays unverified until VERIFIER or a human accepts it.
- VERIFIER validates authority, quotations, jurisdiction, currentness, amendments, and legal effect.
- REDTEAM challenges stay open.
- BUILDER and FORGE receive no legal decision authority.
- COUNSEL is not CIVITAS.

These are obligations on CIVITAS. They do not register those peers and they do not change their permissions. On this repository's main branch those names are not registered code agents.
