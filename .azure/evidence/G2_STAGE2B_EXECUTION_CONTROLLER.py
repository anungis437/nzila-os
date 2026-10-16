import datetime
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(r"C:\APPS\worktrees\nzila-g2-provenance")
E = ROOT / ".azure" / "evidence"
S = ROOT / "infrastructure" / "landing-zone" / "g2-builder"
D = S / "stage2b"
P = "G2_STAGE2B_"
SUB = "5d819f33-d16f-429c-a3c0-5b0e94740ba3"
TENANT = "5082b8be-b04d-4a13-b61c-b6397670177b"
RG = "nzila-g2-proof-xre47vggs5uhw"
BUILDER = "c59571aa-66ea-47c5-83d5-59946b318ae2"
RUNTIME = "b150b19a-645d-493f-9bb4-0aa81cb0c449"
VM = "nzila-g2-runtime-proof"
NIC = VM + "-nic"
DISK = VM + "-osdisk"
EXT = "nzila-g2-runtime-once"
PREFIX = f"/subscriptions/{SUB}/resourceGroups/{RG}/providers/"
VM_ID = PREFIX + "Microsoft.Compute/virtualMachines/" + VM
NIC_ID = PREFIX + "Microsoft.Network/networkInterfaces/" + NIC
DISK_ID = PREFIX + "Microsoft.Compute/disks/" + DISK
EXT_ID = VM_ID + "/extensions/" + EXT
ALLOWED = {v.lower() for v in (VM_ID, NIC_ID, DISK_ID, EXT_ID)}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((E / name).read_text(encoding="utf-8-sig"))


def save(name, value):
    with (E / (P + name)).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def command(args, timeout=900):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("LOCAL_COMMAND_FAILED: " + result.stderr.decode("utf-8", errors="replace"))
    return result.stdout


def az(*args):
    result = subprocess.run([shutil.which("az"), *args, "-o", "json"], capture_output=True, timeout=1200)
    if result.returncode:
        raise RuntimeError("AZURE_COMMAND_FAILED: " + result.stderr.decode("cp1252"))
    return json.loads(result.stdout.decode("cp1252")) if result.stdout.strip() else None


def stable(value):
    if isinstance(value, dict):
        return {k: stable(v) for k, v in value.items() if k not in ("etag", "systemData")}
    if isinstance(value, list):
        return [stable(v) for v in value]
    return value


def checkpoint():
    git = lambda *args: command(["git", "-C", str(ROOT), *args]).decode().strip()
    current = {"branch": git("branch", "--show-current"), "head": git("rev-parse", "HEAD"),
               "status": git("status", "--short").splitlines()}
    assert current == read("G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json")["concurrency"]
    account = az("account", "show")
    assert account["id"] == SUB and account["tenantId"] == TENANT
    return current


def history():
    seal = read("G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json")
    for group in ("evidenceHashes", "priorEvidenceHashes"):
        for name, expected in seal[group].items():
            assert sha(E / name) == expected, name
    for name, expected in seal["sourceHashes"].items():
        assert sha(S / "stage2a" / name) == expected, name
    assert sha(E / "G2_LOCAL_OCI_FINAL_VERIFICATION.json") == seal["localProofRootSha256"]
    assert read("G2_CORRECTED_PRODUCTION_DISPOSITION.json")["fields"]["STAGE2A_BUILDER_ARTIFACT"] == "PROVEN"


