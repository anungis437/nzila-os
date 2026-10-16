"""New single-use proof; reuse the sealed transport/controller without editing it."""

from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import urlencode

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / "g3a-live-bootstrap"
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\f9c83afa-5ce6-488b-b1cc-3d21d6a33501\Pasted text #1.txt")
sys.path.insert(0, str(PRIOR))
import preflight as p
import validation as v
import live
import bind_execution as b

for module in (p, v, live, b):
    module.HERE = HERE
    module.AUTHORITY = AUTHORITY

fresh, ensure, sha, baseline = p.fresh, p.ensure, p.sha, p.baseline


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8-sig"))


def effective_handler(observed):
    ensure(not observed or re.fullmatch(r"2\.1(?:\.\d+)*", observed), "MATERIALLY_DIFFERENT_HANDLER_FAMILY")
    return observed if observed and re.fullmatch(r"2\.1\.\d+(?:\.\d+)*", observed) else "PLATFORM_RESOLVED_2_1_SERIES"


def finish_reads(principal, quota, usage, chosen, rg):
    for name in ("cores", "standardBSFamily"):
        matches = [item for item in usage if item["name"]["value"].lower() == name.lower()]
        ensure(len(matches) == 1 and int(matches[0]["currentValue"]) + 2 <= int(matches[0]["limit"]),
               "INSUFFICIENT_COMPUTE_QUOTA_" + name)
    versions = p.read("CSE_VERSIONS.json", ["vm", "extension", "image", "list-versions",
                     "--publisher", "Microsoft.Azure.Extensions", "--name", "CustomScript",
                     "--location", "canadacentral", "--subscription", p.SUB])
    ensure(any(re.fullmatch(r"2\.1\.\d+", item["name"]) for item in versions), "NO_2_1_FAMILY")
    fresh("PUBLISHED_HANDLER_BINDING.json", {
        "CSE_HANDLER_SELECTOR": "2.1", "CSE_2_1_FAMILY_AVAILABLE": "YES",
        "availableVersions": [item["name"] for item in versions],
        "effectiveHandler": "OBSERVE_AFTER_PROVISIONING", "sourceEvidence": str(PRIOR / "PUBLISHED_HANDLER_BINDING.json"),
        "exactAzurePackageByteIdentityToSource": "NOT_CLAIMED",
        "autoUpgradeMinorVersion": False, "enableAutomaticUpgrade": False})
    fresh("PREFLIGHT_READS_SUMMARY.json", {
        "status": "PASS", "principalId": principal["id"], "resourceGroup": rg, "CIDR": chosen,
        "quotaCLIAvailable": quota is not None, "authorityConsumed": False, "AzureMutations": 0})


p.finish_quota_and_handler = finish_reads


