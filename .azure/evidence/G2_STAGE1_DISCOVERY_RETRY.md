# G2 Stage 1 corrected discovery retry

Mission: `NZ-20261008-INFRA-001`  
Execution slice: `G2_STAGE1_DISCOVERY_RETRY_AFTER_NSG_DNS_CORRECTION`

## Disposition

`STAGE1_DISCOVERY_FAILED`

`BOOTSTRAP_NOT_READY`

Overall G2: `FAIL`

The conditional retry was **not executed**. Attempt count in this slice: **0**.
No Azure resource mutation occurred in this slice.

## Stop condition: source/template authority drift

The current compiled template does not differ from the historical Stage 1
template solely by the authorized `AllowPlatformDns` removal. Its embedded
discovery script also differs:

1. `read_apt_sources` gained injectable paths for testing.
2. The IMDS token audience changed from `https://management.azure.com/` to
   `https://containerregistry.azure.net/`.
3. Discovery completion requirements changed: `targetManagedIdentityToken` was
   replaced by `targetManagedIdentityAttached`, and `acrRepositoryScopedToken`
   became a required check.

These differences already existed in the current discovery source before this
slice; this slice did not edit that source. They affect the VM Custom Data and
runtime proof contract. They cannot be silently covered by an authorization for
one NSG rule removal. No source was reverted, no historical template was edited,
and no extra correction was made.

The complete embedded-source diff and separate hashes are in
[candidate provenance](./G2_STAGE1_RETRY_PROVENANCE.json).
Fresh provider validation and raw what-if were **not run** after this stop.
No eight-create count is claimed.

## Concurrency checkpoint

- Worktree: `C:\APPS\worktrees\nzila-g2-provenance`.
- Branch: `g2/synthetic-health-source`.
- HEAD/source authority: `7bec20aad11d43eeae8099c14e021b3074154b27`.
- Synthetic archive SHA-256:
  `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`.
- Subscription: `5d819f33-d16f-429c-a3c0-5b0e94740ba3`.
- Tenant: `5082b8be-b04d-4a13-b61c-b6397670177b`.
- Proof RG: `nzila-g2-proof-xre47vggs5uhw`; region `canadacentral`.
- HEAD/worktree were refreshed before write batches. The shared dirty worktree
  was not touched; no foreign change was staged, reverted, committed or
  dispositioned.
- Both `.azure/` and `infrastructure/landing-zone/g2-builder/` remain untracked.
  Therefore `git diff --check` alone is not full whitespace coverage.

## Candidate corrected IaC authority - NOT deployment authority

`CORRECTED_IAC_REVISION=sha256:c6181e80f59be17b35b902709e7def4a5aabe19da228c1781eb87f7c10d8a802`

`CORRECTED_TEMPLATE_SHA256=B1AD28A8D10E97B9D34E3647DF7EB4DA48984A4D30210CF4A33F3874C0C90D73`

Candidate execution parameter SHA-256:
`AAE183E5D7F7A1BFCC530A5D271479682780DBC14D5DF41C860E39ED30668DB2`.

The content-addressed provenance payload records the builder-directory files,
source authority, candidate template and parameters. It is not a clean git
commit and does not establish authorized historical-template parity.
The synthetic archive does **not** contain this IaC correction.
Only `previewOnly=false` differs in the candidate execution parameter file;
`approvedAptSources=[]` remains unchanged.

## Local validation

Exact commands, UTC times, exit codes and complete outputs are persisted in
[validation results](./G2_STAGE1_RETRY_RESULTS.json).

| Check | Result |
|---|---|
| `az bicep build --file infrastructure\landing-zone\g2-builder\main.bicep --outfile .azure\evidence\G2_STAGE1_RETRY_TEMPLATE.json` | PASS |
| `az bicep lint --file infrastructure\landing-zone\g2-builder\main.bicep` | PASS |
| `pwsh -NoProfile -File infrastructure\landing-zone\g2-builder\tests\dns-retry-contract.tests.ps1 -TemplatePath .azure\evidence\G2_STAGE1_RETRY_TEMPLATE.json` | PASS; base contract and five rejected mutations |
| `pwsh -NoProfile -File infrastructure\landing-zone\g2-builder\tests\negative-contract.tests.ps1` | PASS; existing contracts unchanged |
| `python -m unittest discover -s infrastructure\landing-zone\g2-builder\tests -p test_discovery.py -v` | PASS; 3 tests, zero skips; builder directory supplied as `PYTHONPATH` |
| `git diff --check` | PASS; tracked diff only |
| Correction-only emitted-template parity | FAIL; additional discovery-source differences |
| Fresh Azure provider validation | NOT RUN; precondition blocked |
| Fresh raw structured JSON what-if | NOT RUN; precondition blocked |

