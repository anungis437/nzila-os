# Next decision proposal: ACR import network and authorization ceiling

Proposal only. No executable deployment/source authority, random assignment ID,
registry change, upload or import is authorized.

Current disposition: `ACR_TO_ACR_TOOLING_DELIVERY_BLOCKED`.
This design is documented and needs no new staging compute/network/storage,
but two explicit acceptance decisions remain:

1. Whether G2 may change `properties.networkRuleBypassOptions` from `None` to
   `AzureServices`, preserving publicNetworkAccess Disabled. This is a
   trusted-service-class exception, not an import-only network rule. Bind the
   exact source/IaC amendment, live preservation checks and whether the setting
   is retained or restored after the proof; restoring it also requires authority.
2. Whether the existing build OIDC principal may receive time-bounded registry
   scope importer/read/catalog rights not technically constrained to
   `g2-tooling`. Current Microsoft same-tenant guidance specifies Data Importer
   and Data Reader on source and target. Do not grant it without explicit
   acknowledgement of read scope and import-destination authority.

If both are accepted, a future concrete execution authority must enumerate:

- Source/target resource IDs, exact existing build principal/client/federation,
  operations owner and lifecycle.
- Existing source legacy AcrPush unchanged; no redundant source Writer.
- Exact deterministic IDs for any source/target importer-role additions,
  before/after role sets and time-bounded removal/retirement proofs. Potential
  maximum **two importer assignments**, separate from builder tooling Reader.
  Do not treat source AcrPush as the combined importer without provider evidence.
- Exact builder Repository Reader condition for target `g2-tooling`, as a
  separate deterministic assignment. Existing synthetic-health roles and
  runtime tooling non-grant remain unchanged. Potential third authorization
  resource is not covered by the earlier +2 tooling-role packet.
- Exact target bypass mutation and raw preservation/provider what-if gates.
  Protected infrastructure count remains 16, but its registry configuration
  intentionally changes; never claim byte-identical protected state.
- One source tooling tag, collision-stop rule, approved archive hash, generic
  OCI manifest/type/layer construction and immutable source digest.
- Server-side import using source ACR Azure ID and
  `g2-tooling@sha256:<reviewed source manifest digest>`, exact target tag,
  no force-overwrite and no token/credential command-line arguments.
- A separately governed private target readback context to verify manifest
  and archive blob equivalence. Import completion alone is not that proof;
  hosted client direct private read is not presumed.
- Explicit artifact retention, role cleanup, network-state lifecycle and
  post-import least-privilege verification. Importer grant to the build identity
  does not give the builder/runtime any broader rights.
- Stop after the authorized data-plane stage, or separately authorize builder
  execution; no implicit ORAS authority reuse, Stage 2B or Stage 3.

Proposed sequence, not executed:

GitHub OIDC build identity -> download exact approved archive -> local SHA-256
verification -> source `nzilacanadaacr/g2-tooling` generic OCI push -> immutable
source manifest digest -> Azure server-side resource-ID import into private G2
`g2-tooling` -> private manifest/blob equivalence proof -> later private builder
read-only fetch.

If either ceiling is declined, first record the precise architectural rejection.
Only then return to the separately governed private-substrate branch. Do not
build new infrastructure while this supported lower-state option is merely
awaiting explicit risk acceptance.
