# Minimal amendment: failed managed-identity download observability

Status: PREPARED ONLY. NOT ISSUED. NOT EXECUTABLE.

## Established

Selector 2.1 is accepted. Guest CustomScript 2.1.19 reported terminal
`ProvisioningState/failed/0`, error 72, during managed-identity file download.
The probe command did not run. The captured message provides a service request
ID but no precise HTTP status/error body or token-acquisition stage.
Do not infer VERSION_IGNORED, VERSION_UNSUPPORTED, PRIVATE_PATH_FAILURE or
IDENTITY_AUTH_FAILURE from this generic message.

## Smallest follow-up scope

Before requesting any further live authority, prepare an evidence contract for
distinguishing the existing download path's DNS/connection, IMDS identity-token,
and Storage response stages. Capture only safe status/error codes and request
IDs; never token contents, Authorization headers, account keys or SAS.
Review available platform/extension diagnostic surfaces read-only and state
which require a new proof resource or additional authorization.

Preserve selector 2.1, private endpoint/DNS, UAMI-only read role, V1 historical/
V2 current discriminator, public lockdown, single-attempt and mandatory cleanup.
Do not grant more privilege, enable public consumer access, change immutability
or substitute transport to make the proof appear successful.

Separately, the next authorized controller revision must recognize terminal
status codes with numeric suffixes such as `/failed/0`. The present controller
mistook that code as nonterminal and raised `CSE_NOT_TERMINAL_NO_RETRY`.
The raw instance view is sufficient to correct the observation in closeout;
the consumed controller is not edited or replayed. Local closeout tests cover
this exact status shape.

No further proof is authorized by this amendment. Both live authorities are
consumed; the retry ended with ZERO residuals and conditional G3A local closure
was not activated.
