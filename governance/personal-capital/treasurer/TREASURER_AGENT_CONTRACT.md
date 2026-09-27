# TREASURER agent contract

Agent key: `treasurer`

Package: `@nzila/treasurer` (`packages/treasurer`)

Domain: personal capital of the Principal (Aubert Nungisa).

The agent is a pure function over caller-supplied evidence. It does not write a database, call a broker, or dispatch a command.

PRODUCTION AUTHORITY: NO

FINANCIAL TRANSACTION AUTHORITY: NEVER

`transactionExecuted` on every decision record is the literal `false`. TREASURER can record an external confirmation when hashed broker or custodian evidence is supplied. That record does not execute anything and does not invent authorization.

Human authorization is a separate AUTHORIZATION record naming the Principal. It is never assumed from narrative, role, or an envelope.

This contract extends the governed-agent shape already used by `@nzila/executive-os` (pure `run`, no hidden side effects, material actions require a human) without registering TREASURER inside that corporate registry. The corporate treasury agent remains key `treasury`.