def authorization():
    old = read("G2_CORRECTED_PRODUCTION_FINAL_ESTATE.json")
    fields = ("id", "principalId", "roleDefinitionId", "scope", "condition", "conditionVersion")
    canonical = lambda values: sorted(({k: v.get(k) for k in fields} for v in values), key=lambda v: v["id"])
    values = []
    expected_names = {"ba1fd686-3000-51dc-8fa6-1cfdedf67d20", "6628bb3e-5e59-5dcb-9f7b-80b421a7a7f8",
                      "1caf1212-c9f0-5165-a0b7-9827ab84df7b"}
    for principal in (BUILDER, RUNTIME):
        assignments = az("role", "assignment", "list", "--assignee-object-id", principal, "--all",
                         "--include-inherited", "--include-groups", "--subscription", SUB)
        expected = [v for v in old["roles"] if v["principalId"] == principal]
        assert canonical(assignments) == canonical(expected), principal
        values.extend(assignments)
    assert {v["name"] for v in values} == expected_names
    definitions = {}
    for identifier in {v["roleDefinitionId"].split("/")[-1] for v in values}:
        definition = az("role", "definition", "list", "--name", identifier, "--subscription", SUB)
        assert len(definition) == 1 and all(v["actions"] == [] for v in definition[0]["permissions"])
        definitions[identifier] = definition
    snapshot = canonical(values)
    raw = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    return {"capturedAtUtc": now(), "assignments": snapshot, "definitions": definitions,
            "snapshotSha256": hashlib.sha256(raw).hexdigest(), "census": "PASS",
            "builderManagementPermissionAdded": False, "runtimeManagementPermissionAdded": False}


def estate():
    old = read("G2_CORRECTED_PRODUCTION_FINAL_ESTATE.json")
    versions = read("G2_FRESH_BOOT_RESUME_FINAL_ESTATE.json")["resourceApiVersions"]
    listing = az("resource", "list", "-g", RG, "--subscription", SUB)
    assert len(listing) == 16
    resources = {v["id"]: az("rest", "--method", "get", "--url", "https://management.azure.com" +
                 v["id"] + "?api-version=" + versions[v["type"].lower()]) for v in listing}
    normalize = lambda value: {k.lower(): stable(v) for k, v in value.items()}
    assert normalize(resources) == normalize(old["resources"])
    target = next(v for v in resources.values() if v["type"].lower() == "microsoft.containerregistry/registries")
    assert target["properties"]["publicNetworkAccess"] == "Disabled"
    assert target["properties"]["networkRuleBypassOptions"] == "None"
    assert target["properties"]["adminUserEnabled"] is False
    fields = ("name", "scope", "principalId", "principalType", "roleDefinitionId", "condition", "conditionVersion")
    snapshot = lambda values: sorted(({k: v.get(k) for k in fields} for v in values), key=lambda v: v["name"])
    roles = az("role", "assignment", "list", "--scope", target["id"], "--subscription", SUB)
    assert snapshot(roles) == snapshot(old["roles"])
    source = az("rest", "--method", "get", "--url", "https://management.azure.com" +
                old["source"]["id"] + "?api-version=2025-11-01")
    assert stable(source) == stable(old["source"])
    source_roles = az("role", "assignment", "list", "--scope", source["id"], "--subscription", SUB)
    assert snapshot(source_roles) == snapshot(old["sourceRoles"])
    extensions = az("vm", "extension", "list", "-g", RG, "--vm-name", "nzila-g2-builder-y3koaeijzi6mu",
                    "--subscription", SUB)
    assert extensions == []
    pe = next(v for v in resources.values() if v["type"].lower() == "microsoft.network/privateendpoints")
    nic = az("rest", "--method", "get", "--url", "https://management.azure.com" +
             pe["properties"]["networkInterfaces"][0]["id"] + "?api-version=2024-05-01")
    assert stable(nic) == stable(old["endpointNic"])
    zone = next(v for v in resources.values() if v["type"].lower() == "microsoft.network/privatednszones")
    dns = {}
    for name, expected in old["dnsRecords"].items():
        dns[name] = az("rest", "--method", "get", "--url", "https://management.azure.com" +
                       zone["id"] + "/A/" + name + "?api-version=2024-06-01")
        assert stable(dns[name]) == stable(expected)
    groups = az("rest", "--method", "get", "--url", "https://management.azure.com" +
                pe["id"] + "/privateDnsZoneGroups?api-version=2024-05-01")
    assert stable(groups) == stable(old["zoneGroups"])
    return {"capturedAtUtc": now(), "resources": resources, "roles": roles, "source": source,
            "sourceRoles": source_roles, "extensions": [], "endpointNic": nic, "dnsRecords": dns,
            "zoneGroups": groups, "PROTECTED_INFRASTRUCTURE_RESOURCE_COUNT": 16}


