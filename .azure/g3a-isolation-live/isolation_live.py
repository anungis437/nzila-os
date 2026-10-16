"""One amended authority, two write-once artifacts, one CSE, owned cleanup."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import time
from urllib.request import urlopen
import evidence_transport

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
ARTIFACTS = BASE / "g3a-isolation-artifacts"
ORIGINAL_AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\e5fc87c5-653e-425d-bc23-004a10240c4a\Pasted text #1.txt")
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\9b96285d-c12b-4504-b760-08826bdd0064\Pasted text #1.txt")
sys.path.insert(0, str(BASE / "g3a-ca-live"))
import proof as ca

for module in (ca, ca.retry, ca.retry.p, ca.retry.v, ca.retry.live, ca.retry.b):
    module.HERE = HERE
    module.AUTHORITY = AUTHORITY
ca.refresh.HERE = HERE
ca.refresh.PACKAGE = HERE
fresh, ensure, sha, baseline = ca.fresh, ca.ensure, ca.sha, ca.baseline


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def read(name):
    return load(HERE / name)


def historical():
    root_path = BASE / "g3a-capsule-offline" / "OFFLINE_VERIFICATION.json"
    ensure(sha(root_path) == "ec22b7bbcb7c81f78701be704ef732c8240ed5223111e24cf30ac0ddbf22bb35",
           "HISTORICAL_OFFLINE_ROOT_CHANGED")
    for name, expected in load(root_path)["fileHashes"].items():
        ensure(sha(root_path.parent / name) == expected, "HISTORICAL_CANDIDATE_PACKET_CHANGED_" + name)
    path = root_path.parent / "g3a-guest-candidate"
    ensure(sha(path) == "b41226ceb1488a68f18e013faa4dab7a13a2d8d55a582579b7dc9a601cb738b2" and
           path.stat().st_size == 25800828, "HISTORICAL_CANDIDATE_CHANGED")


def prepare():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    historical()
    fresh("AUTHORITY_AMENDMENT.json", {
        "sameUnconsumedAuthority": True, "originalPath": str(ORIGINAL_AUTHORITY),
        "originalSha256": sha(ORIGINAL_AUTHORITY), "amendedPath": str(AUTHORITY),
        "amendedSha256": sha(AUTHORITY), "maxLiveAttempts": 1,
        "historicalCandidateUnchanged": True,
        "borrowedCodeHashes": {str(path): sha(path) for path in [
            BASE / "g3a-ca-live" / "proof.py",
            BASE / "g3a-bootstrap-retry" / "retry.py",
            *[BASE / "g3a-live-bootstrap" / (name + ".py")
              for name in ("preflight", "validation", "live", "bind_execution")],
            BASE / "g3a-bootstrap-resume" / "refresh.py",
            BASE / "g3a-content-addressed" / "status_parser.py"]},
    })
    for name in ("main.bicep", "transport.bicep", "vm.bicep"):
        source = BASE / "g3a-ca-live" / "infra" / name
        ensure(not (HERE / "infra" / name).exists(), "IAC_TARGET_EXISTS")
        shutil.copyfile(source, HERE / "infra" / name)
    ca.retry.p.main()
    ensure(read("PRINCIPAL.json")["value"]["id"] == "fcb34d85-3e87-4213-9fc4-435656b17f44",
           "PRINCIPAL_CHANGED")
    ca.refresh.PACKAGE = BASE / "g3a-bootstrap-retry"
    ca.refresh.cost()
    ca.refresh.PACKAGE = HERE
    cost = read("REFRESHED_COST_GATE.json")
    fresh("CURRENT_COST_GATE.json", {
        "conservativeExpectedCAD": cost["REFRESHED_EXPECTED_COST_CAD"], "hardCeilingCAD": "3.00",
        "modelSha256": cost["priorModelSha256"], "maxProofHours": 4,
        "maxVMHours": 2, "maxPEHours": 4,
        "binaryBytesMaximum": 100000000, "storageGBMonthsMaximum": "0.1",
        "readBytesUpperBound": 100000000, "writeBytesUpperBound": 100000000,
        "diagnostic": "AT_MOST_ONE_WITHIN_VM_LIFETIME",
        "artifactBytesGate": "REQUIRED_BEFORE_BIND",
    })
    network = ca.retry.v.cli("NETWORK_USAGE.json", ["rest", "--method", "get", "--url",
        "https://management.azure.com/subscriptions/" + ca.retry.p.SUB +
        "/providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01"])
    for name, delta in (("VirtualNetworks", 1), ("NetworkInterfaces", 2),
                        ("NetworkSecurityGroups", 1), ("PrivateEndpoints", 1)):
        matches = [x for x in network["value"] if x["name"]["value"].lower() == name.lower()]
        ensure(len(matches) == 1 and int(matches[0]["currentValue"]) + delta <= int(matches[0]["limit"]),
               "NETWORK_QUOTA_" + name)
    print("READ_ONLY_PREPARE_PASS")


def bind_artifacts():
    fresh("CONCURRENCY_ARTIFACT_BIND.json", baseline())
    historical()
    artifact = load(ARTIFACTS / "ARTIFACT_BINDING.json")
    ensure(artifact["offlineQualification"] == "PASS", "ARTIFACT_OFFLINE_NOT_PASS")
    objects = []
    for role, hash_key, byte_key, path_key, name in (
        ("handoff", "shimSha256", "shimBytes", "shimPath", "g3a-handoff"),
        ("capsule", "candidateSha256", "candidateBytes", "candidatePath", "g3a-proof-capsule"),
    ):
        path = Path(artifact[path_key])
        ensure(sha(path) == artifact[hash_key] and path.stat().st_size == artifact[byte_key],
               "ARTIFACT_BINDING_DRIFT_" + role)
        objects.append({"role": role, "sha256": artifact[hash_key], "bytes": artifact[byte_key],
                        "path": str(path), "objectPath": "sha256/" + artifact[hash_key] + "/" + name})
    ensure(sum(x["bytes"] for x in objects) <= 100000000, "COST_PAYLOAD_BOUND")
    fresh("PROOF_ARTIFACTS.json", {"objects": objects, "bindingPath": str(ARTIFACTS / "ARTIFACT_BINDING.json"),
          "bindingSha256": sha(ARTIFACTS / "ARTIFACT_BINDING.json"),
          "candidateSourceSha256": artifact["candidateSourceSha256"],
          "sourceDelta": "ISOLATION_PROOF_ONLY", "productionTransactionDisabled": True})
    print("TWO_CONTENT_ADDRESSED_ARTIFACTS_BOUND")


def verify_artifacts():
    evidence = read("PROOF_ARTIFACTS.json")
    ensure(sha(Path(evidence["bindingPath"])) == evidence["bindingSha256"], "ARTIFACT_PACKET_CHANGED")
    for item in evidence["objects"]:
        path = Path(item["path"])
        ensure(sha(path) == item["sha256"] and path.stat().st_size == item["bytes"], "EXECUTABLE_DRIFT")
    return evidence


def parse_guest(message, contract):
    """Parser is completed against the artifact's exact output contract before sealing."""
    spec = importlib.util.spec_from_file_location("bound_guest_result_parser", ARTIFACTS / contract["parserFile"])
    ensure(spec and spec.loader, "RESULT_PARSER_MODULE")
    parser = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parser)
    return parser.parse(message)


