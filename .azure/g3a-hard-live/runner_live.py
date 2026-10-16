"""Bind the existing unconsumed runner authority to the preserved private proof."""

from datetime import datetime, timezone
from decimal import Decimal
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
import unittest
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / "g3a-isolation-live"))
import isolation_live as historical

ORIGINAL_AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4"
    r"\attachments\d6d4d510-faf4-4b3e-90eb-fe57eff9cb77\Pasted text #1.txt")
AUTHORITY = Path(
    r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4"
    r"\attachments\3d123728-29e5-4f5e-9862-5ca634b7275f\Pasted text #1.txt")
ARTIFACTS = BASE / "g3a-hard-runner-delivery"
historical.HERE = HERE
for module in (historical.ca, historical.ca.retry, historical.ca.retry.p,
               historical.ca.retry.v, historical.ca.retry.live, historical.ca.retry.b):
    module.HERE = HERE
    module.AUTHORITY = ORIGINAL_AUTHORITY
historical.ca.refresh.HERE = HERE
historical.ca.refresh.PACKAGE = HERE
fresh, ensure, sha, baseline = historical.fresh, historical.ensure, historical.sha, historical.baseline


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def read(name):
    return load(HERE / name)


def verify_offline():
    original = load(BASE / "g3a-runner-amendment/AUTHORITY_BINDING.json")
    ensure(sha(ORIGINAL_AUTHORITY) == original["authoritySha256"] ==
           "078fd2be70823959cf4e71498646eaecdfaa40f49295e8017fb1e58b0d655f3b" and
           original["consumed"] is False, "EXISTING_RUNNER_AUTHORITY_CHANGED")
    ensure(sha(AUTHORITY) == "ca7a0e271aa39156911d9c20e8509106b5d2b1f02a958b4260fa6b492a3ad18f",
           "CAPACITY_AMENDMENT_CHANGED")
    ensure(load(BASE / "g3a-hard-capacity/OFFLINE_QUALIFICATION.json")[
        "PRODUCTION_RUNNER_OFFLINE_QUALIFICATION"] == "PASS", "OFFLINE_RUNNER_NOT_PASS")
    candidate = load(BASE / "g3a-hard-capacity/PARENT_FINAL_CANDIDATE_CHECKS.json")
    ensure(candidate["status"] == "PASS" and candidate["runnerSHA256"] ==
           "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273",
           "PARENT_FINAL_CANDIDATE_NOT_VERIFIED")
    for relative in ("g3a-runner-amendment/AUTHORITY_CONSUMED.json",
                     "g3a-runner-amendment/PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED.json",
                     "g3a-hard-live/PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED.json"):
        ensure(not (BASE / relative).exists(), "EXISTING_RUNNER_LIVE_AUTHORITY_ALREADY_CONSUMED")
    return candidate


