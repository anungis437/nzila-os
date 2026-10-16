# G2 Synthetic Builder Validation Results

**Classification:** Proof of concept — isolated synthetic infrastructure proof only  
**Branch:** `g2/synthetic-health-source`  
**HEAD:** `7bec20aad11d43eeae8099c14e021b3074154b27`  
**Source archive SHA-256:** `DF81CAE6D23555FC43AD1D96EF38CBA0BA67FB06D551A5183168FF151AD2528E`  
**Target subscription:** `5d819f33-d16f-429c-a3c0-5b0e94740ba3` (Azure subscription 1 Nzila)  
**Target region:** Canada Central (`canadacentral`)

## Validation commands and results

| Command/check | Result |
|---|---|
| `python -m unittest discover -s tests -v` | Passed: 3 tests, 0 failures, 0 skips. Covers APT source parsing, URI redaction, and ACR token flow audience/no-token-output/no-push contract. |
| `python -m py_compile discovery.py tests\test_discovery.py` | Passed. |
| `go test ./...` | Passed; no tests skipped. |
| `go vet ./...` | Passed. |
| `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags='-s -w'` | Passed previously on this branch. |
| Local Docker build and image/health inspection | Passed previously: Linux/AMD64, `65532:65532`, `/health-server`, `FROM scratch`; liveness/readiness behavior checked. Temporary image removed; no push. |
| `az bicep build --file main.bicep --outfile <temporary-json>` | Passed. |
| `az bicep lint --file main.bicep` | Passed. |
| `pwsh -NoProfile -File tests\negative-contract.tests.ps1` | Passed: discovery-only/closed-egress guard, five prohibited-mutation checks, and base-template contract. |
| `az deployment sub validate --location canadacentral --template-file main.bicep --parameters @parameters.preview.json --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 -o json` | Passed; recorded validation result has `error: null`. |
| `az deployment sub what-if --location canadacentral --template-file main.bicep --parameters @parameters.preview.json --subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3 --no-pretty-print --result-format FullResourcePayloads -o json` | Passed as preview: exactly 17 `Create` changes and no other change type. |
| `git diff --check` | Passed. |

The ACR IMDS request uses `resource=https://containerregistry.azure.net/`, as reflected in the [ACR managed-identity guidance](https://learn.microsoft.com/azure/container-registry/container-registry-authentication-managed-identity) and [ACR AAD OAuth flow](https://azure.github.io/acr/AAD-OAuth.html). The discovery script only records HTTP statuses and whether a scoped token was issued; it does not serialize access or refresh token contents and never pushes an image.

## Canada Central cost baseline

Live retail rates are USD/PAYG. ACR Premium is conservatively charged as a full daily unit even for 1- and 4-hour scenarios. Monthly E4 disk and Private DNS zone charges are prorated using 730 hours/month.

| Component | Unit price | 1 hour | 4 hours | 24 hours |
|---|---:|---:|---:|---:|
| Linux `Standard_B2s` | $0.0464/hour | $0.0464 | $0.1856 | $1.1136 |
| Azure Firewall Basic | $0.395/hour | $0.3950 | $1.5800 | $9.4800 |
| Standard IPv4 static public IP | $0.005/hour | $0.0050 | $0.0200 | $0.1200 |
| Private Endpoint | $0.01/hour | $0.0100 | $0.0400 | $0.2400 |
| StandardSSD_LRS E4 OS disk | $2.64/month | $0.0036 | $0.0145 | $0.0868 |
| ACR Premium registry unit | $1.6666/day | $1.6666 | $1.6666 | $1.6666 |
| Private DNS zone | $0.50/month | $0.0007 | $0.0027 | $0.0164 |
| **Fixed-cost baseline** | | **$2.1273** | **$3.5094** | **$12.7234** |

Variable prices identified: Firewall Basic data processing $0.065/GB; Private Link data processing $0.01/GB; ACR stored data $0.10/GB-month where applicable; Private DNS queries $0.40 per million for the first billion monthly queries. The exact applicable outbound Internet tier and package-transfer volume are unresolved, so these figures are fixed-cost baselines, not complete end-to-end cost estimates. No package download or image push is allowed in Stage 1.

## Outstanding proof gates

1. **Exact Ubuntu APT facts and bounded egress:** no Stage 1 VM exists yet, so its actual configured APT endpoints have not been read. `approvedAptSources` remains empty; no package-egress rule is present.
2. **Runtime managed-identity ACR token flow:** the corrected ACR audience and token-exchange contract are covered statically, but no VM has requested/exchanged tokens. Buildah compatibility and image push are not proven; image push remains prohibited.
3. **Retrievable serial/boot proof:** no Stage 1 VM has booted and no Azure boot-diagnostics serial record has been retrieved.
4. **Complete cost gate:** package-transfer bytes, applicable public Internet egress pricing tier, DNS query volume, and actual ACR data volume are not established. Do not mark full builder costs closed from the baseline above.

## Safety and disposition

- No Azure resources deployed in this validation run.
- No image pushed; no `apt update`, package installation, Run Command, DNS cutover, production/staging mutation, or merge to `main`.
- The shared dirty worktree was not accessed.
- The fresh what-if is preview-only and must be refreshed against live inventory immediately before any separately authorized Stage 1 deployment.

**Bootstrap readiness:** `BOOTSTRAP_NOT_READY`  
**Overall G2:** `FAIL`  
**`VALIDATED_FOR_BOOTSTRAP_DEPLOYMENT`:** not advanced; runtime proof and complete-cost gates remain open.
