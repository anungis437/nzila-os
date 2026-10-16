"""Content-addressed one-shot proof using preserved transport/cleanup helpers."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import sys
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, build_opener
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / "g3a-bootstrap-retry"
ORIGINAL_AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\d2eddaed-6a3c-4798-a4cc-c309ce3c8af5\Pasted text #1.txt")
AUTHORITY = Path(r"C:\Users\AubertNungisa\AppData\Roaming\Code\agentSessionData\7496e6a0-5c9e-4c19-86cb-183af2c0f9c4\attachments\9177a08c-9291-4843-a300-184c82e64e8c\Pasted text #1.txt")
SHA = "5f82bd226a27fd1d066a211bb527049097c049181eae92ebf9b3fae3e16683d8"
OBJECT = "sha256/" + SHA + "/g3a-bootstrap"
sys.path.insert(0, str(OLD))
import retry
sys.path.insert(0, str(HERE.parent / "g3a-content-addressed"))
from status_parser import parse_terminal
sys.path.insert(0, str(HERE.parent / "g3a-bootstrap-resume"))
import refresh

for module in (retry, retry.p, retry.v, retry.live, retry.b):
    module.HERE = HERE
    module.AUTHORITY = AUTHORITY
refresh.HERE = HERE
refresh.PACKAGE = HERE
fresh, ensure, sha, baseline = retry.fresh, retry.ensure, retry.sha, retry.baseline


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8-sig"))


def classify(message):
    if re.search(r"public.*(?:fallback|network.*disabled)|AuthorizationFailure.*public", message, re.I):
        return "PRIVATE_PATH_PUBLIC_FALLBACK"
    if re.search(r"\b403\b|CLARIFICATION=71|failed/71|AuthorizationPermissionMismatch|AuthenticationFailed|token.*failed", message, re.I):
        return "IDENTITY_AUTH_FAILURE"
    if re.search(r"\b404\b|CLARIFICATION=70|failed/70|BlobNotFound", message):
        return "BLOB_NOT_FOUND"
    if re.search(r"\b400\b|InvalidQueryParameter|Bad Request", message, re.I):
        return "STORAGE_REQUEST_BAD_REQUEST"
    if re.search(r"\b409\b|Conflict", message, re.I):
        return "STORAGE_CONFLICT"
    if re.search(r"no such host|dial tcp|timeout|network is unreachable", message, re.I):
        return "NETWORK_TRANSPORT_FAILURE"
    return "CSE_DOWNLOAD_OTHER"


def diagnostic_script(host):
    ensure(re.fullmatch(r"[a-z0-9]+\.blob\.core\.windows\.net", host), "DIAGNOSTIC_HOST_INVALID")
    # Output only allow-listed fields, never raw log lines or credential-bearing URLs.
    return r"""set -eu
