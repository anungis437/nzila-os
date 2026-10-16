# CIVITAS Data Classification and Minimization

CIVITAS reuses the platform tiers. It does not add a parallel vocabulary.

## Platform tiers

The classification policy (`governance/privacy/policies/data-classification-policy.md`) defines:

| Tier | Label |
| --- | --- |
| 1 | Public |
| 2 | Internal |
| 3 | Confidential |
| 4 | Restricted |

Unset data defaults to Internal. PII is at minimum Confidential. PHI, payment data, and secrets are Restricted in that policy's examples.

Evidence packs use the same four labels (`packages/decision-evidence/src/schema.ts`: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`). There is no `HIGHLY_SENSITIVE` tier and no `SECRET_CREDENTIAL` tier.

## How CIVITAS maps the envelope

| CIVITAS concern | Platform tier | What is stored |
| --- | --- | --- |
| Public law and doctrine | Public | The doctrine text already in the package |
| Internal analysis metadata | Internal | Synthetic ids, proposition ids |
| Ordinary personal identifiers, if a later phase stores them | Confidential | Not stored now |
| Legal identity, family, tax, banking, health-adjacent, wills, litigation, advice metadata | Restricted | Not stored now |
| Passwords, keys, seeds, MFA secrets, API secrets, PINs | Not a stored tier | Vault reference only. The value is rejected |

Default: CIVITAS stores a reference to a secret, never the secret value. The platform secret client is `packages/secrets`. CIVITAS does not call it.

## Minimization

For a future record, the smallest form is chosen. This phase implements only the secret and evidence rules.

| Class of fact | Smallest form |
| --- | --- |
| Legal rule | Proposition plus authority reference |
| Known predicate | Short statement, marked known |
| Unknown predicate | Remains unknown |
| Document | Document reference, not a copy, until a store exists |
| Evidence | `EvidenceRef` (`type`, `ref_id`, optional summary) |
| Integrity | Hash on a decision-evidence ref when a pack is sealed. CIVITAS does not seal packs |
| Credential | Type, system, owner reference, vault reference, last review, continuity role |
| Secret value | Nothing |
| Recovery credential | Existence assertion of the form "recovery credential exists in approved vault X". Never the credential |

Highly sensitive values are not logged by the CIVITAS log helper. The platform logger does not do this by default. See the readiness assessment.

## Separation

Doctrine, indicators, and the authority substrate contain no principal record. Personal-data work remains disabled (`personalDataWorkAllowed` is false). A synthetic graph preview in `packages/civitas/src/privacy-readiness.ts` is marked `production: false` and holds ids only.