Initial test invocation errors (missing mandatory template parameter and missing
Python module path) were corrected without changing the discovery test/source.
The new role contract resolves emitted ARM role variables rather than assuming
the literal role GUID occurs in every assignment expression.

## Retained estate and comparison limitations

The latest read-only inventory, resource readbacks, effective policy assignments,
returned role-assignment set and zero-NSG check are saved in
[baseline](./G2_STAGE1_RETRY_BASELINE.json), with capture time.

- The six-resource inventory is unchanged.
- Returned role assignments and resource-group readback are unchanged.
- Zero NSGs are present; no diagnostic canary remains.
- Every field present in the historical resource readbacks is unchanged.
- Raw full-readback equality is **not established**: current API/CLI responses
  expose additional fields, including UAMI `isolationScope`, ACR
  `roleAssignmentMode`/`networkRuleBypassAllowedForTasks`, CLI `resourceGroup`
  fields and null wrapper fields. These are reported as comparison limitations,
  not silently discarded to produce a passing predeployment baseline.
- A transient local DNS resolution failure on an Azure read was followed by a
  successful read-only capture; it did not trigger any deployment retry.

Original Stage 1 and canary evidence hashes, and original compiled `main.json`
SHA-256 `60B610A05373857EA8DB000EBD77F90FD1484D970B2397D7E32139871D4B4646`,
were checked and preserved.

## Runtime evidence: unavailable, not fabricated

- `BOOT_DIAGNOSTICS_PROOF=FAIL` - no builder VM/marked log retrieval.
- `IMDS_IDENTITY_PROOF=FAIL` - no actual VM IMDS request in this slice.
- `PRIVATE_ACR_NETWORK_PROOF=FAIL` - no VM private-path DNS/HTTPS proof.
- `ACR_TOKEN_EXCHANGE_PROOF=BLOCKED` - no VM; **not** a tooling-only blocker.
- `OBSERVED_APT_ENDPOINTS` is **not observed**, not an empty-list proof.
- `STAGE2_PROPOSED_APT_ALLOWLIST` is **not derived**.

No Boot Diagnostics, image, APT, token or private-path runtime success is claimed.
No Stage 2 work or authorization is implied.

## Cost observation

No retry deployment start/completion, VM start, Firewall creation, private
endpoint creation or runtime proof-completion timestamp exists for this slice.
The baseline retains original resource timestamps. Existing retained resources
can continue accruing charges; absence of a retry is not zero estate cost.

Previously recorded USD PAYG retail rates are preserved, not refreshed or
represented as billing measurements:

- Full-estate known hourly components: VM `$0.0464/h`, Firewall Basic
  `$0.395/h`, Standard IPv4 `$0.005/h`, private endpoint `$0.01/h`;
  aggregate `$0.4564/h` if all are provisioned/billable.
- ACR Premium `$1.6666/day`; E4 SSD `$2.64/month`;
  DNS zone `$0.50/month`.
- Variable: Firewall `$0.065/GB`, PE `$0.01/GB`, ACR storage
  `$0.10/GB-month` where applicable, DNS `$0.40/million` queries.
- The current retained estate has no VM, Firewall or PE; do not charge the
  full-estate aggregate against the observed retained duration.
- Billing meters, transactions, storage, throughput and applicable discounts
  remain unresolved. No precise invoice total is claimed.

## Files changed in this correction slice

- [builder.bicep](../../infrastructure/landing-zone/g2-builder/builder.bicep):
  removed only the complete `AllowPlatformDns` rule.
- [dns-retry-contract.tests.ps1](../../infrastructure/landing-zone/g2-builder/tests/dns-retry-contract.tests.ps1):
  added strict rule/private-ACR/identity/egress contracts and negative mutations.
- [deployment-plan.md](../deployment-plan.md): added corrected retry validation
  section and stop evidence; status remains Approved, not Validated.
- New candidate template, execution parameters, provenance, baseline,
  command-results JSON and this report.

## Required next decision

Explicitly resolve the discovery-source/template divergence before resuming:
either authorize the current embedded discovery-script changes as an additional
reviewed correction, or authorize restoration of the historical discovery
payload. No restoration or deployment is authorized by this report.

Then rebuild, establish correction authority and comparable retained readbacks,
run fresh provider validation and save raw what-if. The required gate remains
exactly eight intended missing creates, no unauthorized changes, and immutable
template/parameter/baseline/what-if bindings before the single retry.
