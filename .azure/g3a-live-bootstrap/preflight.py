"""Read-only Azure preflight. No mutating command is implemented here."""

from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\a99bc319-5fe6-4d75-81ca-8edc1a75b09c\Pasted text #1.txt")
SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
SCOPE = "/subscriptions/" + SUB
IMAGE = "Canonical:ubuntu-24_04-lts:server:24.04.202609040"
AZ = shutil.which("az")
ENV = dict(os.environ, AZURE_EXTENSION_USE_DYNAMIC_INSTALL="no")


def ensure(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def fresh(name, value):
    with (HERE / name).open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def baseline():
    snapshots = []
    for root in (ROOT, Path(r"C:\APPS\nzila-os")):
        item = {"path": str(root)}
        for key, args in (("head", ["rev-parse", "HEAD"]), ("branch", ["branch", "--show-current"]),
                          ("status", ["--no-pager", "status", "--short"])):
            result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, timeout=60)
            ensure(result.returncode == 0, "CONCURRENCY_READ_FAILED")
            item[key] = result.stdout.strip().splitlines() if key == "status" else result.stdout.strip()
        snapshots.append(item)
    ensure(snapshots[0]["head"] == "7bec20aad11d43eeae8099c14e021b3074154b27" and
           snapshots[0]["status"] == ["?? .azure/", "?? infrastructure/landing-zone/g2-builder/"],
           "ACTIVE_WORKTREE_DRIFT")
    return snapshots