class IsolationProof(ca.ContentProof):
    def retain_guest_evidence(self, message, compact, contract):
        ensure(not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists(), "SECOND_DIAGNOSTIC_PROHIBITED")
        report = load(ARTIFACTS / "PARENT_INTEGRATION_REPORT.json")
        preset = evidence_transport.dictionary(report)
        script = evidence_transport.reader_script(compact["evidenceReference"]["proofFile"], preset)
        with (HERE / "diagnostic.sh").open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(script)
        fresh("DIAGNOSTIC_ACTION_CONSUMED.json", {
            "maxActions": 1, "readOnlyGuestScript": True, "reason": "INSUFFICIENT_FULL_STRUCTURED_EVIDENCE",
            "compressor": "/usr/bin/python3 -I -B -S; existing guest interpreter for diagnostic only",
            "compressorAvailability": "CHECKED_ONCE_IN_DIAGNOSTIC_FAIL_CLOSED",
            "presetDictionarySha256": hashlib.sha256(preset).hexdigest(),
            "dictionaryIsEvidence": False, "maxOutputLineBytes": 3800,
            "guestFiles": ["baseline.json", "proof.json"],
            "noInstallationNetworkWritesFallbackOrRetry": True,
        })
        result = self.cli(["vm", "run-command", "invoke", "--resource-group", self.rg,
                           "--name", self.prefix + "-vm", "--command-id", "RunShellScript",
                           "--scripts", "@" + str(HERE / "diagnostic.sh")],
                          "ONE_READ_ONLY_DIAGNOSTIC_ACTION", mutation=True, timeout=600)
        text = "\n".join(x.get("message", "") for x in result.get("value", []))
        fresh("DIAGNOSTIC_CAPTURE.json", {"safeOutput": text, "type": "EXACT_EVIDENCE_ZDICT",
              "retainsActualGuestBytes": True, "dictionaryIsEvidence": False})
        envelope = {"message": message, **evidence_transport.decode(text, preset)}
        fresh("LIVE_EXACT_EVIDENCE.json", envelope)
        verified = parse_guest(envelope, contract)
        ensure(verified["evidenceComplete"] and not verified["diagnosticRequired"],
               "LIVE_EXACT_EVIDENCE_NOT_COMPLETE")
        return verified

    def consume(self):
        amendment = read("AUTHORITY_AMENDMENT.json")
        ensure(sha(ORIGINAL_AUTHORITY) == amendment["originalSha256"], "ORIGINAL_AUTHORITY_CHANGED")
        for name, expected in amendment["borrowedCodeHashes"].items():
            ensure(sha(Path(name)) == expected, "BORROWED_CODE_CHANGED")
        historical()
        verify_artifacts()
        binding = read("PINNED_GUEST_PROOF_BINDING.json")
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(binding["UTC"])).total_seconds()
        ensure(0 <= age <= 1800, "TIME_SENSITIVE_BINDING_EXPIRED")
        for path, expected in binding["artifactFileHashes"].items():
            ensure(sha(Path(path)) == expected, "SEALED_ARTIFACT_DRIFT")
        ensure(sha(HERE / "EXECUTION_BINDING.json") == binding["executionBindingSha256"],
               "EXECUTION_BINDING_DRIFT")
        ensure(read("LOCAL_TESTS.json")["status"] == "PASS", "CONTROLLER_LOCAL_TESTS")
        ca.retry.live.Proof.consume(self)
        fresh("PINNED_GUEST_AUTHORITY_CONSUMED.json", {
            "PINNED_GUEST_PROOF_AUTHORITY_CONSUMED": "YES",
            "originalAuthoritySha256": amendment["originalSha256"], "amendedAuthoritySha256": sha(AUTHORITY),
            "oneRemainingAttemptNowConsumed": True, "maximumCSEExecutions": 1,
        })

    def stage(self):
        verify_artifacts()
        token = self.storage_token()
        results = []
        try:
            deadline = time.monotonic() + 600
            while True:
                status, _, _ = self.blob("HEAD", token, container=True)
                if status == 200:
                    break
                ensure(status == 403 and time.monotonic() < deadline, "PRODUCER_PROPAGATION_FAILED")
                time.sleep(20)
            for item in read("PROOF_ARTIFACTS.json")["objects"]:
                ca.OBJECT = item["objectPath"]
                status, metadata, _ = self.object_request("HEAD", token)
                ensure(status == 404 and metadata["errorCode"] == "BlobNotFound", "OBJECT_COLLISION_" + item["role"])
                raw = Path(item["path"]).read_bytes()
                ensure(hashlib.sha256(raw).hexdigest() == item["sha256"] and len(raw) == item["bytes"],
                       "OBJECT_BYTES_CHANGED")
                fresh("CONCURRENCY_OBJECT_" + item["role"] + ".json", baseline())
                self.event("MUTATION_DISPATCH", label="OBJECT_PUT_ONCE_" + item["role"],
                           objectPath=item["objectPath"], ifNoneMatch="*")
                status, metadata, _ = self.object_request("PUT", token, raw)
                ensure(status == 201 and metadata["ETag"] and metadata["Last-Modified"], "OBJECT_PUT_FAILED")
                status, readmeta, downloaded = self.object_request("GET", token)
                ensure(status == 200 and downloaded == raw and readmeta["ETag"] == metadata["ETag"],
                       "OBJECT_READBACK_FAILED")
                results.append({**item, "ETag": metadata["ETag"], "writeOnce": True, "exactReadback": True})
            fresh("WRITE_ONCE_RESULT.json", {"status": "PASS", "objectCount": 2, "objects": results,
                  "versioning": "DISABLED", "overwrites": 0})
        finally:
            token = None

    def execute(self):
        try:
            self.execute_once()
        except (RuntimeError, ValueError) as error:
            fresh("EXECUTION_FAILURE_BOUNDARY.json", {
                "reason": str(error), "noRetry": True, "CSEAttempts": self.cse_count,
            })
            if self.cse_count and not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists():
                self.diagnostic()
            raise

    def execute_once(self):
        fresh("CONCURRENCY_VM_CSE.json", baseline())
        ensure(read("WRITE_ONCE_RESULT.json")["status"] == "PASS" and self.writer_deleted and
               self.lockdown == "PASS", "PRIVATE_CONSUMPTION_PRECONDITION")
        storage = self.cli(["storage", "account", "blob-service-properties", "show",
                           "--account-name", self.bindings["storageName"], "--resource-group", self.rg],
                          "VERSIONING_DISABLED_READ")
        ensure(storage.get("isVersioningEnabled") is False, "VERSIONING_DEPENDENCY")
        tags = read("PROOF_PARAMETERS.json")["parameters"]["tags"]["value"]
        fresh("VM_PARAMETERS.json", {"parameters": {name: {"value": value} for name, value in {
            "suffix": self.suffix, "provisioningSshPublicKey": read("INTERACTIVE_ACCESS_CONTRACT.json")["publicKey"],
            "identityId": self.bindings["identityId"], "subnetId": self.bindings["subnetId"],
            "nsgId": self.bindings["nsgId"], "tags": tags}.items()}})
        self.vm_start = time.monotonic()
        self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-vm",
                  "--template-file", str(HERE / "infra" / "vm.json"), "--parameters",
                  "@" + str(HERE / "VM_PARAMETERS.json")], "CREATE_VM", mutation=True)
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-vm"], "VM_CREATION_OPERATIONS")
        vm = self.cli(["vm", "show", "--resource-group", self.rg, "--name", self.prefix + "-vm"], "PROOF_VM_MODEL")
        ensure(vm["identity"]["type"] == "UserAssigned" and
               list(vm["identity"]["userAssignedIdentities"]) == [self.bindings["identityId"]], "VM_IDENTITY_BOUNDARY")
        nic = self.cli(["network", "nic", "show", "--resource-group", self.rg,
                        "--name", self.prefix + "-vm-nic"], "PROOF_VM_NIC")
        ensure(all(not x.get("publicIPAddress") for x in nic["ipConfigurations"]), "PUBLIC_VM_IP")
        items = read("PROOF_ARTIFACTS.json")["objects"]
        host = "https://" + self.bindings["blobHost"] + "/bootstrap-proof/"
        fresh("CSE_PARAMETERS.json", {"parameters": {name: {"value": value} for name, value in {
            "vmName": self.prefix + "-vm", "handoffUri": host + items[0]["objectPath"],
            "capsuleUri": host + items[1]["objectPath"],
            "readerClientId": self.bindings["identityClientId"], "tags": tags}.items()}})
        ensure(self.cse_count == 0 and not (HERE / "CSE_EXECUTION_CONSUMED.json").exists(), "SECOND_CSE_PROHIBITED")
        fresh("CSE_EXECUTION_CONSUMED.json", {"maxExecutions": 1, "authoritySha256": sha(AUTHORITY)})
        self.cse_count += 1
        self.terminal = "ISOLATION_FAILED"
        try:
            self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-once",
                      "--template-file", str(HERE / "infra" / "cse.json"), "--parameters",
                      "@" + str(HERE / "CSE_PARAMETERS.json")], "ONE_CSE_EXECUTION", mutation=True, timeout=1200)
        except RuntimeError:
            self.event("CSE_NONZERO_OBSERVE_NO_RETRY")
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-once"], "CSE_CREATION_OPERATIONS")
        view = self.cli(["vm", "extension", "show", "--resource-group", self.rg, "--vm-name", self.prefix + "-vm",
                        "--name", "g3-firstbyte-once", "--instance-view"], "CSE_TERMINAL_INSTANCE_VIEW")
        state = ca.parse_terminal(view["instanceView"]["statuses"])
        effective = ca.retry.effective_handler(view["instanceView"].get("typeHandlerVersion"))
        message = next(x.get("message", "") for x in view["instanceView"]["statuses"] if x["code"] == state["code"])
        contract = load(ARTIFACTS / "ARTIFACT_BINDING.json")
        try:
            result = parse_guest(message, contract)
        except (ValueError, RuntimeError) as error:
            fresh("RESULT_PARSE_FAILURE.json", {"reason": str(error), "noRetry": True})
            self.diagnostic()
            raise
        ensure(result["candidateSha256"] == items[1]["sha256"], "GUEST_CANDIDATE_IDENTITY")
        ensure(result["shimSha256"] == items[0]["sha256"], "GUEST_SHIM_IDENTITY")
        if result.get("diagnosticRequired"):
            result = self.retain_guest_evidence(message, result, contract)
            ensure(result["candidateSha256"] == items[1]["sha256"] and
                   result["shimSha256"] == items[0]["sha256"], "RETAINED_GUEST_IDENTITY")
        fresh("GUEST_PROOF_RESULT.json", {**result, "effectiveHandler": effective,
              "terminalCode": state["code"], "extensionSucceeded": state["state"] == "succeeded"})
        self.terminal = "PROVEN" if result["allPassed"] and state["state"] == "succeeded" else "ISOLATION_FAILED"


if __name__ == "__main__":
    ensure(len(sys.argv) == 2, "ACTION_REQUIRED")
    actions = {"prepare": prepare, "bind-artifacts": bind_artifacts,
               "validate": ca.retry.v.main, "execute": lambda: IsolationProof().run()}
    ensure(sys.argv[1] in actions, "UNKNOWN_ACTION")
    actions[sys.argv[1]]()