def prepare():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    candidate = verify_offline()
    fresh("EXISTING_RUNNER_AUTHORITY_BINDING.json", {
        "mission": "NZ-20261008-INFRA-001", "originalAuthorityPath": str(ORIGINAL_AUTHORITY),
        "originalAuthoritySHA256": sha(ORIGINAL_AUTHORITY), "amendmentPath": str(AUTHORITY),
        "amendmentSHA256": sha(AUTHORITY), "newLiveAuthority": False,
        "maximumLiveAttempts": 1, "consumedAt": "FIRST_AZURE_MUTATING_DISPATCH",
        "sameUnconsumedOriginalAuthority": True, "productionFutureAuthorityIssued": False,
        "candidate": candidate["runnerSHA256"],
        "protectedFileHashes": original_protected(),
    })
    (HERE / "infra").mkdir(exist_ok=True)
    for name in ("main", "transport", "vm", "cse"):
        shutil.copyfile(BASE / "g3a-isolation-live/infra" / (name + ".bicep"),
                        HERE / "infra" / (name + ".bicep"))
    historical.ca.retry.p.main()
    ensure(read("PRINCIPAL.json")["value"]["id"] ==
           "fcb34d85-3e87-4213-9fc4-435656b17f44", "PRINCIPAL_CHANGED")
    historical.ca.refresh.PACKAGE = BASE / "g3a-bootstrap-retry"
    historical.ca.refresh.cost()
    historical.ca.refresh.PACKAGE = HERE
    cost = expanded_cost(load(BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json"))
    fresh("CURRENT_COST_GATE.json", cost)
    print("READ_ONLY_PREPARE_PASS_EXISTING_AUTHORITY_UNCONSUMED")


def original_protected():
    binding = load(BASE / "g3a-hard-capacity/AUTHORITY_BINDING.json")
    for name, expected in binding["protectedFileHashes"].items():
        ensure(sha(Path(name)) == expected, "PROTECTED_HISTORY_CHANGED_" + name)
    return binding["protectedFileHashes"]


def expanded_cost(model):
    amounts = {name: Decimal(value) for name, value in model["amountsCAD"].items()}
    for old, new, multiplier in (
        ("diskOperations100000", "diskOperations1000000", 10),
        ("blobStorage0_1GBConservativeFullMonth", "blobStorage1GBConservativeFullMonth", 10),
        ("privateLinkIngress0_1GB", "privateLinkIngress1GB", 10),
        ("privateLinkEgress0_1GB", "privateLinkEgress1GB", 10),
        ("conservativeTransfer0_1GB", "conservativeTransfer1GB", 10),
    ):
        ensure(old in amounts, "COST_MODEL_COMPONENT_UNBOUND_" + old)
        amounts[new] = amounts.pop(old) * multiplier
    total = sum(amounts.values())
    ensure(total * Decimal("1.5") <= Decimal("3.00"), "PAYLOAD_COST_EXCEEDS_CAD3_WITH_CONTINGENCY")
    return {
        "conservativeExpectedCAD": str(total), "expectedWith50PercentContingencyCAD": str(total * Decimal("1.5")),
        "hardCeilingCAD": "3.00", "currency": "CAD",
        "modelSha256": sha(BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json"),
        "refreshedRatesGate": "REFRESHED_COST_GATE.json", "maxProofHours": 4, "maxVMHours": 2,
        "maxPEHours": 4, "amountsCAD": {name: str(value) for name, value in amounts.items()},
        "deliveryBytesMaximum": 350000000, "StorageGBMonthsMaximum": "1",
        "readBytesUpperBound": 1000000000, "writeBytesUpperBound": 1000000000,
        "diskOperationsUpperBound": 1000000,
        "tmpfsSeparatelyBilledStorage": False, "budgetExpansion": False,
        "scope": "One harmless proof, not full G3A build; exact delivery bytes must pass binding.",
    }


def binding():
    ensure(sha(ARTIFACTS / "PARENT_DELIVERY_REPORT.json") ==
           "4b16acf6f31f513a705afabd8eb3159fa91dae458136655afaeafaddbd82f50a",
           "DELIVERY_REPORT_CHANGED")
    ensure(sha(ARTIFACTS / "ARTIFACT_BINDING.json") ==
           "985c5a41edeb91eddd04816bb81d18f702f3b329978fdf631e8f4834fee7aec6",
           "DELIVERY_BINDING_CHANGED")
    report = load(ARTIFACTS / "PARENT_DELIVERY_REPORT.json")
    for item in report["completeSourceChanges"]:
        path = ARTIFACTS / item["name"]
        ensure(sha(path) == item["sha256"] and path.stat().st_size == item["bytes"],
               "BOUND_DELIVERY_SOURCE_CHANGED_" + item["name"])
    bound = load(ARTIFACTS / "ARTIFACT_BINDING.json")
    ensure(bound["candidate"]["candidateSha256"] ==
           "9889228f05e27a95593ba02e44e54127985175d4748bf98e0c6600bb662d1273" and
           bound["productionExecutionAuthorityDigest"] == "" and
           not bound["futureAuthorityIssued"] and bound["frozenCoreInvocations"] == 0,
           "DELIVERY_SCOPE_CHANGED")
    for item in bound["objects"]:
        path = Path(item["localFile"])
        ensure(sha(path) == item["sha256"] and path.stat().st_size == item["bytes"],
               "BOUND_DELIVERY_OBJECT_CHANGED_" + item["name"])
    ensure(len(bound["objects"]) == 2 and
           sum(x["bytes"] for x in bound["objects"]) <= read("CURRENT_COST_GATE.json")["deliveryBytesMaximum"],
           "DELIVERY_OUTSIDE_REFRESHED_COST_BOUND")
    return bound


def bind_artifacts():
    fresh("CONCURRENCY_BIND_ARTIFACTS.json", baseline())
    verify_offline()
    bound = binding()
    result = subprocess.run(
        [sys.executable, "-B", "-m", "unittest", "test_delivery_evidence", "-v"],
        cwd=ARTIFACTS, capture_output=True, text=True, timeout=120)
    fresh("PARENT_DELIVERY_PARSER_TESTS.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
        "scope": "LOCAL_ONLY_PORTABLE_PARSER_TESTS_NOT_GUEST_EVIDENCE",
    })
    ensure(result.returncode == 0, "PARENT_DELIVERY_PARSER_FAILED")
    objects = [{**item, "path": item["localFile"], "role": role}
               for item, role in zip(bound["objects"], ("handoff", "capsule"))]
    fresh("PROOF_ARTIFACTS.json", {
        "objects": objects, "bindingPath": str(ARTIFACTS / "ARTIFACT_BINDING.json"),
        "bindingSha256": sha(ARTIFACTS / "ARTIFACT_BINDING.json"),
        "candidateSourceSha256": bound["sourceCandidateSha256"],
        "productionTransactionDisabled": True, "bundleIsNotRunnerBinary": True,
    })
    template = HERE / "infra/cse.bicep"
    text = template.read_text()
    ensure(text.count("param tags object") == 1 and
           text.count("commandToExecute: './g3a-handoff ./g3a-proof-capsule'") == 1,
           "PRESERVED_CSE_TEMPLATE_CHANGED")
    text = text.replace("param tags object", "param tags object\nparam boundCommand string")
    text = text.replace("commandToExecute: './g3a-handoff ./g3a-proof-capsule'",
                        "commandToExecute: boundCommand")
    with (HERE / "infra/cse-final.bicep").open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(text)
    result = subprocess.run(
        [historical.ca.retry.v.BICEP, "build", str(HERE / "infra/cse-final.bicep")],
        capture_output=True, text=True, timeout=120)
    fresh("FINAL_CSE_LOCAL_VALIDATION.json", {
        "exitCode": result.returncode, "stdout": result.stdout, "stderr": result.stderr,
        "templateSHA256": sha(HERE / "infra/cse-final.json") if result.returncode == 0 else None,
        "selector": "2.1", "exactCommandSHA256": bound["cseCommandSha256"],
    })
    ensure(result.returncode == 0 and not result.stderr.strip(), "FINAL_CSE_BUILD_OR_LINT_FAILED")
    fresh("G3A_PRIVATE_INPUT_CENSUS.json", {
        **bound["privateInputCategories"], "twoObjectTransferBytes": bound["twoObjectTransferBytes"],
        "categoryDefinition": bound["categoryDefinition"],
        "bindingSHA256": sha(ARTIFACTS / "ARTIFACT_BINDING.json"), "estimates": False,
    })
    print("EXACT_TWO_OBJECT_DELIVERY_BOUND")


def verify_artifacts():
    binding()
    evidence = read("PROOF_ARTIFACTS.json")
    ensure(sha(Path(evidence["bindingPath"])) == evidence["bindingSha256"], "PROOF_DELIVERY_DRIFT")
    return evidence


def delivery_module(name):
    sys.path.insert(0, str(ARTIFACTS))
    spec = importlib.util.spec_from_file_location("hard_delivery_" + name, ARTIFACTS / (name + ".py"))
    ensure(spec and spec.loader, "DELIVERY_MODULE_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RunnerProof(historical.IsolationProof):
    def consume(self):
        verify_offline()
        verify_artifacts()
        packet = read("RUNNER_PROOF_BINDING.json")
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(packet["UTC"])).total_seconds()
        ensure(0 <= age <= 1800, "FRESH_RUNNER_BINDING_EXPIRED")
        for path, expected in packet["artifactHashes"].items():
            ensure(sha(Path(path)) == expected, "RUNNER_BOUND_ARTIFACT_DRIFT")
        ensure(packet["executionBindingSHA256"] == sha(HERE / "EXECUTION_BINDING.json"),
               "RUNNER_EXECUTION_BINDING_CHANGED")
        ensure(read("LOCAL_TESTS.json")["status"] == "PASS", "RUNNER_CONTROLLER_TESTS_FAILED")
        historical.ca.retry.live.Proof.consume(self)

    def cli(self, args, label, mutation=False, **kwargs):
        if mutation and not (HERE / "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED.json").exists():
            ensure(label == "CREATE_TRANSPORT", "UNEXPECTED_FIRST_RUNNER_MUTATION")
            fresh("PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED.json", {
                "PRODUCTION_RUNNER_PROOF_AUTHORITY_CONSUMED": "YES",
                "originalAuthoritySHA256": sha(ORIGINAL_AUTHORITY),
                "amendmentSHA256": sha(AUTHORITY), "firstDispatchLabel": label,
                "maxAttempts": 1, "UTC": datetime.now(timezone.utc).isoformat(),
            })
        return super().cli(args, label, mutation=mutation, **kwargs)

    def retain_guest_evidence(self, message, compact, contract):
        ensure(not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists(), "SECOND_DIAGNOSTIC_PROHIBITED")
        transport = delivery_module("evidence_transport")
        script = transport.diagnostic_script()
        ensure(script.encode() == Path(contract["diagnosticFile"]).read_bytes(),
               "FIXED_DIAGNOSTIC_SCRIPT_CHANGED")
        fresh("DIAGNOSTIC_ACTION_CONSUMED.json", {
            "maxActions": 1, "readOnly": True, "diagnosticSHA256": contract["diagnosticSha256"],
            "reason": "FULL_ACTUAL_GUEST_STRUCTURED_EVIDENCE_REQUIRED", "noRepairOrRetry": True,
        })
        result = self.cli(
            ["vm", "run-command", "invoke", "--resource-group", self.rg,
             "--name", self.prefix + "-vm", "--command-id", "RunShellScript",
             "--scripts", "@" + contract["diagnosticFile"]],
            "ONE_READ_ONLY_DIAGNOSTIC_ACTION", mutation=True, timeout=600)
        text = "\n".join(item.get("message", "") for item in result.get("value", []))
        fresh("DIAGNOSTIC_CAPTURE.json", {"safeOutput": text, "type": "FULL_EXACT_DELIVERY_EVIDENCE"})
        envelope = {"message": message, **transport.decode(text)}
        fresh("LIVE_EXACT_EVIDENCE.json", envelope)
        verified = delivery_module("result_parser").parse(envelope)
        ensure(verified["evidenceComplete"] and not verified["diagnosticRequired"],
               "LIVE_EXACT_RUNNER_EVIDENCE_INCOMPLETE")
        return verified

    def execute_once(self):
        fresh("CONCURRENCY_VM_CSE.json", baseline())
        ensure(read("WRITE_ONCE_RESULT.json")["status"] == "PASS" and self.writer_deleted and
               self.lockdown == "PASS", "PRIVATE_RUNNER_CONSUMPTION_PRECONDITION")
        tags = read("PROOF_PARAMETERS.json")["parameters"]["tags"]["value"]
        values = {
            "suffix": self.suffix,
            "provisioningSshPublicKey": read("INTERACTIVE_ACCESS_CONTRACT.json")["publicKey"],
            "identityId": self.bindings["identityId"], "subnetId": self.bindings["subnetId"],
            "nsgId": self.bindings["nsgId"], "tags": tags,
        }
        fresh("VM_PARAMETERS.json", {"parameters": {name: {"value": value} for name, value in values.items()}})
        self.vm_start = time.monotonic()
        self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-vm",
                  "--template-file", str(HERE / "infra/vm.json"),
                  "--parameters", "@" + str(HERE / "VM_PARAMETERS.json")], "CREATE_VM", mutation=True)
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-vm"], "VM_CREATION_OPERATIONS")
        vm = self.cli(["vm", "show", "--resource-group", self.rg,
                       "--name", self.prefix + "-vm"], "PROOF_VM_MODEL")
        ensure(vm["identity"]["type"] == "UserAssigned" and
               list(vm["identity"]["userAssignedIdentities"]) == [self.bindings["identityId"]],
               "RUNNER_VM_IDENTITY_BOUNDARY")
        nic = self.cli(["network", "nic", "show", "--resource-group", self.rg,
                        "--name", self.prefix + "-vm-nic"], "PROOF_VM_NIC")
        ensure(all(not item.get("publicIPAddress") for item in nic["ipConfigurations"]), "RUNNER_PUBLIC_VM_IP")
        items = read("PROOF_ARTIFACTS.json")["objects"]
        host = "https://" + self.bindings["blobHost"] + "/bootstrap-proof/"
        contract = binding()
        values = {
            "vmName": self.prefix + "-vm", "handoffUri": host + items[0]["objectPath"],
            "capsuleUri": host + items[1]["objectPath"], "readerClientId": self.bindings["identityClientId"],
            "tags": tags, "boundCommand": contract["cseCommand"],
        }
        fresh("CSE_PARAMETERS.json", {"parameters": {name: {"value": value} for name, value in values.items()}})
        ensure(self.cse_count == 0 and not (HERE / "CSE_EXECUTION_CONSUMED.json").exists(),
               "SECOND_RUNNER_CSE_PROHIBITED")
        fresh("CSE_EXECUTION_CONSUMED.json", {"maxExecutions": 1, "authoritySha256": sha(ORIGINAL_AUTHORITY),
                                            "candidateSHA256": contract["candidate"]["candidateSha256"]})
        self.cse_count += 1
        self.terminal = "RUNNER_PROOF_FAILED"
        try:
            self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-once",
                      "--template-file", str(HERE / "infra/cse-final.json"),
                      "--parameters", "@" + str(HERE / "CSE_PARAMETERS.json")],
                     "ONE_CSE_EXECUTION", mutation=True, timeout=1200)
        except RuntimeError:
            self.event("CSE_NONZERO_OBSERVE_NO_RETRY")
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-once"], "CSE_CREATION_OPERATIONS")
        view = self.cli(["vm", "extension", "show", "--resource-group", self.rg,
                        "--vm-name", self.prefix + "-vm", "--name", "g3-firstbyte-once",
                        "--instance-view"], "CSE_TERMINAL_INSTANCE_VIEW")
        state = historical.ca.parse_terminal(view["instanceView"]["statuses"])
        effective = historical.ca.retry.effective_handler(view["instanceView"].get("typeHandlerVersion"))
        message = next(item.get("message", "") for item in view["instanceView"]["statuses"]
                       if item["code"] == state["code"])
        parsed = delivery_module("result_parser").parse(message)
        if parsed["diagnosticRequired"]:
            parsed = self.retain_guest_evidence(message, parsed, contract)
        fresh("GUEST_PROOF_RESULT.json", {
            **parsed, "effectiveHandler": effective, "terminalCode": state["code"],
            "extensionSucceeded": state["state"] == "succeeded",
        })
        self.terminal = "PROVEN" if parsed["allPassed"] and state["state"] == "succeeded" else "RUNNER_PROOF_FAILED"


