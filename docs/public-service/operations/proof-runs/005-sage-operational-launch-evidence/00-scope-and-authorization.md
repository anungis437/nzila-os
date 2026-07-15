# Proof-Run 005 — SAGE Operational Launch Evidence (Azure Staging)

## Scope and authorization

This proof run attempts to strengthen the operational launch evidence for SAGE
that proof-run 004 recorded as `NOT_PROVEN` — accessibility (G11), observability
and incident response (G12), and backup and restoration (G13) — using **real
Azure staging infrastructure**. It introduces **no new product capabilities**.

It preserves the exact approved 15-gate taxonomy from proof-run 004 and changes
only statuses supported by new evidence. In this run, no gate status changed:
the new evidence strengthens already-conditional gates and adds partial evidence
to the not-proven gates, but none of the critical proofs required to advance a
gate were completed. The **operative authorized decision remains `NO_GO`,
inherited from proof-run 004**.

### Authorization frame

| Constraint | Value |
| --- | --- |
| Subscription | `Nzila` |
| Primary resource group | `nzila-canada-staging-rg` |
| Environment | staging only |
| Production actions | prohibited |
| Customer / production personal data | prohibited |
| Named human available this run | no |

Because no human was available, gates that **require** a named human (manual
accessibility pass, alert-receipt confirmation, and the final launch-governance
decision) cannot reach `PASS`. Human confirmation does not by itself force
`CONDITIONAL_GO`; a full `GO` remains possible only after every gate passes with
no unresolved blockers or conditions **and** those confirmations are completed.

### What this run did

1. Corrected a material error from the first draft of 005: SAGE UI **does exist**
   in the merged repository (see 01). The valid finding is that it is **not
   deployed** to staging, not that it is absent.
2. **Directly** inventoried the staging database schema (read-only) rather than
   inferring it.
3. Ran live backend proofs against real staging services, including the **actual
   production limiter adapter**, not just connectivity.
4. Executed a **Log Analytics KQL** query to establish query authorization.
5. Added **automated accessibility tests** against the existing SAGE operator
   components (repository-level), leaving the manual pass to a named human.

### What this run deliberately did not do

- It did **not** provision an isolated Postgres server or run an unsupervised
  PITR restore while no human was available (G13 restore round-trip deferred).
- It did **not** build or deploy a SAGE proof revision.
- It did **not** modify `zonga-ops-alerts` or add alert recipients.
- It did **not** apply SAGE migrations to the shared staging database.

### Privacy

Credentials were read from Azure Key Vault into process environment only and
never printed. Only booleans, HTTP status codes, safe resource names, table
names and hashes are recorded. The temporary database firewall rule (single
agent IP) used for the read-only inventory was removed immediately afterward.