def baseline():
    concurrency = checkpoint()
    history()
    census = authorization()
    state = estate()
    vm = next(v for v in state["resources"].values() if v["type"].lower() == "microsoft.compute/virtualmachines")
    nic_id = vm["properties"]["networkProfile"]["networkInterfaces"][0]["id"]
    nic = next(v for k, v in state["resources"].items() if k.lower() == nic_id.lower())
    runtime = next(v for v in state["resources"].values() if v["type"].lower() ==
                   "microsoft.managedidentity/userassignedidentities" and v["properties"]["principalId"] == RUNTIME)
    assert runtime["properties"]["clientId"] == "ccea7b0f-a4ec-4665-ba9d-ab5071e165aa"
    save("PREDISPATCH_AUTHORIZATION.json", census)
    save("BASELINE.json", {"capturedAtUtc": now(), "concurrency": concurrency, "estate": state,
        "stage2aProofRootSha256": sha(E / "G2_CORRECTED_PRODUCTION_FINAL_VERIFICATION.json"),
        "priorEvidenceHashes": {str(v.relative_to(E)): sha(v) for v in E.rglob("*") if v.is_file()
                                and not v.relative_to(E).parts[0].startswith(P)},
        "design": {"runtimeIdentityId": runtime["id"], "runtimeClientId": runtime["properties"]["clientId"],
                   "runtimePrincipalId": RUNTIME, "subnetId": nic["properties"]["ipConfigurations"][0]["properties"]["subnet"]["id"],
                   "nsgId": nic["properties"]["networkSecurityGroup"]["id"],
                   "imageReference": vm["properties"]["storageProfile"]["imageReference"],
                   "vmSize": "Standard_B2s", "temporaryIds": sorted(ALLOWED),
                   "tags": {**vm["tags"], "service": "runtime-identity-proof", "product": "shared-platform"}}})
    print("Stage2B fresh exact runtime/builder census and protected16/private baseline PASS:", census["snapshotSha256"])


def inputs():
    paths = [D / "runtime.py", D / "runtime.bicep", D / "test_runtime.py"]
    paths += [S / "stage2a" / folder / name for folder, name in (
        ("private-import", "verifier.py"), ("blob-readback", "observer.py"),
        ("empty-path", "validator.py"), ("empty-path", "observer.py"), ("local-oci-repair", "validator.py"))]
    return {str(v.relative_to(S)): sha(v) for v in paths}