historical.verify_artifacts = verify_artifacts


def seal_dispatch():
    fresh("CONCURRENCY_FRESH_DISPATCH_BINDING.json", baseline())
    verify_offline()
    bound = binding()
    ensure(read(".azure/validate-status.json")["completedStep"] == "UpdateStatus",
           "VALIDATION_WORKFLOW_INCOMPLETE")
    ensure(not (HERE / "AUTHORITY_CONSUMED.json").exists() and not list(HERE.glob("EVENT_*.json")),
           "UNEXPECTED_PARTIAL_LIVE_EXECUTION")
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromName("test_runner_live"))
    fresh("LOCAL_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
                              "testCount": result.testsRun, "output": stream.getvalue(), "AzureCalls": 0})
    ensure(result.wasSuccessful(), "OWNED_RUNNER_CONTROLLER_TESTS_FAILED")
    historical.ca.refresh.safety()
    image = historical.ca.refresh.read("IMMEDIATE_IMAGE", ["vm", "image", "show",
        "--urn", historical.ca.retry.p.IMAGE, "--location", "canadacentral",
        "--subscription", historical.ca.retry.p.SUB])
    ensure(image["architecture"].lower() == "x64", "PINNED_IMAGE_CHANGED")
    storage = historical.ca.refresh.read("IMMEDIATE_STORAGE_NAME", [
        "storage", "account", "check-name", "--name", "nzilag3fb" + read("AUTHORITY_BINDING.json")["suffix"]])
    ensure(storage["nameAvailable"], "PROOF_STORAGE_NAME_COLLISION")
    accounts = historical.ca.refresh.read("IMMEDIATE_STORAGE_CAPACITY", [
        "storage", "account", "list", "--subscription", historical.ca.retry.p.SUB,
        "--query", "[?location=='canadacentral'].id"])
    ensure(len(accounts) + 1 <= 250, "STORAGE_CAPACITY_BOUND")
    network = historical.ca.refresh.read("IMMEDIATE_NETWORK_USAGE", [
        "rest", "--method", "get", "--url",
        "https://management.azure.com/subscriptions/" + historical.ca.retry.p.SUB +
        "/providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01"])
    for name, delta in (("VirtualNetworks", 1), ("NetworkInterfaces", 2),
                        ("NetworkSecurityGroups", 1), ("PrivateEndpoints", 1)):
        matched = [item for item in network["value"] if item["name"]["value"].lower() == name.lower()]
        ensure(len(matched) == 1 and int(matched[0]["currentValue"]) + delta <= int(matched[0]["limit"]),
               "NETWORK_QUOTA_" + name)
    with urlopen("https://api.ipify.org", timeout=30) as response:
        public_ip = response.read().decode().strip()
    ensure(public_ip == read("PROOF_PARAMETERS.json")["parameters"]["producerIPv4"]["value"],
           "STAGING_PRODUCER_IP_CHANGED")
    ensure(not Path(read("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]).exists(),
           "PROVISIONING_PRIVATE_KEY_PRESENT")
    historical.ca.refresh.PACKAGE = BASE / "g3a-bootstrap-retry"
    historical.ca.refresh.cost()
    historical.ca.refresh.PACKAGE = HERE
    fresh("IMMEDIATE_PROOF_COST_GATE.json",
          expanded_cost(load(BASE / "g3a-firstbyte/BOOTSTRAP_PROOF_COST_MODEL.json")))
    ensure(read("IMMEDIATE_PROOF_COST_GATE.json")["conservativeExpectedCAD"] ==
           read("CURRENT_COST_GATE.json")["conservativeExpectedCAD"], "EXACT_COST_CHANGED")
    files = [*HERE.glob("*.py"), *(HERE / "infra").glob("*")]
    for name in ("PROOF_PARAMETERS.json", "CURRENT_COST_GATE.json", "PROOF_ARTIFACTS.json",
                 "EXISTING_RUNNER_AUTHORITY_BINDING.json", "INTERACTIVE_ACCESS_CONTRACT.json",
                 "PUBLISHED_HANDLER_BINDING.json", "LOCAL_TESTS.json"):
        files.append(HERE / name)
    fresh("EXECUTION_BINDING.json", {
        "authoritySha256": sha(ORIGINAL_AUTHORITY),
        "fileHashes": {str(path.relative_to(HERE)): sha(path) for path in files},
    })
    artifact_paths = [Path(item["localFile"]) for item in bound["objects"]]
    artifact_paths.extend(ARTIFACTS / item["name"] for item in
                          load(ARTIFACTS / "PARENT_DELIVERY_REPORT.json")["completeSourceChanges"])
    artifact_paths.extend([ARTIFACTS / "ARTIFACT_BINDING.json", ARTIFACTS / "PARENT_DELIVERY_REPORT.json",
                           BASE / "g3a-hard-capacity/OFFLINE_QUALIFICATION.json",
                           BASE / "g3a-hard-capacity/PARENT_FINAL_CANDIDATE_CHECKS.json"])
    fresh("RUNNER_PROOF_BINDING.json", {
        "status": "SEALED", "sameUnconsumedAuthority": True,
        "originalAuthoritySHA256": sha(ORIGINAL_AUTHORITY), "amendmentSHA256": sha(AUTHORITY),
        "candidateSHA256": bound["candidate"]["candidateSha256"],
        "candidateBytes": bound["candidate"]["candidateBytes"],
        "artifactHashes": {str(path): sha(path) for path in artifact_paths},
        "executionBindingSHA256": sha(HERE / "EXECUTION_BINDING.json"),
        "expectedCAD": read("CURRENT_COST_GATE.json")["conservativeExpectedCAD"],
        "ceilingCAD": "3.00", "maxAttempts": 1, "UTC": datetime.now(timezone.utc).isoformat(),
        "G3A_EXECUTION_AUTHORIZED": "NO", "G3B_EXECUTION_AUTHORIZED": "NO",
    })
    print("RUNNER_PROOF_BINDING=SEALED_EXISTING_AUTHORITY_UNCONSUMED")


if __name__ == "__main__":
    ensure(len(sys.argv) == 2, "ACTION_REQUIRED")
    actions = {"prepare": prepare, "bind-artifacts": bind_artifacts, "seal-dispatch": seal_dispatch,
               "execute": lambda: RunnerProof().run()}
    ensure(sys.argv[1] in actions, "UNSUPPORTED_ACTION")
    actions[sys.argv[1]]()