def read(name, args, allowed_failure=False):
    allowed = {("account", "show"), ("ad", "signed-in-user"), ("rest", "--method"),
               ("role", "assignment"), ("provider", "list"), ("network", "vnet"),
               ("vm", "image"), ("vm", "list-skus"), ("vm", "list-usage"),
               ("quota", "list"), ("quota", "usage"), ("vm", "extension"),
               ("group", "exists"), ("account", "list-locations")}
    ensure(tuple(args[:2]) in allowed and "get-access-token" not in args and
           (args[0] != "rest" or args[2] == "get"), "READ_ONLY_COMMAND_BOUNDARY")
    result = subprocess.run([AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, timeout=300, env=ENV)
    if result.returncode != 0:
        fresh(name, {"status": "READ_FAILED", "exitCode": result.returncode,
                     "command": ["az", *args], "stderr": result.stderr.strip(),
                     "utc": datetime.now(timezone.utc).isoformat()})
        print(name + " READ_FAILED", flush=True)
        ensure(allowed_failure, "READ_FAILED_" + name)
        return None
    value = json.loads(result.stdout)
    fresh(name, {"status": "PASS_READ", "command": ["az", *args], "value": value,
                 "utc": datetime.now(timezone.utc).isoformat()})
    print(name + " CAPTURED", flush=True)
    return value


def main():
    ensure(AZ is not None, "AZ_CLI_MISSING")
    fresh("CONCURRENCY_PREFLIGHT.json", baseline())
    authority_sha = sha(AUTHORITY)
    suffix = authority_sha[:10]
    rg = "nzila-g3-firstbyte-" + suffix + "-rg"
    fresh("AUTHORITY_BINDING.json", {
        "path": str(AUTHORITY), "sha256": authority_sha, "mission": "NZ-20261008-INFRA-001",
        "proof": "G3A_FIRST_BYTE_BOOTSTRAP_PROOF", "maximumCSEExecutions": 1,
        "consumedAtFirstAzureMutation": True, "consumed": False,
        "subscription": SUB, "tenant": TENANT, "region": "canadacentral",
        "resourceGroupCandidate": rg, "suffix": suffix, "hardCeilingCAD": "3.00"})
    account = read("ACCOUNT.json", ["account", "show"])
    ensure(account["id"] == SUB and account["tenantId"] == TENANT and account["state"] == "Enabled",
           "AZURE_CONTEXT_MISMATCH")
    principal = read("PRINCIPAL.json", ["ad", "signed-in-user", "show",
                                      "--query", "{id:id,userPrincipalName:userPrincipalName}"])
    permissions = read("PERMISSIONS.json", ["rest", "--method", "get", "--url",
                       "https://management.azure.com" + SCOPE +
                       "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"])
    roles = read("PRINCIPAL_ROLES.json", ["role", "assignment", "list", "--assignee-object-id", principal["id"],
                                        "--all", "--include-inherited", "--fill-principal-name", "false"])
    ensure(any(item["actions"] == ["*"] and not item.get("notActions") for item in permissions["value"]),
           "EXACT_DEPLOYMENT_ROLE_CAPABILITY_UNPROVEN")
    ensure(any(item["scope"].lower() in (SCOPE.lower(), "/") and not item.get("condition") and
               item["roleDefinitionId"].split("/")[-1] in
               ("8e3af657-a8ff-443c-a75c-2fe8c4bcb635", "18d7d88d-d35e-4fb5-a5c3-7773c20a72d9")
               for item in roles), "UNCONDITIONED_ROLE_ASSIGNMENT_CAPABILITY_UNPROVEN")
    denies = read("DENY_ASSIGNMENTS.json", ["rest", "--method", "get", "--url",
                  "https://management.azure.com" + SCOPE +
                  "/providers/Microsoft.Authorization/denyAssignments?api-version=2022-04-01"])
    ensure(not denies["value"], "DENY_ASSIGNMENTS_REQUIRE_EXACT_REVIEW")
    complete_reads(principal)


def complete_reads(principal):
    authority_sha = sha(AUTHORITY)
    rg = "nzila-g3-firstbyte-" + authority_sha[:10] + "-rg"
    locations = read("LOCATIONS_CORRECTED.json", ["account", "list-locations"])
    ensure(any(item["name"] == "canadacentral" for item in locations), "CANADA_CENTRAL_NOT_VISIBLE")
    providers = read("PROVIDERS.json", ["provider", "list", "--subscription", SUB,
                     "--query", "[?namespace=='Microsoft.Compute' || namespace=='Microsoft.Network' || "
                     "namespace=='Microsoft.Storage' || namespace=='Microsoft.ManagedIdentity' || "
                     "namespace=='Microsoft.Authorization'].{namespace:namespace,state:registrationState}"])
    ensure(len(providers) == 5 and all(item["state"] == "Registered" for item in providers),
           "REQUIRED_PROVIDERS_NOT_REGISTERED")
    absent = read("RG_ABSENCE.json", ["group", "exists", "--name", rg, "--subscription", SUB])
    ensure(absent is False, "PROOF_RG_ALREADY_EXISTS")
    vnets = read("VNET_CENSUS.json", ["network", "vnet", "list", "--subscription", SUB,
                "--query", "[].{id:id,name:name,location:location,addressSpace:addressSpace.addressPrefixes}"])
    occupied = [ipaddress.ip_network(cidr) for item in vnets for cidr in item["addressSpace"]]
    chosen = next((candidate for candidate in ("10.92.0.0/24", "10.93.0.0/24", "10.94.0.0/24")
                   if not any(ipaddress.ip_network(candidate).overlaps(network) for network in occupied)), None)
    ensure(chosen is not None, "NO_APPROVED_NONOVERLAPPING_CIDR")
    fresh("CIDR_SELECTION.json", {"chosen": chosen, "candidateOrder": ["10.92.0.0/24", "10.93.0.0/24",
                                                                   "10.94.0.0/24"],
          "allLiveCIDRs": [str(network) for network in occupied], "peering": "PROHIBITED"})
    image = read("IMAGE.json", ["vm", "image", "show", "--urn", IMAGE, "--location", "canadacentral",
                              "--subscription", SUB])
    ensure(image["architecture"].lower() == "x64", "PINNED_IMAGE_NOT_AMD64")
    skus = read("SKU.json", ["vm", "list-skus", "--location", "canadacentral", "--size", "Standard_B2s",
                           "--all", "--subscription", SUB])
    exact = [item for item in skus if item["name"] == "Standard_B2s" and
             item["resourceType"] == "virtualMachines"]
    ensure(len(exact) == 1 and not exact[0]["restrictions"], "BOUND_B2S_SKU_RESTRICTED_OR_MISSING")
    quota = read("QUOTA_CLI.json", ["quota", "list", "--scope",
                 SCOPE + "/providers/Microsoft.Compute/locations/canadacentral"], allowed_failure=True)
    usage = read("COMPUTE_USAGE.json", ["vm", "list-usage", "--location", "canadacentral",
                                     "--subscription", SUB])
    finish_quota_and_handler(principal, quota, usage, chosen, rg)


def finish_quota_and_handler(principal, quota, usage, chosen, rg):
    for name in ("cores", "standardBSFamily"):
        matches = [item for item in usage if item["name"]["value"].lower() == name.lower()]
        ensure(len(matches) == 1 and int(matches[0]["currentValue"]) + 2 <= int(matches[0]["limit"]),
               "INSUFFICIENT_COMPUTE_QUOTA_" + name)
    versions = read("CSE_VERSIONS.json", ["vm", "extension", "image", "list-versions",
                    "--publisher", "Microsoft.Azure.Extensions", "--name", "CustomScript",
                    "--location", "canadacentral", "--subscription", SUB])
    ensure(any(item["name"] == "2.1.17" for item in versions), "PINNED_2_1_17_HANDLER_NOT_PUBLISHED")
    fresh("PREFLIGHT_READS_SUMMARY.json", {
        "status": "READS_PASS_PENDING_CURRENT_COST_BINARY_NETWORK_QUOTA_AND_DEPLOYMENT_VALIDATION",
        "principalId": principal["id"], "subscription": SUB, "tenant": TENANT, "resourceGroup": rg,
        "region": "canadacentral", "CIDR": chosen, "image": IMAGE, "SKU": "Standard_B2s",
        "quotaCLIAvailable": quota is not None, "roleAssignmentCapability": "PROVEN_CURRENT_PRINCIPAL",
        "permanentExecutorEstablished": False, "grantExecutorEstablished": False,
        "authorityConsumed": False, "AZURE_MUTATIONS": 0, "AZURE_DELETIONS": 0,
        "ROLE_ASSIGNMENT_MUTATIONS": 0, "MANAGED_IDENTITY_CREATE_DELETE": {"create": 0, "delete": 0},
        "REGISTRY_MUTATIONS": 0})
    print("READ_ONLY_PREFLIGHT_PASS", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        fresh("PREFLIGHT_STOP.json", {"status": "STOP_BEFORE_MUTATION", "reason": str(error),
              "AZURE_MUTATIONS": 0, "authorityConsumed": False,
              "utc": datetime.now(timezone.utc).isoformat()})
        raise