def prepare():
    checkpoint()
    history()
    design = read(P + "BASELINE.json")["design"]
    with tempfile.TemporaryDirectory(prefix="nzila-stage2b-key-") as folder:
        private = pathlib.Path(folder) / "key"
        command([shutil.which("ssh-keygen"), "-q", "-t", "rsa", "-b", "3072", "-N", "",
                 "-C", "stage2b-provisioning-only", "-f", str(private)])
        public = private.with_suffix(".pub").read_text().strip()
        assert public.startswith("ssh-rsa ")
        public_hash = hashlib.sha256(public.encode()).hexdigest()
    assert not private.exists() and not pathlib.Path(folder).exists()
    save("KEY_HYGIENE.json", {"capturedAtUtc": now(), "publicKeySha256": public_hash,
                            "RUNTIME_PROOF_PRIVATE_KEY_RETAINED": "NO", "sshSessionAuthorized": False})
    params = {"provisioningSshPublicKey": public, "imageVersion": design["imageReference"]["version"],
              "runtimeIdentityId": design["runtimeIdentityId"], "subnetId": design["subnetId"],
              "nsgId": design["nsgId"], "tags": design["tags"]}
    save("PARAMETERS.json", {"$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
                            "contentVersion": "1.0.0.0", "parameters": {k: {"value": v} for k, v in params.items()}})
    image = az("vm", "image", "show", "--urn", "Canonical:ubuntu-24_04-lts:server:" + params["imageVersion"],
               "--location", "canadacentral", "--subscription", SUB)
    assert image["name"] == params["imageVersion"] and image["osDiskImage"]["operatingSystem"] == "Linux"
    skus = az("vm", "list-skus", "--location", "canadacentral", "--size", "Standard_B2s", "--all",
              "--subscription", SUB)
    selected = [v for v in skus if v["name"] == "Standard_B2s"]
    assert len(selected) == 1 and selected[0]["restrictions"] == []
    usage = az("vm", "list-usage", "--location", "canadacentral", "--subscription", SUB)
    cores = [v for v in usage if v["name"]["value"] in ("cores", "standardBSFamily")]
    assert len(cores) == 2 and all(int(v["currentValue"]) + 2 <= int(v["limit"]) for v in cores)
    save("IMAGE_AND_CAPACITY.json", {"image": image, "sku": selected, "quotas": cores})
    tests = {}
    folders = [S / "stage2a" / name for name in ("redirect-guard", "blob-readback", "private-import",
               "corrected-redirect", "empty-path", "synthetic-production", "synthetic-revised", "local-oci-repair")] + [D]
    for directory in folders:
        args = [sys.executable, "-m", "unittest", "discover", "-s", str(directory), "-p", "test_*.py", "-v"]
        process = subprocess.run(args, capture_output=True, text=True)
        assert process.returncode == 0, process.stdout + process.stderr
        tests[directory.name] = {"command": args, "exitCode": 0, "output": process.stdout + process.stderr}
    save("TESTS.json", tests)
    # The earlier development compile is retained, not overwritten by current authority.
    template = E / (P + "TEMPLATE.json")
    if template.exists():
        template.rename(E / (P + "DRAFT_TEMPLATE.json"))
    command([shutil.which("az"), "bicep", "build", "--file", str(D / "runtime.bicep"), "--outfile", str(template)])
    lint = command([shutil.which("az"), "bicep", "lint", "--file", str(D / "runtime.bicep")])
    command(["git", "-C", str(ROOT), "diff", "--check"])
    save("LOCAL_CHECKS.json", {"capturedAtUtc": now(), "tests": 109, "build": "PASS", "lint": "PASS",
                             "lintOutput": lint.decode("utf-8", errors="replace"), "diffCheck": "PASS",
                             "templateSha256": sha(template), "sourceHashes": inputs()})
    print("Stage2B 16 contracts plus 93 frozen regressions/build/lint/key destruction PASS")


def exact_gate(raw):
    changes = [v for v in raw["changes"] if v["changeType"] not in ("Ignore", "NoChange")]
    assert len(changes) == 3
    assert all(v["changeType"] == "Create" for v in changes)
    assert {v["resourceId"].lower() for v in changes} == {v.lower() for v in (VM_ID, NIC_ID, EXT_ID)}