def prepare():
    fresh("CONCURRENCY_RETRY_PREPARE.json", baseline())
    previous_root = PRIOR / "LIVE_BOOTSTRAP_VERIFICATION.json"
    ensure(sha(previous_root) == "4ea8368db85b45ca3f33e0bdb91a40f9b10b350f5f1646ed5f9ec3b1c131a9d1",
           "PREVIOUS_PACKET_ROOT_CHANGED")
    previous = json.loads(previous_root.read_text())
    for name, expected in previous["fileHashes"].items():
        ensure(sha(PRIOR / name) == expected, "PREVIOUS_PACKET_CHANGED_" + name)
    fresh("PREVIOUS_FAILED_PACKET_BINDING.json", {
        "rootPath": str(previous_root), "rootSha256": sha(previous_root),
        "independentVerificationSha256": sha(PRIOR / "LIVE_BOOTSTRAP_INDEPENDENT_VERIFICATION.json"),
        "previousAuthority": "CONSUMED", "previousResidualState": "ZERO",
        "previousCostEstimateCAD": "1.3567668",
        "borrowedCodeHashes": {str(path): sha(path) for path in
                              [PRIOR / (name + ".py") for name in ("preflight", "validation", "live", "bind_execution", "test_live")]}})
    (HERE / "infra").mkdir(exist_ok=True)
    for name in ("main", "transport", "vm"):
        target = HERE / "infra" / (name + ".bicep")
        ensure(not target.exists(), "LOCAL_INPUT_COLLISION")
        shutil.copyfile(PRIOR / "infra" / (name + ".bicep"), target)
    p.main()
    old_absent = p.read("PREVIOUS_RG_ABSENCE.json", ["group", "exists", "--name",
                        "nzila-g3-firstbyte-6e4441c8ec-rg", "--subscription", p.SUB])
    ensure(old_absent is False, "PREVIOUS_RG_RESIDUAL")
    bins = json.loads((PRIOR / "PROBE_BINARIES.json").read_text())
    for item in bins["binaries"].values():
        source = Path(item["path"])
        ensure(sha(source) == item["sha256"] and source.stat().st_size == item["bytes"], "FROZEN_BINARY_CHANGED")
        target = HERE / source.name
        shutil.copyfile(source, target)
        item["path"] = str(target)
    fresh("PROBE_BINARIES.json", bins)
    fresh("PROBE_REUSE_BINDING.json", {
        "rebuilds": 0, "sourceAndToolchainBinding": str(PRIOR / "PROBE_TOOLCHAIN_BINDING.json"),
        "sourceAndToolchainBindingSha256": sha(PRIOR / "PROBE_TOOLCHAIN_BINDING.json"),
        "binaryEvidenceSha256": sha(PRIOR / "PROBE_BINARIES.json")})
    cost = json.loads((PRIOR / "CURRENT_COST_GATE.json").read_text())
    model = json.loads(Path(cost["capturedMeterModel"]).read_text())
    ensure(sha(Path(cost["capturedMeterModel"])) == cost["modelSha256"], "COST_MODEL_CHANGED")
    for item in model["rates"].values():
        ensure(sha(Path(item["source"])) == item["sourceSha256"], "METER_SOURCE_CHANGED")
    ensure(sum(Decimal(x) for x in model["amountsCAD"].values()) == Decimal("1.5363953") and
           Decimal("1.5363953") * Decimal("1.5") < Decimal("3"), "CAD3_GATE")
    cost["retrySeparateFromPreviousCostCAD"] = "1.3567668"
    cost["refreshedUTC"] = datetime.now(timezone.utc).isoformat()
    fresh("CURRENT_COST_GATE.json", cost)
    network = p.read("NETWORK_USAGE.json", ["rest", "--method", "get", "--url",
                     "https://management.azure.com/subscriptions/" + p.SUB +
                     "/providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01"])
    for name, delta in (("VirtualNetworks", 1), ("NetworkInterfaces", 2), ("NetworkSecurityGroups", 1),
                        ("PrivateEndpoints", 1)):
        matches = [item for item in network["value"] if item["name"]["value"].lower() == name.lower()]
        ensure(len(matches) == 1 and int(matches[0]["currentValue"]) + delta <= int(matches[0]["limit"]),
               "NETWORK_QUOTA_UNPROVEN_" + name)
    print("RETRY_READ_ONLY_PREPARATION_PASS", flush=True)


