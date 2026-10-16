"""Bounded Azure read-only census. No deployments, authentication or mutations."""

import datetime
import json
import os
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
SUBSCRIPTION = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
PREFIX = "/subscriptions/" + SUBSCRIPTION
CLI = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
ENV = dict(os.environ, AZURE_EXTENSION_USE_DYNAMIC_INSTALL="no",
           AZURE_CORE_COLLECT_TELEMETRY="no")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_call(name, args, *, local=False):
    allowed = {
        ("account", "show"), ("extension", "list"), ("provider", "list"),
        ("resource", "list"), ("group", "list"), ("quota", "list"),
        ("quota", "usage"), ("network", "vnet"), ("network", "list-usages"),
        ("vm", "list-usage"), ("vm", "list-skus"), ("identity", "list"),
        ("role", "assignment"), ("role", "definition"), ("rest", "--method"),
        ("ad", "sp"), ("ad", "app"),
    }
    if tuple(args[:2]) not in allowed:
        raise RuntimeError("unapproved CLI read class")
    if args[:2] == ["rest", "--method"] and args[2] != "GET":
        expected = "https://management.azure.com" + PREFIX + "/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01"
        if args[2] != "POST" or args[args.index("--url") + 1] != expected:
            raise RuntimeError("only GET or documented non-reserving vault name check allowed")
    if tuple(args[:2]) in {("network", "vnet"), ("role", "assignment"), ("role", "definition")}:
        if args[2] != "list":
            raise RuntimeError("only list allowed")
    if args[:2] == ["ad", "sp"] and args[2] != "show":
        raise RuntimeError("only service-principal show allowed")
    if args[:2] == ["ad", "app"] and args[2] != "show" and args[2:4] != ["federated-credential", "list"]:
        raise RuntimeError("only app show/federation list allowed")
    path = HERE / (name + ".json")
    ledger = HERE / "AZURE_READ_ONLY_LEDGER.jsonl"
    if path.exists():
        raise RuntimeError("response already exists: " + name)
    full = [CLI, *args, "--output", "json", "--only-show-errors"]
    if any("&" in argument or "%" in argument for argument in full):
        raise RuntimeError("unsafe cmd URL; use typed CLI command rather than shell metacharacters")
    started = now()
    with ledger.open("a", encoding="utf-8") as file:
        file.write(json.dumps({
            "event": "START", "name": name, "startedAtUtc": started,
            "command": ["az", *args, "--output", "json", "--only-show-errors"],
            "method": "LOCAL_CLI_METADATA" if local else (
                args[2] if args[:2] == ["rest", "--method"] else "READ_ONLY_CLI"),
            "nonMutatingPost": args[:3] == ["rest", "--method", "POST"],
            "scope": SUBSCRIPTION, "mutations": 0,
        }) + "\n")
    result = subprocess.run(full, capture_output=True, text=True, shell=True, env=ENV, timeout=180)
    data = None
    if result.returncode == 0:
        data = json.loads(result.stdout)
    value = {
        "name": name, "startedAtUtc": started, "completedAtUtc": now(),
        "exitCode": result.returncode, "response": data,
        "stderr": result.stderr,
        "azureMutationCount": 0,
    }
    with path.open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
    with ledger.open("a", encoding="utf-8") as file:
        file.write(json.dumps({
            "event": "COMPLETE", "name": name, "completedAtUtc": value["completedAtUtc"],
            "exitCode": result.returncode, "responseFile": path.name, "mutations": 0,
        }) + "\n")
    print(name, "PASS" if result.returncode == 0 else "FAILED", flush=True)
    return value


def get(name, resource, version):
    return read_call(name, ["rest", "--method", "GET", "--url",
                           "https://management.azure.com" + resource + "?api-version=" + version])