def validation():
    checkpoint()
    history()
    census = authorization()
    assert census["snapshotSha256"] == read(P + "PREDISPATCH_AUTHORIZATION.json")["snapshotSha256"]
    save("PREVALIDATION_AUTHORIZATION.json", census)
    args = ("-g", RG, "--subscription", SUB, "--template-file", str(E / (P + "TEMPLATE.json")),
            "--parameters", str(E / (P + "PARAMETERS.json")))
    save("PROVIDER_VALIDATION.json", az("deployment", "group", "validate", *args))
    raw = az("deployment", "group", "what-if", *args, "--result-format", "FullResourcePayloads", "--no-pretty-print")
    exact_gate(raw)
    save("WHATIF_RAW.json", raw)
    policies = az("policy", "assignment", "list", "--scope", f"/subscriptions/{SUB}/resourceGroups/{RG}",
                  "--disable-scope-strict-match", "--subscription", SUB)
    assert policies == []
    save("POLICY_CONTEXT.json", {"applicableAssignments": policies})
    save("SOURCE_AUTHORITY.json", {"capturedAtUtc": now(), "mission": "NZ-20261008-INFRA-001",
        "slice": "G2_STAGE2B_RUNTIME_IDENTITY_PROOF", "concurrency": checkpoint(), "sourceHashes": inputs(),
        "templateSha256": sha(E / (P + "TEMPLATE.json")), "parameterSha256": sha(E / (P + "PARAMETERS.json")),
        "whatIfSha256": sha(E / (P + "WHATIF_RAW.json")), "payloadSha256": sha(E / "G2_SYNTHETIC_PRODUCTION_PAYLOAD.json"),
        "manifestDigest": "sha256:13fbd3f9de68376f8e55af8ce64172eec3ae65a73b9ce70f9d26e73271bef690",
        "runtimePrincipal": RUNTIME, "design": read(P + "BASELINE.json")["design"],
        "predispatchSnapshotSha256": census["snapshotSha256"],
        "maximumExecutions": 1, "maximumArtifactCommits": 0, "noAutomaticRetry": True,
        "explicitCreates": [VM_ID, NIC_ID, EXT_ID], "implicitOsDisk": DISK_ID,
        "expectedTeardownInventory": sorted(ALLOWED), "expectedSteadyState": 16,
        "allowedOperations": ["synthetic-health tag/digest manifest and exact payload GET"],
        "deniedOperations": ["synthetic-health upload-init POST", "g2-tooling manifest GET", "g2-tooling upload-init POST"],
        "keyHygieneSha256": sha(E / (P + "KEY_HYGIENE.json")),
        "priorEvidenceHashes": read(P + "BASELINE.json")["priorEvidenceHashes"]})
    print("Stage2B provider/raw Create3 (NIC+VM+CSE), implicit OS disk, policy/census/source bindings PASS")


def check():
    a = read(P + "SOURCE_AUTHORITY.json")
    assert checkpoint() == a["concurrency"] and inputs() == a["sourceHashes"]
    for name, key in (("TEMPLATE.json", "templateSha256"), ("PARAMETERS.json", "parameterSha256"),
                      ("WHATIF_RAW.json", "whatIfSha256"), ("KEY_HYGIENE.json", "keyHygieneSha256")):
        assert sha(E / (P + name)) == a[key], name
    for name, expected in a["priorEvidenceHashes"].items():
        assert sha(E / name) == expected, name
    history()
    return a


def safe_operations(name):
    values = az("deployment", "operation", "group", "list", "-g", RG, "-n", name, "--subscription", SUB)
    return [{"operationId": v["operationId"], "operation": v["properties"].get("provisioningOperation"),
             "state": v["properties"]["provisioningState"], "target": v["properties"].get("targetResource")}
            for v in values]


def live_inventory():
    listing = az("resource", "list", "-g", RG, "--subscription", SUB)
    old = {k.lower() for k in read(P + "BASELINE.json")["estate"]["resources"]}
    added = {v["id"].lower(): v for v in listing if v["id"].lower() not in old}
    assert set(added) <= ALLOWED, "Unexpected resource delta"
    versions = {"microsoft.compute/virtualmachines": "2024-11-01",
                "microsoft.compute/virtualmachines/extensions": "2024-11-01",
                "microsoft.compute/disks": "2024-03-02", "microsoft.network/networkinterfaces": "2024-05-01"}
    return {key: az("rest", "--method", "get", "--url", "https://management.azure.com" +
                   value["id"] + "?api-version=" + versions[value["type"].lower()]) for key, value in added.items()}