LOG=/var/log/azure/custom-script/handler.log
if [ ! -r "$LOG" ]; then printf 'DIAGNOSTIC_LOG_UNAVAILABLE\n'; exit 1; fi
printf 'DIAGNOSTIC_LOG_READ_OK\n'
tail -n 120 "$LOG" | awk '
{
 s=$0
 while (match(s, /[0-9][0-9][0-9] (Bad Request|Forbidden|Not Found|Conflict|Internal Server Error|Service Unavailable)/)) {
   print "HTTP_STATUS=" substr(s,RSTART,3); s=substr(s,RSTART+RLENGTH)
 }
 s=$0
 if (match(s, /HTTP\/[12](\.[01])? [0-9][0-9][0-9]/)) print "HTTP_RESPONSE=" substr(s,RSTART,RLENGTH)
 s=$0
 while (match(s, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)) {
   print "REQUEST_OR_CORRELATION_UUID=" substr(s,RSTART,RLENGTH); s=substr(s,RSTART+RLENGTH)
 }
 s=tolower($0)
 if (s ~ /blobnotfound/) print "STORAGE_CODE=BlobNotFound"
 if (s ~ /authorizationpermissionmismatch/) print "STORAGE_CODE=AuthorizationPermissionMismatch"
 if (s ~ /authorizationfailure/) print "STORAGE_CODE=AuthorizationFailure"
 if (s ~ /authenticationfailed/) print "STORAGE_CODE=AuthenticationFailed"
 if (s ~ /invalidqueryparametervalue/) print "STORAGE_CODE=InvalidQueryParameterValue"
 if (s ~ /invalidheadervalue/) print "STORAGE_CODE=InvalidHeaderValue"
 if (s ~ /public network access.*disabled/) print "PUBLIC_NETWORK_DISABLED_RESPONSE=YES"
 if (s ~ /failed to get.*token|token.*acquisition.*fail/) print "TOKEN_ACQUISITION_FAILED=YES"
 if (s ~ /msi|managed.identity/) print "DOWNLOADER=MSI"
 if (s ~ /download/) print "PHASE=FILE_DOWNLOAD"
 if (s ~ /file\[0\]/) print "FILE_INDEX=0"
 if (s ~ /no such host|dial tcp|timeout|network is unreachable/) print "NETWORK_TRANSPORT_ERROR=YES"
 if (s ~ /clarification.*70|failed\/70/) print "CLARIFICATION=70"
 if (s ~ /clarification.*71|failed\/71/) print "CLARIFICATION=71"
 if (s ~ /clarification.*72|failed\/72/) print "CLARIFICATION=72"
 if (index($0,"BOUND_HOST") > 0) print "BOUND_BLOB_HOST_OBSERVED=YES"
}' | sort -u
""".replace("BOUND_HOST", host)


def prepare():
    fresh("CONCURRENCY_PREPARE.json", baseline())
    parser_root = HERE.parent / "g3a-content-addressed" / "LOCAL_VERIFICATION.json"
    ensure(sha(parser_root) == "5781c68b7d50efc41278cc17f8a3bc458f6de2cedc7745c7544c2e05231fdb2f",
           "LOCAL_PARSER_ROOT_CHANGED")
    preserved = load_json(parser_root)
    for name, expected in preserved["fileHashes"].items():
        ensure(sha(parser_root.parent / name) == expected, "PARSER_PACKET_CHANGED")
    binding = {
        "sameAuthority": True, "originalAuthorityPath": str(ORIGINAL_AUTHORITY),
        "originalAuthoritySha256": sha(ORIGINAL_AUTHORITY),
        "correctedAcceptancePath": str(AUTHORITY), "correctedAcceptanceSha256": sha(AUTHORITY),
        "localPreparationRoot": sha(parser_root),
        "borrowedCodeHashes": {str(path): sha(path) for path in [
            OLD / "retry.py", *[OLD.parent / "g3a-live-bootstrap" / (name + ".py")
                             for name in ("preflight", "validation", "live")],
            parser_root.parent / "status_parser.py",
            HERE.parent / "g3a-bootstrap-resume" / "refresh.py"]},
    }
    fresh("AUTHORITY_CORRECTION_BINDING.json", binding)
    (HERE / "infra").mkdir(exist_ok=True)
    for name in ("main", "transport", "vm", "cse"):
        data = (OLD / "infra" / (name + ".bicep")).read_text()
        if name == "transport":
            ensure(data.count("isVersioningEnabled: true") == 1, "TRANSPORT_PRIOR_CONTRACT_CHANGED")
            data = data.replace("isVersioningEnabled: true", "isVersioningEnabled: false")
        if name == "cse":
            data = data.replace("blobVersionUri", "blobObjectUri").replace("./g3a-bootstrap-proof", "./g3a-bootstrap")
        with (HERE / "infra" / (name + ".bicep")).open("x", encoding="utf-8") as file:
            file.write(data)
    retry.p.main()
    frozen = OLD / "g3a-bootstrap-proof-V1"
    ensure(sha(frozen) == SHA, "FROZEN_BINARY_CHANGED")
    shutil.copyfile(frozen, HERE / "g3a-bootstrap")
    fresh("BINARY_BINDING.json", {"path": str(HERE / "g3a-bootstrap"), "sha256": SHA,
                               "bytes": frozen.stat().st_size, "marker": "G3A_BOOTSTRAP_REQUESTED_V1",
                               "recompiled": False, "objectPath": OBJECT})
    refresh.PACKAGE = OLD
    refresh.cost()
    refresh.PACKAGE = HERE
    refreshed = load("REFRESHED_COST_GATE.json")
    fresh("CURRENT_COST_GATE.json", {
        "conservativeExpectedCAD": refreshed["REFRESHED_EXPECTED_COST_CAD"], "hardCeilingCAD": "3.00",
        "modelSha256": refreshed["priorModelSha256"], "currentRetailRefresh": "REFRESHED_COST_GATE.json",
        "maxProofHours": 4, "maxVMHours": 2, "maxPEHours": 4,
        "diagnosticAction": "WITHIN_VM_TIME_BOUND_NO_ADDITIONAL_RESOURCE"})
    print("CA_PREPARE_READ_ONLY_PASS")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


class ContentProof(retry.live.Proof):
    def consume(self):
        correction = load("AUTHORITY_CORRECTION_BINDING.json")
        ensure(sha(ORIGINAL_AUTHORITY) == correction["originalAuthoritySha256"], "ORIGINAL_AUTHORITY_CHANGED")
        for name, expected in correction["borrowedCodeHashes"].items():
            ensure(sha(Path(name)) == expected, "BORROWED_CODE_CHANGED")
        ensure(load("PUBLISHED_HANDLER_BINDING.json")["CSE_2_1_FAMILY_AVAILABLE"] == "YES", "FAMILY_ABSENT")
        ensure(load("LOCAL_TESTS.json")["status"] == "PASS", "LOCAL_TESTS_NOT_PASS")
        super().consume()
        fresh("FIRST_BYTE_AUTHORITY_CONSUMED.json", {
            "FIRST_BYTE_PROOF_AUTHORITY_CONSUMED": "YES", "sameAuthorityAsOriginal": True,
            "originalAuthoritySha256": correction["originalAuthoritySha256"],
            "correctedAcceptanceSha256": sha(AUTHORITY), "maxCSEAttempts": 1})

    def object_request(self, method, token, data=None):
        self.budget()
        host = self.bindings["blobHost"]
        ensure(host == self.bindings["storageName"] + ".blob.core.windows.net", "UNEXPECTED_BLOB_HOST")
        headers = {"Authorization": "Bearer " + token, "x-ms-version": "2023-11-03"}
        if data is not None:
            headers.update({"x-ms-blob-type": "BlockBlob", "Content-Type": "application/octet-stream",
                            "If-None-Match": "*"})
        request = Request("https://" + host + "/bootstrap-proof/" + OBJECT, data=data, method=method, headers=headers)
        try:
            with build_opener(retry.live.NoRedirect).open(request, timeout=120) as response:
                raw = response.read()
                metadata = {key: response.headers.get(key) for key in ("ETag", "Last-Modified", "x-ms-request-id")}
                status = response.status
        except HTTPError as error:
            raw = error.read()
            code = error.headers.get("x-ms-error-code")
            if not code and raw:
                code = ET.fromstring(raw).findtext("Code")
            self.event("OBJECT_HTTP_ERROR", method=method, status=error.code, errorCode=code)
            return error.code, {"errorCode": code}, b""
        self.event("OBJECT_RESPONSE", method=method, status=status, metadata=metadata,
                   bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest() if raw else None)
        return status, metadata, raw

    def stage(self):
        token = self.storage_token()
        try:
            deadline = time.monotonic() + 600
            while True:
                status, _, _ = self.blob("HEAD", token, container=True)
                if status == 200:
                    break
                ensure(status == 403 and time.monotonic() < deadline, "PRODUCER_PROPAGATION_FAILED")
                time.sleep(20)
            status, meta, _ = self.object_request("HEAD", token)
            ensure(status == 404 and meta["errorCode"] == "BlobNotFound", "EXACT_OBJECT_NOT_CONFIRMED_ABSENT")
            raw = (HERE / "g3a-bootstrap").read_bytes()
            ensure(hashlib.sha256(raw).hexdigest() == SHA, "FROZEN_BINARY_CHANGED")
            self.event("MUTATION_DISPATCH", label="OBJECT_PUT_ONCE", objectPath=OBJECT, ifNoneMatch="*")
            status, metadata, _ = self.object_request("PUT", token, raw)
            ensure(status == 201 and metadata["ETag"] and metadata["Last-Modified"], "WRITE_ONCE_PUT_FAILED")
            status, read_meta, downloaded = self.object_request("GET", token)
            ensure(status == 200 and downloaded == raw and read_meta["ETag"] == metadata["ETag"],
                   "EXACT_BYTE_READBACK_FAILED")
            fresh("WRITE_ONCE_RESULT.json", {"status": "PASS", "objectPath": OBJECT, "sha256": SHA,
                                          "bytes": len(raw), "ETag": metadata["ETag"],
                                          "LastModified": metadata["Last-Modified"],
                                          "absenceBeforeUpload": True, "IfNoneMatch": "*",
                                          "singlePUT": True, "exactByteReadback": True})
        finally:
            token = None

    def diagnostic(self):
        ensure(not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists(), "SECOND_DIAGNOSTIC_PROHIBITED")
        script = diagnostic_script(self.bindings["blobHost"])
        with (HERE / "diagnostic.sh").open("x", encoding="utf-8", newline="\n") as file:
            file.write(script)
        fresh("DIAGNOSTIC_ACTION_CONSUMED.json", {"maxActions": 1, "readOnlyGuestScript": True})
        try:
            result = self.cli(["vm", "run-command", "invoke", "--resource-group", self.rg,
                               "--name", self.prefix + "-vm", "--command-id", "RunShellScript",
                               "--scripts", "@" + str(HERE / "diagnostic.sh")],
                              "ONE_READ_ONLY_DIAGNOSTIC_ACTION", mutation=True, timeout=600)
            text = "\n".join(x.get("message", "") for x in result.get("value", []))
            fresh("DIAGNOSTIC_CAPTURE.json", {"status": "PASS" if "DIAGNOSTIC_LOG_READ_OK" in text else "FAIL",
                                            "safeOutput": text, "maxLogLinesExamined": 120,
                                            "rawLogLinesPersisted": False})
            return text
        except RuntimeError as error:
            fresh("DIAGNOSTIC_CAPTURE.json", {"status": "FAIL", "reason": str(error), "retry": False})
            return ""

    def execute(self):
        try:
            self.execute_once()
        except Exception:
            if self.vm_start is not None and self.cse_count and not (HERE / "DIAGNOSTIC_ACTION_CONSUMED.json").exists():
                self.diagnostic()
            raise

    def execute_once(self):
        fresh("CONCURRENCY_VM_CSE_WRITE.json", baseline())
        ensure(load("WRITE_ONCE_RESULT.json")["status"] == "PASS" and self.lockdown == "PASS",
               "CA_LOCKDOWN_PRECONDITION")
        storage = self.cli(["storage", "account", "blob-service-properties", "show",
                            "--account-name", self.bindings["storageName"], "--resource-group", self.rg],
                           "VERSIONING_DISABLED_READ")
        ensure(storage.get("isVersioningEnabled") is False, "VERSIONING_NOT_DISABLED")
        params = load("PROOF_PARAMETERS.json")["parameters"]
        vmparams = {name: {"value": value} for name, value in {
            "suffix": self.suffix, "provisioningSshPublicKey": load("INTERACTIVE_ACCESS_CONTRACT.json")["publicKey"],
            "identityId": self.bindings["identityId"], "subnetId": self.bindings["subnetId"],
            "nsgId": self.bindings["nsgId"], "tags": params["tags"]["value"]}.items()}
        fresh("VM_PARAMETERS.json", {"parameters": vmparams})
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
        ensure(all(not x.get("publicIPAddress") for x in nic["ipConfigurations"]), "VM_PUBLIC_IP")
        uri = "https://" + self.bindings["blobHost"] + "/bootstrap-proof/" + OBJECT
        cseparams = {name: {"value": value} for name, value in {
            "vmName": self.prefix + "-vm", "blobObjectUri": uri,
            "readerClientId": self.bindings["identityClientId"], "tags": params["tags"]["value"]}.items()}
        fresh("CSE_PARAMETERS.json", {"parameters": cseparams})
        ensure(self.cse_count == 0 and "?" not in uri, "CSE_ONE_URI_PRECONDITION")
        fresh("CSE_EXECUTION_CONSUMED.json", {"maxExecutions": 1, "authoritySha256": self.authority["sha256"]})
        self.cse_count += 1
        self.terminal = "CSE_DOWNLOAD_OTHER"
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
        instance = view["instanceView"]
        effective = retry.effective_handler(instance.get("typeHandlerVersion"))
        state = parse_terminal(instance["statuses"])
        message = next(x.get("message", "") for x in instance["statuses"] if x["code"] == state["code"])
        hashes = re.findall(r"SELF_SHA256=([0-9a-f]{64})", message)
        proven = state["state"] == "succeeded" and "G3A_BOOTSTRAP_REQUESTED_V1" in message and hashes == [SHA]
        self.terminal = "PROVEN" if proven else classify(message)
        if not proven and "G3A_BOOTSTRAP_REQUESTED_V1" not in message:
            diagnostic = self.diagnostic()
            self.terminal = classify(message + "\n" + diagnostic)
        fresh("CONTENT_FIRST_BYTE_RESULT.json", {
            "classification": self.terminal, "proven": proven, "effectiveHandler": effective,
            "terminalCode": state["code"], "runtimeSelfHashes": hashes, "queryString": "NONE",
            "objectPath": OBJECT, "writerAbsentDuringConsumption": self.writer_deleted,
            "publicDisabledDuringConsumption": self.lockdown == "PASS"})


if __name__ == "__main__":
    if sys.argv[1] == "prepare":
        prepare()
    elif sys.argv[1] == "validate":
        retry.v.main()
    elif sys.argv[1] == "execute":
        ContentProof().run()
    elif sys.argv[1] == "bind":
        fresh("CONCURRENCY_BIND.json", baseline())
        stream = io.StringIO()
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
            unittest.defaultTestLoader.loadTestsFromNames(["test_status_parser", "test_proof"]))
        fresh("LOCAL_TESTS.json", {"status": "PASS" if result.wasSuccessful() else "FAIL",
                                "testCount": result.testsRun, "output": stream.getvalue()})
        ensure(result.wasSuccessful() and result.testsRun == 12, "LOCAL_TESTS_FAILED")
        retry.v.cli("STORAGE_NAME_AVAILABILITY.json", ["storage", "account", "check-name",
                      "--name", "nzilag3fb" + load("AUTHORITY_BINDING.json")["suffix"]])
        ensure(load("STORAGE_NAME_AVAILABILITY.json")["value"]["nameAvailable"], "STORAGE_NAME_COLLISION")
        network = retry.v.cli("NETWORK_USAGE.json", ["rest", "--method", "get", "--url",
                  "https://management.azure.com/subscriptions/" + retry.p.SUB +
                  "/providers/Microsoft.Network/locations/canadacentral/usages?api-version=2024-05-01"])
        for name, delta in (("VirtualNetworks", 1), ("NetworkInterfaces", 2),
                            ("NetworkSecurityGroups", 1), ("PrivateEndpoints", 1)):
            matches = [x for x in network["value"] if x["name"]["value"].lower() == name.lower()]
            ensure(len(matches) == 1 and int(matches[0]["currentValue"]) + delta <= int(matches[0]["limit"]),
                   "NETWORK_QUOTA_" + name)
        accounts = retry.v.cli("STORAGE_CAPACITY.json", ["storage", "account", "list", "--subscription",
                               retry.p.SUB, "--query", "[?location=='canadacentral'].id"])
        ensure(len(accounts) + 1 <= 250, "STORAGE_CAPACITY")
        files = list(HERE.glob("*.py")) + list((HERE / "infra").glob("*")) + [
            HERE / name for name in ("PROOF_PARAMETERS.json", "CURRENT_COST_GATE.json", "BINARY_BINDING.json",
                                    "INTERACTIVE_ACCESS_CONTRACT.json", "g3a-bootstrap", "PUBLISHED_HANDLER_BINDING.json",
                                    "AUTHORITY_CORRECTION_BINDING.json")]
        fresh("EXECUTION_BINDING.json", {"authoritySha256": sha(AUTHORITY),
                                       "fileHashes": {str(x.relative_to(HERE)): sha(x) for x in files}})
    else:
        raise RuntimeError("UNKNOWN_PHASE")
