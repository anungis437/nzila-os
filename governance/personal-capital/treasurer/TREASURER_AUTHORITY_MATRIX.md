# TREASURER authority matrix

| Authority | Posture |
| --- | --- |
| ANALYZE | Allow, fail closed without evidence |
| CLASSIFY_EPISTEMIC_STATE | Allow |
| MAINTAIN_ENVELOPE_PLAN | Allow as planning authority only |
| PREPARE_DECISION_RECORD | Allow |
| RECORD_HUMAN_AUTHORIZATION | Allow only for the Principal |
| RECORD_EXTERNAL_CONFIRMATION | Allow only for external FACT broker or custodian evidence |
| REPORT_TO_NORTHSTAR | Allow, unknown capacity stays null |
| EXECUTE_FINANCIAL_TRANSACTION | NEVER |
| PRODUCTION | NO |
| Inherit CAPITAL | Deny |
| Inherit COMMAND | Deny |
| Inherit COUNCIL, ORACLE, SCOUT, CHRONICLE, COUNSEL, NORTHSTAR | Deny |
| Silent risk-constraint change | Deny |
| Treat envelope as committed capital | Deny |
| Mark a proposed trade executed | Deny |

HUMAN_AUTHORIZED does not grant transaction authority.