def cleanup(name):
    deployed = az("deployment", "group", "show", "-g", RG, "-n", name, "--subscription", SUB)
    assert deployed["properties"]["provisioningState"] in ("Succeeded", "Failed", "Canceled"), "Nonterminal deployment: no teardown"
    inventory = live_inventory()
    operations = safe_operations(name)
    creates = {v["target"]["id"].lower() for v in operations if v["operation"] == "Create" and v["target"]}
    assert creates <= ALLOWED
    assert set(inventory) - {DISK_ID.lower()} <= creates, "Teardown ownership not proven"
    if DISK_ID.lower() in inventory:
        assert VM_ID.lower() in creates
        disk = inventory[DISK_ID.lower()]
        assert disk["properties"]["creationData"]["createOption"] == "FromImage"
        assert disk.get("managedBy", "").lower() in ("", VM_ID.lower())
        created = datetime.datetime.fromisoformat(disk["properties"]["timeCreated"].replace("Z", "+00:00"))
        began = datetime.datetime.fromisoformat(read(P + "AUTHORITY_CONSUMED.json")["capturedAtUtc"])
        assert created >= began - datetime.timedelta(seconds=30), "Disk predates transaction"
    save("TEARDOWN_OWNERSHIP.json", {"capturedAtUtc": now(), "inventory": inventory,
                                  "deploymentOperations": operations, "baselineAbsenceVerified": True})
    removed = []
    if EXT_ID.lower() in inventory:
        assert inventory[EXT_ID.lower()]["properties"]["provisioningState"] in ("Succeeded", "Failed")
        az("vm", "extension", "delete", "-g", RG, "--vm-name", VM, "-n", EXT, "--subscription", SUB)
        removed.append(EXT_ID)
    if VM_ID.lower() in inventory:
        az("vm", "delete", "-g", RG, "-n", VM, "--yes", "--subscription", SUB)
        removed.append(VM_ID)
    if NIC_ID.lower() in inventory:
        az("network", "nic", "delete", "-g", RG, "-n", NIC, "--subscription", SUB)
        removed.append(NIC_ID)
    if DISK_ID.lower() in inventory:
        az("disk", "delete", "-g", RG, "-n", DISK, "--yes", "--subscription", SUB)
        removed.append(DISK_ID)
    residual = live_inventory()
    save("TEARDOWN.json", {"capturedAtUtc": now(), "deletedExactIds": removed, "residualResources": residual,
                          "TRANSIENT_RUNTIME_RESOURCES_PRESENT": "YES" if residual else "NO"})
    assert residual == {}, "STAGE2B_TEARDOWN_FAILURE"
    print("Exact transaction runtime CSE/VM/NIC/OS disk removed")


