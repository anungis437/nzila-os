"""Seal local live-readiness evidence; performs no Azure/network calls."""

import datetime
from decimal import Decimal
import hashlib
import ipaddress
import json
import re
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OLD = HERE.parent / "g3-readiness"
EVIDENCE = HERE.parent / "evidence"
DESIGN = HERE.parent / "g3-design"
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData"
    r"\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments"
    r"\26fcf932-9b78-4838-80a4-6e91448f9bd8\Pasted text #1.txt"
)
SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
GENERATED = {"LIVE_ACCOUNT_ASSESSMENT.json", "LIVE_READINESS_FINAL_VERIFICATION.json"}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def response(name):
    record = load(HERE / (name + ".json"))
    require(record["exitCode"] == 0, "missing successful observation " + name)
    return record["response"]


def fresh_json(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def snapshot(path):
    values = {}
    for name, args in [
        ("head", ["rev-parse", "HEAD"]),
        ("branch", ["branch", "--show-current"]),
        ("status", ["status", "--short"]),
    ]:
        run = subprocess.run(["git", "-C", str(path), *args], capture_output=True, text=True)
        require(run.returncode == 0, run.stderr)
        values[name] = run.stdout.splitlines() if name == "status" else run.stdout.strip()
    return {"path": str(path), **values}


def preservation():
    fixed = {
        EVIDENCE / "G2_TERMINAL_FINAL_VERIFICATION.json":
            "ed29f65fc52a89a707d76bf553a24f579e1542ddf439245edcf0cde3ccc0f499",
        DESIGN / "DESIGN_VERIFICATION.json":
            "97ca2e560611a93c0f676fd421fa5c79292c2366a5e9b4beec14cad18c66c572",
        OLD / "READINESS_FINAL_VERIFICATION.json":
            "f5a3946a415ffae872cf20f53ec0a0e69eac83a13d1cd97515d9fb54a3207fa9",
        OLD / "READINESS_INDEPENDENT_VERIFICATION.json":
            "91f416d8f21bc72783c35a45cd335da25ce39b33cbc2baf81a2d56e6f65a38fd",
    }
    count = 0
    for path, expected in fixed.items():
        require(sha(path) == expected, "historical root changed: " + str(path))
        count += 1
    old_root = load(OLD / "READINESS_FINAL_VERIFICATION.json")
    current = {
        str(path.relative_to(OLD)): sha(path) for path in OLD.rglob("*")
        if path.is_file() and path.name not in {
            "READINESS_FINAL_VERIFICATION.json", "READINESS_INDEPENDENT_VERIFICATION.json",
        }
    }
    require(current == old_root["readinessFileHashes"], "previous readiness file census changed")
    count += len(current)
    terminal = load(EVIDENCE / "G2_TERMINAL_FINAL_VERIFICATION.json")
    for key, base in [
        ("evidenceHashes", EVIDENCE), ("completePriorEvidenceHashes", EVIDENCE),
        ("stageRootHashes", EVIDENCE),
        ("sourceHashes", ROOT / "infrastructure" / "landing-zone" / "g2-builder"),
    ]:
        for name, expected in terminal[key].items():
            require(sha(base / name) == expected.lower(), "G2 evidence/source changed: " + name)
            count += 1
    for key, file in [
        ("currentPlanSha256", "deployment-plan.md"),
        ("missionStatusSha256", "mission-gate-status.json"),
        ("validationWorkflowSha256", "validate-status.json"),
    ]:
        require(sha(HERE.parent / file) == terminal[key], "G2 historical document changed")
        count += 1
    for name, expected in load(DESIGN / "DESIGN_VERIFICATION.json")["designFileHashes"].items():
        require(sha(DESIGN / name) == expected, "prior G3 design changed")
        count += 1
    inventory = load(DESIGN / "SOURCE_INVENTORY.json")
    foreign = inventory["worktrees"]["sharedForeign"]
    unchanged_foreign = []
    changed_foreign = []
    for name, expected in foreign["reviewedFileHashes"].items():
        actual = sha(Path(foreign["path"]) / name)
        (unchanged_foreign if actual == expected else changed_foreign).append(name)
    return {
        "status": "PASS", "hashReferencesVerified": count,
        "rootHashes": {str(path.relative_to(ROOT)): digest for path, digest in fixed.items()},
        "priorReadinessExactFileCensus": len(current),
        "foreignReviewedUnchanged": unchanged_foreign,
        "foreignReviewedChanged": changed_foreign,
        "foreignDisposition": "NONE",
    }


def ledger():
    events = [json.loads(line) for line in (HERE / "AZURE_READ_ONLY_LEDGER.jsonl").read_text().splitlines()]
    require(len(events) % 2 == 0, "incomplete ledger")
    calls = []
    for start, end in zip(events[::2], events[1::2]):
        require(start["event"] == "START" and end["event"] == "COMPLETE", "ledger ordering")
        require(start["name"] == end["name"], "ledger correlation")
        require(start["mutations"] == end["mutations"] == 0, "mutation recorded")
        cmd = start["command"]
        require(cmd[0] == "az", "unexpected command")
        if cmd[1] == "rest":
            require(cmd[2] == "--method" and cmd[3] in ("GET", "POST"), "forbidden REST method")
            if cmd[3] == "POST":
                url = cmd[cmd.index("--url") + 1]
                require(url == "https://management.azure.com/subscriptions/" + SUB +
                        "/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01",
                        "POST is not the documented non-mutating name check")
                body = json.loads(cmd[cmd.index("--body") + 1])
                require(body == {"name": "nzl-g3-test-001-kv", "type": "Microsoft.KeyVault/vaults"}, "POST payload")
        else:
            require(not any(x in cmd for x in [
                "create", "update", "delete", "assign", "register", "login", "import", "push",
                "run-command", "validate", "what-if", "set",
            ]), "forbidden CLI action")
            require(any(x in cmd for x in ["show", "list", "list-skus", "list-usages", "list-usage"]), "unclassified CLI read")
        record = load(HERE / end["responseFile"])
        require(record["name"] == start["name"] and record["exitCode"] == end["exitCode"], "ledger response")
        require(record["azureMutationCount"] == 0, "response mutation")
        if record["exitCode"] == 0 and isinstance(record["response"], dict):
            require(not record["response"].get("nextLink") and not record["response"].get("@odata.nextLink"),
                    "Azure observation pagination incomplete: " + start["name"])
        calls.append({
            "name": start["name"], "exitCode": end["exitCode"], "method": start["method"],
            "responseFile": end["responseFile"], "responseSha256": sha(HERE / end["responseFile"]),
        })
    names = [x["name"] for x in calls]
    require(len(names) == len(set(names)), "duplicate call name")
    return {
        "status": "PASS", "attemptedCliInvocations": len(calls),
        "successfulCliInvocations": sum(x["exitCode"] == 0 for x in calls),
        "failedCliInvocations": sum(x["exitCode"] != 0 for x in calls),
        "nonMutatingNameAvailabilityPosts": sum(x["method"] == "POST" for x in calls),
        "scope": "EXACT_CLI_INVOCATIONS_NOT_INTERNAL_SDK_HTTP_TRACE",
        "initialGraphWrapperFailures": "RETAINED_CMD_METACHARACTER_FAILURE_NOT_RBAC_DENIAL",
        "azureMutations": 0, "calls": calls,
    }


def assessment():
    providers = response("PROVIDERS")
    needed = [
        "Microsoft.App", "Microsoft.ContainerRegistry", "Microsoft.ManagedIdentity",
        "Microsoft.Network", "Microsoft.KeyVault", "Microsoft.OperationalInsights",
        "Microsoft.Insights", "Microsoft.Authorization",
    ]
    registration = {}
    for name in needed:
        provider = next(x for x in providers if x["namespace"].lower() == name.lower())
        registration[name] = "REGISTERED" if provider["registrationState"] == "Registered" else "NOT_REGISTERED"
    require(all(x == "REGISTERED" for x in registration.values()), "provider registration changed")
    region = []
    types = {
        "Microsoft.App": ["managedEnvironments", "containerApps"],
        "Microsoft.KeyVault": ["vaults"],
        "Microsoft.Network": ["privateEndpoints", "networkInterfaces", "virtualNetworks", "networkSecurityGroups"],
        "Microsoft.OperationalInsights": ["workspaces"],
        "Microsoft.ManagedIdentity": ["userAssignedIdentities"],
    }
    for name, resource_types in types.items():
        provider = next(x for x in providers if x["namespace"].lower() == name.lower())
        for resource_type in resource_types:
            entry = next(x for x in provider["resourceTypes"] if x["resourceType"].lower() == resource_type.lower())
            require("Canada Central" in entry["locations"], "Canada Central not exposed: " + resource_type)
            region.append({"type": name + "/" + resource_type, "subscriptionVisibleLocation": "Canada Central"})
    profiles = response("APP_PROFILE_TYPES")["value"]
    consumption = next(x for x in profiles if x["name"] == "Consumption")
    quotas = response("APP_QUOTA_CLI")
    usages = response("APP_USAGE_CLI")
    quota = next(x for x in quotas if x["name"] == "ManagedEnvironmentCount")
    usage = next(x for x in usages if x["name"] == "ManagedEnvironmentCount")
    limit = quota["properties"]["limit"]["value"]
    current = usage["properties"]["usages"]["value"]
    require(limit - current >= 1, "no environment quota")
    require(any(x["name"]["value"] == "ManagedEnvironmentCount" and x["currentValue"] == current and x["limit"] == limit
                for x in response("APP_USAGES_NATIVE")["value"]), "quota/native mismatch")
    resources = response("RESOURCES")["value"]
    groups = response("GROUPS")["value"]
    require(not any(x["name"].lower() in {
        "nzila-shared-test-g3-001-rg", "nzila-g3-test-001-managed-rg",
    } for x in groups), "candidate group exists")
    candidate_names = [
        "nzila-g3-test-001-env", "nzila-g3-test-001-health", "nzila-g3-test-001-vnet",
        "nzl-g3-test-001-kv", "nzila-g3-test-001-law", "nzila-g3-test-001-egress-rt",
        "nzila-g3-test-001-pull-mi", "nzila-g3-test-001-runtime-mi",
        "nzila-g3-test-001-build-mi", "nzila-g3-test-001-probe-mi",
        "nzila-g3-test-001-acr-pe", "nzila-g3-test-001-kv-pe",
        "nzila-g3-test-001-apps-nsg", "nzila-g3-test-001-pe-nsg",
        "nzila-g3-test-001-build-nsg", "nzila-g3-test-001-probe-nsg",
    ]
    require(not any(x["name"].lower() in candidate_names for x in resources), "candidate name exists")
    require(response("VAULT_NAME_AVAILABILITY")["nameAvailable"] is True, "global vault unavailable")
    require(not any(x["name"] == "nzl-g3-test-001-kv" for x in response("DELETED_VAULTS")["value"]), "vault tombstone")
    live_vnets = response("VNets")
    candidate = ipaddress.ip_network("10.91.0.0/16")
    live_prefixes = [p for v in live_vnets for p in v["addressSpace"]["addressPrefixes"]]
    require(all(not candidate.overlaps(ipaddress.ip_network(p)) for p in live_prefixes), "live CIDR overlap")
    subnets = {
        "apps": "10.91.0.0/27", "private-endpoints": "10.91.3.0/24",
        "builders": "10.91.4.0/28", "proof-clients": "10.91.5.0/28",
    }
    subnet_networks = [ipaddress.ip_network(x) for x in subnets.values()]
    require(all(x.subnet_of(candidate) for x in subnet_networks), "subnet containment")
    require(all(not a.overlaps(b) for i, a in enumerate(subnet_networks) for b in subnet_networks[i + 1:]), "subnet overlap")
    reserved = [
        "169.254.0.0/16", "172.30.0.0/16", "172.31.0.0/16", "192.0.2.0/24",
        "100.100.0.0/17", "100.100.128.0/19", "100.100.160.0/19", "100.100.192.0/19",
    ]
    require(all(not candidate.overlaps(ipaddress.ip_network(x)) for x in reserved), "ACA reserved overlap")
    requirements = {
        "VirtualNetworks": 1, "NetworkInterfaces": 4, "PrivateEndpoints": 2,
        "NetworkSecurityGroups": 4, "RouteTables": 1, "PublicIPAddresses": 1,
    }
    network_usage = []
    for item in response("NETWORK_USAGE"):
        name = item["name"]["value"]
        if name in requirements:
            used, cap = int(item["currentValue"]), int(item["limit"])
            require(cap - used >= requirements[name], "insufficient network quota " + name)
            network_usage.append({
                "name": name, "currentUse": used, "limit": cap, "headroom": cap - used,
                "knownProofRequirement": requirements[name],
                "scope": "REGIONAL_KNOWN_OPERATOR_REQUIREMENTS_PLUS_ONE_DOCUMENTED_PROVIDER_EGRESS_IP",
            })
    require(len(network_usage) == len(requirements), "network quota missing")
    compute_usage = []
    for item in response("COMPUTE_USAGE"):
        if item["name"]["value"] in {"cores", "standardBSFamily"}:
            used, cap = int(item["currentValue"]), int(item["limit"])
            require(cap - used >= 4, "two prospective B2s quota")
            compute_usage.append({"name": item["name"]["value"], "currentUse": used, "limit": cap,
                                  "headroom": cap - used, "prospectiveProofRequirement": 4})
    require(len(compute_usage) == 2, "compute quota missing")
    firewall = response("G2_nzila-g2-egress-fw-y3koaeijzi6mu")
    fp = firewall["properties"]
    require(fp["sku"]["tier"] == "Basic", "unexpected firewall SKU")
    require(fp["ipConfigurations"][0]["properties"]["privateIPAddress"] == "10.90.0.4", "firewall next-hop drift")
    require(not any(fp[x] for x in ["networkRuleCollections", "applicationRuleCollections", "natRuleCollections"]),
            "firewall rule collection drift; do not disposition")
    g2_vnet = next(x for x in live_vnets if "nzila-g2-builder-vnet" in x["name"])
    require(not g2_vnet["virtualNetworkPeerings"], "G2 peering drift")
    target = response("G2_nzilag2tzo75uuozprbo")
    require(target["properties"]["publicNetworkAccess"] == "Disabled" and
            target["properties"]["networkRuleBypassOptions"] == "None" and
            target["properties"]["roleAssignmentMode"] == "AbacRepositoryPermissions" and
            target["properties"]["adminUserEnabled"] is False, "private target posture drift")
    terminal_live = load(EVIDENCE / "G2_TERMINAL_LIVE_ESTATE.json")
    protected = [x for x in resources if "/resourcegroups/nzila-g2-proof-xre47vggs5uhw/" in x["id"].lower()]
    require(len(protected) == 16, "protected estate count changed")
    require({x["id"].lower() for x in protected} == {x.lower() for x in terminal_live["resources"]}, "protected IDs changed")
    live_roles = response("ROLE_ASSIGNMENTS")
    for historical in terminal_live["roles"]:
        actual = next(x for x in live_roles if x["id"].lower() == historical["id"].lower())
        for key in ("principalId", "roleDefinitionId", "scope", "condition", "conditionVersion"):
            require(str(actual[key]).lower() == str(historical[key]).lower(), "G2 conditioned role changed")
    app = "8bfc2641-827c-4acd-8350-22434d64bcf1"
    principal = response("SP_TYPED_" + app)
    require(principal["id"] == "66ec0cdf-ff35-42bd-9104-f424f7c8a455", "operator candidate drift")
    federation = response("FEDERATION_TYPED_" + app)
    require(any(x["issuer"] == "https://token.actions.githubusercontent.com" and
                x["subject"] == "repo:anungis437/nzila-os:environment:staging" and
                x["audiences"] == ["api://AzureADTokenExchange"] for x in federation), "OIDC candidate binding")
    require(not any(x["principalId"] == principal["id"] and "nzila-shared-test-g3-001-rg" in x["scope"]
                    for x in live_roles), "unexpected existing G3 candidate grant")
    output = {
        "G3_EXECUTION_READINESS": "BLOCKED",
        "G3_PROVIDER_REGISTRATION": "PASS",
        "G3_REGION_AVAILABILITY": "PASS",
        "G3_REGION_AVAILABILITY_SCOPE": "DOCUMENTED_AND_SUBSCRIPTION_METADATA_NOT_ALLOCATION_GUARANTEE",
        "G3_QUOTA_STATUS": "BLOCKED",
        "G3_RESOURCE_GROUP_COLLISION": "PASS",
        "G3_NAME_COLLISION_CHECK": "PASS",
        "G3_NETWORK_ADDRESS_PLAN": "PASS",
        "G3_FIREWALL_UDR_MODEL": "BLOCKED",
        "G3_OPERATOR_PRINCIPAL_CANDIDATE": principal["id"] + "/Application_ServicePrincipal_GitHub_OIDC",
        "G3_GOVERNANCE_APPROVER": "BOUND",
        "G3_GOVERNANCE_APPROVER_BINDING": "ACCOUNTABLE_MAINTAINER_ISSUING_ACTIVE_MISSION_AUTHORITY_NOT_AZURE_GRANT_EXECUTOR",
        "G3_PULL_IDENTITY_CONTRACT": "READY",
        "G3_RUNTIME_IDENTITY_CONTRACT": "READY",
        "ACA_ABAC_IMAGE_PULL": "MUST_PROVE",
        "G3_SECRET_PROOF_CONTRACT": "BLOCKED",
        "G3A_PRODUCTION_SUBSTRATE": "BLOCKED",
        "G3A_BICEP_LOCAL_BUILD": "FAIL",
        "G3B_BICEP_LOCAL_BUILD": "FAIL",
        "COMPLETE_PACKAGE_BUILD_FAILURE_MEANING": "NOT_PREPARED_NOT_COMPILER_FAILURE_IN_SEVEN_PRESERVED_MODULES",
        "G3_PROOF_COST_CEILING_CAD": "UNRESOLVED",
        "G3_CANDIDATE_IDLE_MONTHLY_COST_CAD": "UNRESOLVED",
        "G3_PLATFORM_EGRESS_BREADTH": "ACCEPTED_FOR_SYNTHETIC_PROOF",
        "G3_SERVICE_TAG_EGRESS_LIMITATION": "ACCEPTED_AND_DOCUMENTED",
        "G3_ACA_PRIVATE_ENDPOINT": "NOT_REQUIRED",
        "G3_ARTIFACT_EXECUTION_SPLIT": "G3A_G3B",
        "TARGET_REGISTRY_IMAGE_PRESENT": "NOT_PROVEN",
        "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO",
        "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
        "PRODUCTION_DATA_AUTHORIZED": "NO",
        "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
        "G2_TERMINAL_ROOT_UNCHANGED": "YES",
        "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED",
        "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
    }
    return {
        "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mission": "NZ-20261008-INFRA-001", "outputs": output,
        "providers": registration, "regionObservations": region,
        "consumptionProfileObservation": consumption,
        "environmentQuota": {"currentUse": current, "limit": limit, "proofRequirement": 1, "headroom": limit - current},
        "environmentCoreQuota": {"scope": "NEW_ENVIRONMENT_NOT_CREATED", "value": "UNRESOLVED",
                                 "subscriptionSandboxCoresApplicable": False},
        "managedIdentityQuota": {"existingUamis": len(response("IDENTITIES")), "proposedUamis": 4,
                                "queryResult": "InvalidResourceType", "limitAndHeadroom": "UNRESOLVED"},
        "networkUsage": network_usage, "prospectiveComputeUsage": compute_usage,
        "candidateNames": candidate_names, "candidateVnet": str(candidate), "candidateSubnets": subnets,
        "liveVnetPrefixes": live_prefixes, "providerManagedAdditionalNetworking": "EXACT_COUNTS_BIND_AFTER_ENVIRONMENT_RESPONSE",
        "operatorCandidate": {**principal, "federation": federation, "selection": "PENDING_EXPLICIT_G3_DESIGNATION",
                              "currentRoles": [x for x in live_roles if x["principalId"] == principal["id"]]},
        "protectedLiveEstate": {"resourceCount": 16, "exactIdCensus": "PASS", "originalConditionedRoles": "PASS",
                                "fullResourceBodiesUnchanged": "NOT_CLAIMED"},
        "knownCadComponents": {
            "fourHourAcaActiveCompute": str(Decimal(14400) * (Decimal("0.25") * Decimal("0.000048") +
                                                           Decimal("0.5") * Decimal("0.000006"))),
            "threeDnsZoneStandingMonthly": str(Decimal(3) * Decimal("0.708275")),
            "meaning": "PRICED_COMPONENTS_NOT_ALL_IN_CEILING",
        },
        "survivingBlockers": {
            "B1": "New-environment Consumption core quota and unsupported UAMI quota binding",
            "B2": "No G3/G2 firewall connectivity, source-scoped rule or association contract",
            "B3": "Candidate operator not G3-designated; scoped grants, delegation and secret author unbound",
            "B4": "Frozen image lacks required instrumentation; complete controllers/private runners/top-level packages unprepared",
            "B5": "All-in usage/transport/provider/disk/Standard-secret meter scenario and CAD ceiling unbound",
        },
    }


def local_validation():
    executable = r"C:\Users\AubertNungisa\.azure\bin\bicep.exe"
    source = HERE / "bicep" / "route-table.bicep"
    for mode in ("build", "lint"):
        args = [executable, mode, str(source)] + (["--stdout"] if mode == "build" else [])
        result = subprocess.run(args, capture_output=True, text=True)
        require(result.returncode == 0 and not result.stderr.strip(), result.stderr)
        if mode == "build":
            template = json.loads(result.stdout.lstrip("\ufeff"))
            require(template == load(HERE / "bicep" / "route-table.json"), "route source/compiled mismatch")
            require(template["resources"][0]["properties"]["routes"][0]["properties"]["nextHopIpAddress"] ==
                    "[parameters('firewallPrivateIp')]", "route binding")
            require(template["outputs"]["associationPrepared"]["value"] is False, "unprepared association claim")
    links = []
    for file in HERE.glob("*.md"):
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", file.read_text()):
            if target.startswith(("https:", "http:", "#")):
                continue
            path = file.parent / target.split("#")[0]
            require(path.exists() or path == HERE / "LIVE_ACCOUNT_ASSESSMENT.json", "broken doc link: " + target)
            links.append({"from": file.name, "target": target})
    for file in HERE.rglob("*"):
        if file.is_file() and file.suffix in {".py", ".bicep", ".md", ".json", ".jsonl"}:
            check = subprocess.run(["git", "-c", "core.safecrlf=false", "diff", "--no-index", "--check",
                                    "--", "NUL", str(file)], capture_output=True, text=True)
            require(check.returncode in (0, 1) and not check.stdout.strip() and not check.stderr.strip(),
                    "whitespace " + str(file) + "\n" + check.stdout + check.stderr)
    return {"routeLocalBuild": "PASS", "routeLocalLint": "PASS", "documentationLinks": links,
            "completeG3TransactionPackages": "NOT_PREPARED", "azureProviderValidation": "NOT_EXECUTED"}


def main():
    seal = sys.argv[1:] == ["--seal"]
    require(not sys.argv[1:] or seal, "usage: seal_live.py [--seal]")
    if seal:
        require(not any((HERE / name).exists() for name in GENERATED), "do not overwrite prior seal")
    before = snapshot(ROOT)
    require(before["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27", "isolated HEAD drift")
    require(before["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"], "isolated worktree drift")
    shared = snapshot(Path(r"C:\APPS\nzila-os"))
    retained = preservation()
    call_ledger = ledger()
    facts = assessment()
    validation = local_validation()
    require(snapshot(ROOT) == before, "concurrency drift during local checks")
    if seal:
        fresh_json(HERE / "LIVE_ACCOUNT_ASSESSMENT.json", facts)
        hashes = {str(file.relative_to(HERE)): sha(file) for file in sorted(HERE.rglob("*")) if file.is_file()}
        fresh_json(HERE / "LIVE_READINESS_FINAL_VERIFICATION.json", {
            "capturedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "mission": "NZ-20261008-INFRA-001", "G3_EXECUTION_READINESS": "BLOCKED",
            "G3_PRIVATE_APPLICATION_SUBSTRATE": "NOT_EXECUTED", "authoritySha256": sha(AUTHORITY),
            "authorityPath": str(AUTHORITY), "concurrency": {"isolated": before, "sharedReadOnly": shared},
            "preservation": retained, "readOnlyCallLedger": call_ledger,
            "localValidation": validation, "liveReadinessFileHashes": hashes,
            "G3_TECHNICAL_EXECUTION_AUTHORIZED": "NO", "APPLICATION_ROLLOUT_AUTHORIZED": "NO",
            "PRODUCTION_DATA_AUTHORIZED": "NO", "AZURE_MUTATIONS": 0, "REGISTRY_MUTATIONS": 0,
            "UE_INFRA": "INFRA_NO_GO", "CORA_INFRA": "INFRA_NO_GO",
        })
    print(json.dumps({
        "localEvidenceVerification": "PASS", "readiness": "BLOCKED",
        "ledgerInvocations": call_ledger["attemptedCliInvocations"],
        "ledgerFailuresRetained": call_ledger["failedCliInvocations"],
        "preservedHashReferences": retained["hashReferencesVerified"], "sealed": seal,
        "rootSha256": sha(HERE / "LIVE_READINESS_FINAL_VERIFICATION.json") if seal else None,
    }, indent=2))


if __name__ == "__main__":
    main()
