# CIVITAS Personal Data Threat Model

Phase 2.5 evaluation. CIVITAS stores no personal data. Phase 3 stays closed. This model covers the max-risk envelope that a later personal institutional graph would hold if it were opened: legal identity, contact, citizenship, residency, domicile, family, dependants, corporate ownership, beneficial interests, voting rights, trusts, estates, wills, mandates, powers of attorney, succession, real property, financial assets, debts, banking, tax, insurance, contracts, litigation, legal-advice metadata, intellectual property, digital assets, domains, credentials, recovery mechanisms, key references, advisers, counterparties, and continuity instructions.

No real personal record was used. Fixtures are synthetic ids such as `principal-synthetic-a`.

## Assets

| Asset | Where it is today | If Phase 3 opened |
| --- | --- | --- |
| Doctrine and authority substrate | `packages/civitas` | Stays free of principal facts |
| Personal graph | Not stored | The envelope above |
| Secret values | Not stored. Platform secret values are retrieved by `packages/secrets/src/keyvault.ts` | Vault reference only |
| Evidence pointers | `EvidenceRef` on the decision-engine record | Provenance stays on the reference |

## Actors

- The principal, for their own record.
- A family member or dependant, who is a separate subject. Their data is not the principal's unrestricted data.
- CIVITAS, advisory only, execution authority none.
- SCOUT, VERIFIER, REDTEAM, BUILDER, FORGE, COUNSEL. These names are not registered agents. CIVITAS grants them no permissions (`packages/civitas/src/interaction.ts`).
- Platform admin, through `apps/console/app/api/admin/break-glass/route.ts`.
- Service credentials and database roles. Union Eyes org isolation is in `apps/union-eyes/scripts/p4-authority-state.ts`. That isolation is org-scoped.
- Model providers and log sinks, if a later path sends data out of the package.

## Boundaries

Minimum necessary disclosure for agent-to-agent work: send the proposition, the authority references, and the minimum factual predicates. Do not send the graph.

Source text is evidence. It cannot change authorization, grant execution, or add an agent capability.

Credential boundary: CIVITAS may record credential type, system, owner reference, recovery dependency, vault reference, last review, and continuity role. It rejects a password, private key, seed, MFA secret, API secret, or PIN value (`acceptCredentialRecord`, `acceptEvidencePayload`).

Family boundary: a family read is refused. No family profile is stored.

Legal-professional boundary: adviser communication, legal advice, draft versus final instruments, confidential material, and professional determinations stay distinct labels. CIVITAS does not auto-claim privilege. A RED matter remains `PROFESSIONAL_DETERMINATION_REQUIRED`.

## Threats

The ten scenarios and their blocker status are in `CIVITAS_PRIVACY_READINESS.md`. Each one is a Phase 3 blocker.

## Out of scope for this evaluation

Wills, trusts, instruments, adviser connections, a production graph, a scenario engine, numeric scoring, deployment, and merge.