def execute():
    a = check()
    plan = (ROOT / ".azure" / "deployment-plan.md").read_text(encoding="utf-8")
    assert plan.split("## Current slice: corrected")[0].count("Status: Validated.") == 1
    assert json.loads((ROOT / ".azure" / "validate-status.json").read_text())["completedStep"] == "UpdateStatus"
    assert read(P + "KEY_HYGIENE.json")["RUNTIME_PROOF_PRIVATE_KEY_RETAINED"] == "NO"
    save("PREDEPLOYMENT_ESTATE.json", estate())
    args = ("-g", RG, "--subscription", SUB, "--template-file", str(E / (P + "TEMPLATE.json")),
            "--parameters", str(E / (P + "PARAMETERS.json")))
    raw = az("deployment", "group", "what-if", *args, "--result-format", "FullResourcePayloads", "--no-pretty-print")
    exact_gate(raw)
    save("EXECUTION_WHATIF_RAW.json", raw)
    check()
    for name in a["sourceHashes"]:
        path = E / (P + "EXECUTED_" + name.replace("\\", "_").replace("/", "_"))
        with path.open("xb") as stream:
            stream.write((S / name).read_bytes())
    with (E / (P + "EXECUTION_CONTROLLER.py")).open("xb") as stream:
        stream.write(pathlib.Path(__file__).read_bytes())
    census = authorization()
    assert census["snapshotSha256"] == a["predispatchSnapshotSha256"]
    save("IMMEDIATE_AUTHORIZATION.json", census)
    name = "g2-runtime-proof-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    save("AUTHORITY_CONSUMED.json", {"capturedAtUtc": now(), "deploymentName": name, "remainingExecutions": 0,
        "STAGE2B_EXECUTION_AUTHORITY_CONSUMED": "YES", "immediateSnapshotSha256": census["snapshotSha256"],
        "sourceAuthoritySha256": sha(E / (P + "SOURCE_AUTHORITY.json")),
        "executionControllerSha256": sha(E / (P + "EXECUTION_CONTROLLER.py"))})
    try:
        process = subprocess.run([shutil.which("az"), "deployment", "group", "create", *args, "--name", name, "-o", "json"],
                                 capture_output=True, timeout=1200)
        deployment = az("deployment", "group", "show", "-g", RG, "-n", name, "--subscription", SUB)
        save("DEPLOYMENT.json", {"capturedAtUtc": now(), "deploymentName": name, "exitCode": process.returncode,
            "state": deployment["properties"]["provisioningState"],
            "correlationId": deployment["properties"]["correlationId"], "rawRuntimeMessagesPersisted": False})
        inventory = live_inventory()
        vm = inventory[VM_ID.lower()]
        identities = vm["identity"]
        assert identities["type"] == "UserAssigned"
        assert {k.lower() for k in identities["userAssignedIdentities"]} == {a["design"]["runtimeIdentityId"].lower()}
        identity = next(iter(identities["userAssignedIdentities"].values()))
        assert identity["principalId"] == RUNTIME and identity["clientId"] == a["design"]["runtimeClientId"]
        nic = inventory[NIC_ID.lower()]
        configs = nic["properties"]["ipConfigurations"]
        assert len(configs) == 1 and "publicIPAddress" not in configs[0]["properties"]
        assert configs[0]["properties"]["subnet"]["id"].lower() == a["design"]["subnetId"].lower()
        assert nic["properties"]["networkSecurityGroup"]["id"].lower() == a["design"]["nsgId"].lower()
        assert vm["properties"]["storageProfile"]["osDisk"]["managedDisk"]["id"].lower() == DISK_ID.lower()
        save("RUNTIME_SUBSTRATE.json", {"capturedAtUtc": now(), "inventory": inventory,
            "RUNTIME_UAMI_ATTACHED": "YES", "BUILDER_UAMI_ATTACHED": "NO", "OTHER_UAMI_ATTACHED": "NO",
            "BUILDER_RUNTIME_IDENTITY_COLOCATION": "NO", "publicIpPresent": False})
        live = az("vm", "extension", "show", "-g", RG, "--vm-name", VM, "-n", EXT,
                  "--instance-view", "--subscription", SUB)
        assert live["provisioningState"] in ("Succeeded", "Failed")
        messages = "\n".join(v.get("message", "") for group in ("statuses", "substatuses")
                             for v in live.get("instanceView", {}).get(group, []))
        markers = re.findall(r"NZILA_G2_STAGE2B_RESULT=(\{[^\r\n]*\})", messages)
        if not markers and "NZILA_G2_STAGE2B_PRECHECK=PYTHON3_UNAVAILABLE" in messages:
            result = {"status": "FAIL", "failureStage": "PYTHON3_UNAVAILABLE", "noSensitiveMaterialPersisted": True}
        else:
            assert len(markers) == 1, "Sanitized runtime marker missing/ambiguous"
            result = json.loads(markers[0])
        namespace = {"__name__": "sanitizer"}
        exec(compile((S / "stage2a" / "private-import" / "verifier.py").read_bytes(), "sanitizer", "exec"), namespace)
        namespace["encode_result"](result)
        save("GUEST_RESULT.json", {"capturedAtUtc": now(), "result": result, "sanitization": "PASS",
                                  "rawRuntimeMessagesPersisted": False})
        print("Stage2B guest", result["status"], result.get("failureStage", result.get("stage")))
    finally:
        cleanup(name)


if __name__ == "__main__":
    {"baseline": baseline, "prepare": prepare, "validate": validation, "execute": execute}[sys.argv[1]]()
