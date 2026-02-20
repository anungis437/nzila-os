# Runbooks

Operational runbooks for Nzila platform. These procedures provide step-by-step
guidance for common operational tasks and incident responses.

## Structure

```
runbooks/
  security/     — Security incident response runbooks
  governance/   — Governance and compliance runbooks
  infrastructure/ — Infrastructure operations runbooks
  finance-close/ — Month/year-end financial close runbooks
```

## How to Use

Each runbook follows the format:
1. **Trigger**: When to use this runbook
2. **Pre-requisites**: Access, tools, environment needed
3. **Steps**: Numbered, verifiable steps
4. **Verification**: How to confirm the procedure succeeded
5. **Rollback**: How to undo if needed

## Contributing

When adding a runbook:
- Use the runbook template from `ops/change-management/`
- Test the runbook against a staging environment before publishing
- Have a second engineer peer-review all runbook changes
- Link from the relevant incident response playbook

## Runbook Index

| Runbook | Category | Last Reviewed |
|---------|----------|---------------|
| [Security Incident Response](./security/) | Security | — |
| [Governance & Compliance](./governance/) | Governance | — |
| [Infrastructure Operations](./infrastructure/) | Infrastructure | — |
| [Finance Close](./finance-close/) | Finance | — |
