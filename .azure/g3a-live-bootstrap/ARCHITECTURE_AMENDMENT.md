# Minimal amendment: CSE handler deployment contract

Status: PREPARED ONLY. NOT ISSUED. NOT EXECUTABLE.

The sole authorized extension deployment was rejected by ARM with
`InvalidParameter`, target `typeHandlerVersion`, and message
`The value of parameter typeHandlerVersion is invalid.`
The extension did not exist on the subsequent read. No binary ran; private
version selection is **NOT_RUN**, not VERSION_IGNORED or VERSION_UNSUPPORTED.

The failure is in the handler deployment contract. A version returned by
regional extension-image enumeration and a matching source tag did not prove
that the same string was accepted by the Compute extension resource API.
The successful transport validation did not validate this later extension
resource. Local Bicep compilation was insufficient for that distinction.

Before requesting any replacement authority:

1. Read the supported Compute extension API handler-version contract and regional
   image metadata; reconcile API-accepted version format with installed package
   version and the required deterministic/source-bound handler contract.
2. Perform local and read-only/provider validation of the actual extension
   resource contract, not just the transport template. State any validation that
   cannot be completed without an existing VM.
3. If Azure's supported selection contract cannot guarantee the intended exact
   package version, identify that limitation for explicit architectural approval.
   Do not silently relax pinning or claim source/package byte identity.
4. Prepare a new separately authorized discriminating proof with a new dedicated
   boundary, refreshed cost/quota/ownership checks and mandatory cleanup.

Do not edit or replay the consumed controller. Do not change the Blob immutability
mechanism: there is no live version-selection evidence supporting that change.
Do not enable automatic upgrades, substitute another handler, use SAS, a public
consumer, or execute G3A/G3B under the consumed authority.

The current packet stops after cleanup and evidence closure. Conditional local
G3A controller/package/cost completion was not activated.