def main():
    stage = sys.argv[1] if len(sys.argv) == 2 else ""
    if stage == "initial":
        account = read_call("ACCOUNT", ["account", "show", "--subscription", SUBSCRIPTION])
        if account["exitCode"]:
            return
        response = account["response"]
        if response["id"] != SUBSCRIPTION or response["tenantId"] != TENANT:
            raise RuntimeError("subscription/tenant mismatch")
        read_call("EXTENSIONS", ["extension", "list"], local=True)
        providers = read_call("PROVIDERS", ["provider", "list", "--subscription", SUBSCRIPTION])
        if providers["exitCode"]:
            return
        get("RESOURCES", PREFIX + "/resources", "2021-04-01")
        get("GROUPS", PREFIX + "/resourcegroups", "2021-04-01")
        read_call("VNets", ["network", "vnet", "list", "--subscription", SUBSCRIPTION])
        scope = PREFIX + "/providers/Microsoft.App/locations/canadacentral"
        read_call("APP_QUOTA_CLI", ["quota", "list", "--scope", scope])
        read_call("APP_USAGE_CLI", ["quota", "usage", "list", "--scope", scope])
        get("APP_USAGES_NATIVE", scope + "/usages", "2025-07-01")
        get("APP_PROFILE_TYPES", scope + "/availableManagedEnvironmentsWorkloadProfileTypes", "2025-07-01")
        read_call("NETWORK_USAGE", ["network", "list-usages", "--location", "canadacentral",
                                    "--subscription", SUBSCRIPTION])
        read_call("COMPUTE_USAGE", ["vm", "list-usage", "--location", "canadacentral",
                                    "--subscription", SUBSCRIPTION])
        read_call("IDENTITIES", ["identity", "list", "--subscription", SUBSCRIPTION])
        read_call("ROLE_ASSIGNMENTS", ["role", "assignment", "list", "--all",
                                       "--subscription", SUBSCRIPTION])
        get("SERVICE_TAGS", PREFIX + "/providers/Microsoft.Network/locations/canadacentral/serviceTags", "2024-05-01")
    elif stage == "infrastructure":
        resources = json.loads((HERE / "RESOURCES.json").read_text())["response"]["value"]
        versions = {
            "microsoft.network/azurefirewalls": "2024-05-01",
            "microsoft.network/routetables": "2024-05-01",
            "microsoft.network/privatednszones": "2024-06-01",
            "microsoft.network/privateendpoints": "2024-05-01",
            "microsoft.containerregistry/registries": "2025-11-01",
        }
        for resource in resources:
            kind = resource["type"].lower()
            if kind in versions and "nzila-g2-proof-xre47vggs5uhw" in resource["id"]:
                get("G2_" + resource["name"], resource["id"], versions[kind])
        read_call("VAULT_NAME_AVAILABILITY", [
            "rest", "--method", "POST", "--url",
            "https://management.azure.com" + PREFIX +
            "/providers/Microsoft.KeyVault/checkNameAvailability?api-version=2024-11-01",
            "--body", json.dumps({"name": "nzl-g3-test-001-kv", "type": "Microsoft.KeyVault/vaults"}),
        ])
        get("DELETED_VAULTS", PREFIX + "/providers/Microsoft.KeyVault/deletedVaults", "2024-11-01")
        read_call("BUILDER_SKU", ["vm", "list-skus", "--location", "canadacentral",
                                 "--size", "Standard_B2s", "--all", "--subscription", SUBSCRIPTION])
        get("PROVIDER_NETWORK_OPERATIONS", "/providers/Microsoft.Network/operations", "2024-05-01")
        read_call("ROLE_DEFINITIONS", ["role", "definition", "list", "--subscription", SUBSCRIPTION])
    elif stage == "principals-v2":
        assignments = json.loads((HERE / "ROLE_ASSIGNMENTS.json").read_text())["response"]
        apps = sorted({
            x["principalName"] for x in assignments
            if x.get("principalType") == "ServicePrincipal" and x["scope"].lower() == PREFIX.lower()
            and x["roleDefinitionName"] == "Contributor"
        })
        for app in apps:
            read_call("SP_TYPED_" + app, ["ad", "sp", "show", "--id", app, "--query",
                      "{id:id,appId:appId,displayName:displayName,servicePrincipalType:servicePrincipalType}"])
            registration = read_call("APP_TYPED_" + app, ["ad", "app", "show", "--id", app, "--query",
                      "{id:id,appId:appId,displayName:displayName}"])
            if registration["exitCode"] == 0:
                read_call("FEDERATION_TYPED_" + app, ["ad", "app", "federated-credential", "list", "--id", app])
    else:
        raise RuntimeError("usage: read_census.py initial|infrastructure|principals-v2")


if __name__ == "__main__":
    main()