class RetryProof(live.Proof):
    def consume(self):
        binding = load("PREVIOUS_FAILED_PACKET_BINDING.json")
        ensure(binding["rootSha256"] == "4ea8368db85b45ca3f33e0bdb91a40f9b10b350f5f1646ed5f9ec3b1c131a9d1",
               "PREVIOUS_ROOT_BINDING_CHANGED")
        ensure(sha(Path(binding["rootPath"])) == binding["rootSha256"], "PREVIOUS_ROOT_CHANGED")
        for name, expected in binding["borrowedCodeHashes"].items():
            ensure(sha(Path(name)) == expected, "BORROWED_CODE_CHANGED")
        ensure(load("PUBLISHED_HANDLER_BINDING.json")["CSE_2_1_FAMILY_AVAILABLE"] == "YES", "FAMILY_ABSENT")
        super().consume()

    def execute(self):
        fresh("CONCURRENCY_VM_CSE_WRITE.json", baseline())
        params = load("PROOF_PARAMETERS.json")["parameters"]
        vmparams = {name: {"value": value} for name, value in {
            "suffix": self.suffix, "provisioningSshPublicKey": load("INTERACTIVE_ACCESS_CONTRACT.json")["publicKey"],
            "identityId": self.bindings["identityId"], "subnetId": self.bindings["subnetId"],
            "nsgId": self.bindings["nsgId"], "tags": params["tags"]["value"]}.items()}
        fresh("VM_PARAMETERS.json", {"parameters": vmparams})
        import time
        self.vm_start = time.monotonic()
        self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-vm",
                  "--template-file", str(HERE / "infra" / "vm.json"),
                  "--parameters", "@" + str(HERE / "VM_PARAMETERS.json")], "CREATE_VM", mutation=True)
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-vm"], "VM_CREATION_OPERATIONS")
        vm = self.cli(["vm", "show", "--resource-group", self.rg, "--name", self.prefix + "-vm"], "PROOF_VM_MODEL")
        ensure(vm["identity"]["type"] == "UserAssigned" and
               list(vm["identity"]["userAssignedIdentities"]) == [self.bindings["identityId"]], "VM_IDENTITY_BOUNDARY")
        nic = self.cli(["network", "nic", "show", "--resource-group", self.rg,
                       "--name", self.prefix + "-vm-nic"], "PROOF_VM_NIC")
        ensure(all(not x.get("publicIPAddress") for x in nic["ipConfigurations"]), "VM_PUBLIC_IP")
        url = "https://" + self.bindings["blobHost"] + "/bootstrap-proof/g3a-bootstrap-proof?" + urlencode({"versionid": self.v1_version})
        cseparams = {name: {"value": value} for name, value in {
            "vmName": self.prefix + "-vm", "blobVersionUri": url,
            "readerClientId": self.bindings["identityClientId"], "tags": params["tags"]["value"]}.items()}
        fresh("CSE_PARAMETERS.json", {"parameters": cseparams})
        fresh("CSE_SETTINGS_EVIDENCE.json", {
            "publicSettings": {"skipDos2Unix": True},
            "protectedSettings": {"fileUris": [url], "managedIdentity": {"clientId": self.bindings["identityClientId"]},
                                  "commandToExecute": "./g3a-bootstrap-proof"},
            "handlerSelector": "2.1", "autoUpgradeMinorVersion": False, "enableAutomaticUpgrade": False})
        ensure(self.lockdown == "PASS" and self.cse_count == 0, "CSE_NOT_ALLOWED")
        ensure(load("BLOB_VERSION_DISCRIMINATOR.json")["unversionedCurrentIsV2"], "CURRENT_V2_NOT_BOUND")
        fresh("CSE_EXECUTION_CONSUMED.json", {"maxExecutions": 1, "authoritySha256": self.authority["sha256"]})
        self.cse_count += 1
        self.terminal = "HANDLER_DEPLOYMENT_FAILURE"
        try:
            self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-once",
                      "--template-file", str(HERE / "infra" / "cse.json"),
                      "--parameters", "@" + str(HERE / "CSE_PARAMETERS.json")],
                     "ONE_CSE_EXECUTION", mutation=True, timeout=1200)
        except RuntimeError:
            self.event("CSE_DEPLOYMENT_NONZERO_OBSERVE_TERMINAL_NO_RETRY")
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-once"], "CSE_CREATION_OPERATIONS")
        view = self.cli(["vm", "extension", "show", "--resource-group", self.rg, "--vm-name", self.prefix + "-vm",
                         "--name", "g3-firstbyte-once", "--instance-view"], "CSE_TERMINAL_INSTANCE_VIEW")
        instance = view["instanceView"]
        observed = instance.get("typeHandlerVersion")
        effective = effective_handler(observed)
        fresh("EFFECTIVE_HANDLER_VERSION.json", {
            "CSE_HANDLER_SELECTOR": "2.1", "instanceViewVersion": observed,
            "CSE_EFFECTIVE_HANDLER_VERSION": effective, "packageByteIdentity": "NOT_CLAIMED"})
        self.terminal = "CSE_FAILURE_OTHER"
        terminal = [x for x in instance["statuses"] if x["code"] in ("ProvisioningState/succeeded", "ProvisioningState/failed")]
        ensure(len(terminal) == 1, "CSE_NOT_TERMINAL_NO_RETRY")
        message = terminal[0].get("message", "")
        bins = load("PROBE_BINARIES.json")["binaries"]
        self.terminal = live.classify_status(message, bins["V1"]["sha256"], bins["V2"]["sha256"],
                                            terminal[0]["code"] == "ProvisioningState/succeeded")
        fresh("CSE_VERSION_SELECTION_RESULT.json", {
            "classification": self.terminal, "CSE_VERSIONID_SELECTION": self.terminal,
            "effectiveHandler": effective, "terminalCode": terminal[0]["code"],
            "requestedV1MarkerObserved": "G3A_BOOTSTRAP_REQUESTED_V1" in message,
            "currentV2MarkerObserved": "G3A_BOOTSTRAP_CURRENT_V2" in message,
            "reportedSelfHashes": re.findall(r"SELF_SHA256=([0-9a-f]{64})", message),
            "publicStorageDisabledDuringConsumption": True, "requestedVersionId": self.v1_version,
            "retryCount": 0, "CSEDeploymentAttempts": self.cse_count})


if __name__ == "__main__":
    ensure(len(sys.argv) == 2, "PHASE_REQUIRED")
    phase = sys.argv[1]
    if phase == "prepare":
        prepare()
    elif phase == "validate":
        v.main()
    elif phase == "bind":
        import io
        import unittest
        sys.path.insert(0, str(HERE))
        stream = io.StringIO()
        suite = unittest.defaultTestLoader.loadTestsFromNames(["test_live", "test_retry"])
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
        fresh("RETRY_CONTRACT_TESTS.json", {
            "testCount": result.testsRun, "status": "PASS" if result.wasSuccessful() else "FAIL",
            "output": stream.getvalue(), "cloudMutations": 0})
        ensure(result.wasSuccessful() and result.testsRun == 8, "RETRY_CONTRACT_TESTS_FAILED")
        b.main()
    elif phase == "execute":
        RetryProof().run()
    else:
        raise RuntimeError("UNKNOWN_PHASE")
