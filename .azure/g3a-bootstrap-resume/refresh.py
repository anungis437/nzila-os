"""Time-sensitive read-only refresh; the validated retry package is immutable."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
PACKAGE = HERE.parent / "g3a-bootstrap-retry"
sys.path.insert(0, str(PACKAGE))
import retry

SUB = retry.p.SUB
SCOPE = "/subscriptions/" + SUB


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(path):
    with Path(path).open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def fresh(name, value):
    path = HERE / name
    sequence = 2
    while path.exists():
        path = HERE / (Path(name).stem + "_" + str(sequence) + Path(name).suffix)
        sequence += 1
    with path.open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")
    if path.name != name:
        print("PRESERVED_PRIOR_EVIDENCE_NEW_READ=" + path.name, flush=True)


def read(name, args):
    require(args[0] in {"account", "ad", "role", "provider", "group", "network", "vm", "quota", "storage", "rest", "resource"} and
            not any(x in args for x in ("create", "delete", "update", "set", "register", "get-access-token")) and
            (args[0] != "rest" or args[2] == "get"), "READ_ONLY_BOUNDARY")
    result = subprocess.run([retry.p.AZ, *args, "--output", "json", "--only-show-errors"],
                            capture_output=True, text=True, env=retry.p.ENV, timeout=300)
    value = json.loads(result.stdout) if result.stdout.strip() else None
    fresh(name + ".json", {"command": ["az", *args], "exitCode": result.returncode,
                          "value": value, "stderr": result.stderr.strip(),
                          "utc": datetime.now(timezone.utc).isoformat()})
    require(result.returncode == 0, "REFRESH_READ_FAILED_" + name)
    return value


def verify_package():
    path = PACKAGE / "RETRY_PREDEPLOY_VERIFICATION.json"
    require(digest(path) == "fc9dea154679a24200ba0ef68f8512c67ff5557b6227d3a60836fd17dd685a53", "PREDEPLOY_ROOT_CHANGED")
    root = load(path)
    for name, expected in root["fileHashes"].items():
        require(digest(PACKAGE / name) == expected, "VALIDATED_PACKAGE_CHANGED_" + name)
    for name, expected in root["protectedFileHashes"].items():
        require(digest(name) == expected, "PROTECTED_FILE_CHANGED")
    require(digest(root["authorityPath"]) == root["authoritySha256"], "EXISTING_AUTHORITY_CHANGED")
    require(not (PACKAGE / "AUTHORITY_CONSUMED.json").exists() and
            not (PACKAGE / "CSE_EXECUTION_CONSUMED.json").exists() and
            not list(PACKAGE.glob("EVENT_*.json")), "UNEXPECTED_PARTIAL_EXECUTION")
    require(load(PACKAGE / ".azure" / "validate-status.json")["completedStep"] == "UpdateStatus" and
            "Status: Validated" in (PACKAGE / ".azure" / "deployment-plan.md").read_text(), "VALIDATION_CHANGED")
    fresh("SEALED_PACKAGE_CHECK_" + sys.argv[1] + ".json", {"status": "PASS", "rootSha256": digest(path),
                                      "validatedFiles": len(root["fileHashes"]),
                                      "protectedFiles": len(root["protectedFileHashes"]),
                                      "authorityConsumed": False})


def safety():
    account = read("ACCOUNT", ["account", "show", "--subscription", SUB])
    require(account["id"] == SUB and account["tenantId"] == retry.p.TENANT and account["state"] == "Enabled",
            "CONTEXT_CHANGED")
    principal = read("PRINCIPAL", ["ad", "signed-in-user", "show",
                                  "--query", "{id:id,userPrincipalName:userPrincipalName}"])
    require(principal["id"] == load(PACKAGE / "PRINCIPAL.json")["value"]["id"], "AUTHENTICATED_PRINCIPAL_CHANGED")
    jobs = {
        "PERMISSIONS": ["rest", "--method", "get", "--url", "https://management.azure.com" + SCOPE +
                        "/providers/Microsoft.Authorization/permissions?api-version=2022-04-01"],
        "PRINCIPAL_ROLES": ["role", "assignment", "list", "--assignee-object-id", principal["id"], "--all",
                            "--include-inherited", "--fill-principal-name", "false"],
        "DENIES": ["rest", "--method", "get", "--url", "https://management.azure.com" + SCOPE +
                   "/providers/Microsoft.Authorization/denyAssignments?api-version=2022-04-01"],
        "PROVIDERS": ["provider", "list", "--subscription", SUB, "--query",
                      "[?namespace=='Microsoft.Compute' || namespace=='Microsoft.Network' || "
                      "namespace=='Microsoft.Storage' || namespace=='Microsoft.ManagedIdentity' || "
                      "namespace=='Microsoft.Authorization'].{namespace:namespace,state:registrationState}"],
        "RG_ABSENCE": ["group", "exists", "--name", load(PACKAGE / "AUTHORITY_BINDING.json")["resourceGroupCandidate"],
                       "--subscription", SUB],
        "VNETS": ["network", "vnet", "list", "--subscription", SUB,
                  "--query", "[].{id:id,addressSpace:addressSpace.addressPrefixes}"],
        "SKU": ["vm", "list-skus", "--location", "canadacentral", "--size", "Standard_B2s",
                "--all", "--subscription", SUB],
        "QUOTA": ["quota", "list", "--scope", SCOPE + "/providers/Microsoft.Compute/locations/canadacentral"],
        "USAGE": ["vm", "list-usage", "--location", "canadacentral", "--subscription", SUB],
        "HANDLERS": ["vm", "extension", "image", "list-versions", "--publisher", "Microsoft.Azure.Extensions",
                     "--name", "CustomScript", "--location", "canadacentral", "--subscription", SUB],
    }
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {name: pool.submit(read, name, args) for name, args in jobs.items()}
        values = {name: future.result() for name, future in futures.items()}
    require(any(x["actions"] == ["*"] and not x.get("notActions") for x in values["PERMISSIONS"]["value"]),
            "DEPLOYMENT_PERMISSION_CHANGED")
    require(any(x["scope"].lower() in {SCOPE.lower(), "/"} and not x.get("condition") and
                x["roleDefinitionId"].split("/")[-1] in
                {"8e3af657-a8ff-443c-a75c-2fe8c4bcb635", "18d7d88d-d35e-4fb5-a5c3-7773c20a72d9"}
                for x in values["PRINCIPAL_ROLES"]), "ROLE_ASSIGNMENT_PERMISSION_CHANGED")
    require(not values["DENIES"]["value"], "DENY_ASSIGNMENT_CHANGED")
    require(len(values["PROVIDERS"]) == 5 and all(x["state"] == "Registered" for x in values["PROVIDERS"]),
            "PROVIDER_REGISTRATION_CHANGED")
    require(values["RG_ABSENCE"] is False, "UNEXPECTED_RETRY_RG")
    selected = ipaddress.ip_network(load(PACKAGE / "CIDR_SELECTION.json")["chosen"])
    require(all(not selected.overlaps(ipaddress.ip_network(cidr))
                for x in values["VNETS"] for cidr in x["addressSpace"]), "SELECTED_CIDR_OCCUPIED")
    exact = [x for x in values["SKU"] if x["name"] == "Standard_B2s" and x["resourceType"] == "virtualMachines"]
    require(len(exact) == 1 and not exact[0]["restrictions"], "B2S_UNAVAILABLE")
    for name in ("cores", "standardBSFamily"):
        items = [x for x in values["USAGE"] if x["name"]["value"].lower() == name.lower()]
        require(len(items) == 1 and int(items[0]["currentValue"]) + 2 <= int(items[0]["limit"]), "QUOTA_HEADROOM_CHANGED")
    require(any(re.fullmatch(r"2\.1\.\d+", x["name"]) for x in values["HANDLERS"]), "FAMILY_NOT_PUBLISHED")
    fresh("SAFETY_REFRESH_GATE.json", {
        "status": "PASS", "subscription": SUB, "tenant": retry.p.TENANT, "principalId": principal["id"],
        "CSE_2_1_FAMILY_AVAILABLE": "YES", "versions": [x["name"] for x in values["HANDLERS"]],
        "CIDR": str(selected), "resourceGroupAbsent": True, "quotaHeadroom": "PASS",
        "AzureMutatingDispatches": 0, "utc": datetime.now(timezone.utc).isoformat()})


def cost():
    model_path = Path(load(PACKAGE / "CURRENT_COST_GATE.json")["capturedMeterModel"])
    model = load(model_path)
    ids = sorted({x["meterId"] for x in model["rates"].values()})
    query = {"api-version": "2023-01-01-preview", "currencyCode": "'CAD'",
             "$filter": " or ".join("meterId eq '" + x + "'" for x in ids)}
    url = "https://prices.azure.com/api/retail/prices?" + urlencode(query)
    items = []
    page = 0
    while url:
        with urlopen(url, timeout=120) as response:
            data = json.load(response)
        page += 1
        fresh("CURRENT_CAD_METERS_PREVIEW_" + str(page) + ".json", data)
        items.extend(data["Items"])
        url = data.get("NextPageLink")
        require(page <= 20, "UNEXPECTED_PRICING_PAGINATION")
    refreshed = {}
    for key, rate in model["rates"].items():
        matches = [x for x in items if x["meterId"] == rate["meterId"] and x["currencyCode"] == "CAD" and
                   x["unitOfMeasure"] == rate["unit"] and x["type"] == "Consumption" and
                   Decimal(str(x.get("tierMinimumUnits", 0))) == 0 and
                   Decimal(str(x["retailPrice"])) == Decimal(rate["rateCAD"])]
        require(matches, "RETAIL_METER_STALE_REPRICE_REQUIRED_" + key)
        refreshed[key] = {"rateCAD": rate["rateCAD"], "matchingCurrentRecords": len(matches), "meterId": rate["meterId"]}
    expected = sum(Decimal(x) for x in model["amountsCAD"].values())
    require(expected <= Decimal("3") and expected * Decimal("1.5") <= Decimal("3"), "COST_CEILING_EXCEEDED")
    fresh("REFRESHED_COST_GATE.json", {
        "status": "PASS", "REFRESHED_EXPECTED_COST_CAD": str(expected), "ceilingCAD": "3.00",
        "contingencyMinimum": "50_PERCENT", "rates": refreshed, "priorModelSha256": digest(model_path),
        "pricingPages": page, "currency": "CAD", "historicalProofCostCAD": "1.3567668",
        "noResourcesCreated": True, "utc": datetime.now(timezone.utc).isoformat()})


def main():
    fresh("CONCURRENCY_REFRESH_" + sys.argv[1] + ".json", retry.baseline())
    verify_package()
    if sys.argv[1] == "safety":
        safety()
    elif sys.argv[1] == "cost-precision":
        cost()
    else:
        raise RuntimeError("UNKNOWN_REFRESH_PHASE")
    print("REFRESH_" + sys.argv[1].upper() + "_PASS", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        fresh("REFRESH_STOP_" + sys.argv[1] + ".json", {
            "status": "STOP_BEFORE_MUTATION", "reason": str(error), "authorityConsumed": False})
        raise
