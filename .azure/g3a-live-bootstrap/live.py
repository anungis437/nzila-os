"""Single authority-bound first-byte proof. No registry or product operations."""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET

from preflight import AUTHORITY, AZ, ENV, HERE, ROOT, SUB, baseline, ensure, fresh, sha

SCOPE = "/subscriptions/" + SUB
G2_RG = "nzila-g2-proof-xre47vggs5uhw"
G2_ROLE_QUERY = "[?starts_with(scope, '" + SCOPE + "/resourceGroups/" + G2_RG + "') || scope=='" + SCOPE + "' || scope=='/']"


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8-sig"))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def classify_status(message, v1_sha, v2_sha, succeeded):
    v1 = "G3A_BOOTSTRAP_REQUESTED_V1"
    v2 = "G3A_BOOTSTRAP_CURRENT_V2"
    reported = re.findall(r"SELF_SHA256=([0-9a-f]{64})", message)
    if v2 in message and reported == [v2_sha]:
        return "VERSION_IGNORED"
    if succeeded and v1 in message and v2 not in message and reported == [v1_sha]:
        return "PROVEN"
    if re.search(r"InvalidQueryParameterValue|UnsupportedQueryParameter|UnsupportedHeader", message,
                 flags=re.IGNORECASE) and "version" in message.lower():
        return "VERSION_UNSUPPORTED"
    if re.search(r"AuthorizationPermissionMismatch|AuthenticationFailed|failed to get.*identity|MSI token is empty",
                 message, flags=re.IGNORECASE):
        return "IDENTITY_AUTH_FAILURE"
    if re.search(r"no such host|dial tcp|TLS handshake timeout|i/o timeout|network is unreachable", message,
                 flags=re.IGNORECASE):
        return "PRIVATE_PATH_FAILURE"
    return "CSE_FAILURE_OTHER"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Proof:
    def __init__(self):
        self.authority = load("AUTHORITY_BINDING.json")
        self.suffix = self.authority["suffix"]
        self.rg = self.authority["resourceGroupCandidate"]
        self.rgid = SCOPE + "/resourceGroups/" + self.rg
        self.prefix = "g3fb-" + self.suffix
        self.subdeployment = "g3-firstbyte-" + self.suffix
        self.bindings = None
        self.start = None
        self.vm_start = None
        self.owned_rg = False
        self.events = []
        self.cse_count = 0
        self.terminal = "NOT_RUN"
        self.lockdown = "NOT_RUN"
        self.v1_version = "NOT_CREATED"
        self.identity = None
        self.writer_deleted = False
        self.reader_deleted = False

    def event(self, kind, **values):
        item = {"index": len(self.events) + 1, "UTC": datetime.now(timezone.utc).isoformat(),
                "kind": kind, **values}
        self.events.append(item)
        fresh("EVENT_" + f"{item['index']:03d}" + ".json", item)
        print(kind, flush=True)

    def cli(self, args, label, mutation=False, timeout=600, allow_absent=False):
        if mutation:
            if not label.startswith(("CLEANUP_", "DELETE_")):
                self.budget()
            ensure(self.start is not None and (HERE / "AUTHORITY_CONSUMED.json").exists(),
                   "MUTATION_WITHOUT_AUTHORITY")
            self.event("MUTATION_DISPATCH", label=label, command=["az", *args])
        result = subprocess.run([AZ, *args, "--subscription", SUB, "--output", "json", "--only-show-errors"],
                                capture_output=True, text=True, env=ENV, timeout=timeout)
        if result.returncode:
            error = result.stderr.strip()
            if allow_absent and re.search(r"ResourceNotFound|NotFound|could not be found|does not exist",
                                          error, flags=re.IGNORECASE):
                self.event("READ_CONFIRMED_ABSENT", label=label)
                return None
            self.event("EXPLICIT_COMMAND_FAILURE", label=label, exitCode=result.returncode, stderr=error)
            raise RuntimeError("COMMAND_FAILED_" + label)
        value = json.loads(result.stdout) if result.stdout.strip() else None
        self.event("MUTATION_RESPONSE" if mutation else "READ_RESPONSE", label=label, value=value)
        return value

    def budget(self):
        if self.start is not None:
            ensure(time.monotonic() - self.start < 4 * 3600, "PROOF_FOUR_HOUR_HARD_STOP")
        if self.vm_start is not None:
            ensure(time.monotonic() - self.vm_start < 2 * 3600, "VM_TWO_HOUR_HARD_STOP")

    def consume(self):
        fresh("CONCURRENCY_FIRST_MUTATION.json", baseline())
        ensure(sha(AUTHORITY) == self.authority["sha256"], "AUTHORITY_CHANGED")
        ensure(not Path(load("INTERACTIVE_ACCESS_CONTRACT.json")["privateKeyPath"]).exists(),
               "PROVISIONING_PRIVATE_KEY_REAPPEARED")
        ensure(load(".azure/validate-status.json")["completedStep"] == "UpdateStatus", "VALIDATION_NOT_COMPLETE")
        ensure("Status: Validated" in (HERE / ".azure" / "deployment-plan.md").read_text(),
               "DEPLOYMENT_PLAN_NOT_VALIDATED")
        ensure(load("EXECUTION_BINDING.json")["authoritySha256"] == self.authority["sha256"],
               "EXECUTION_BINDING_CHANGED")
        for relative, expected in load("EXECUTION_BINDING.json")["fileHashes"].items():
            ensure(sha(HERE / relative) == expected, "BOUND_EXECUTABLE_SOURCE_CHANGED_" + relative)
        account = self.cli(["account", "show"], "IMMEDIATE_ACCOUNT")
        ensure(account["id"] == SUB and account["tenantId"] == self.authority["tenant"], "AZURE_CONTEXT_CHANGED")
        absent = self.cli(["group", "exists", "--name", self.rg], "IMMEDIATE_RG_ABSENCE")
        ensure(absent is False, "PROOF_RG_COLLISION")
        existing = self.cli(["deployment", "sub", "show", "--name", self.subdeployment],
                            "SUB_DEPLOYMENT_ABSENCE", allow_absent=True)
        ensure(existing is None, "PROOF_DEPLOYMENT_NAME_COLLISION")
        g2 = self.cli(["resource", "list", "--resource-group", G2_RG], "IMMEDIATE_G2_RESOURCES")
        ensure(canonical(sorted(g2, key=lambda item: item["id"])) ==
               canonical(sorted(load("G2_RESOURCE_BASELINE.json")["value"], key=lambda item: item["id"])),
               "G2_RESOURCES_CHANGED_BEFORE_MUTATION")
        roles = self.cli(["role", "assignment", "list", "--all", "--include-inherited",
                          "--fill-principal-name", "false", "--query", G2_ROLE_QUERY], "IMMEDIATE_G2_ROLES")
        ensure(canonical(sorted(roles, key=lambda item: item["id"])) ==
               canonical(sorted(load("G2_ROLE_BASELINE_CORRECTED.json")["value"], key=lambda item: item["id"])),
               "G2_ROLES_CHANGED_BEFORE_MUTATION")
        cost = load("CURRENT_COST_GATE.json")
        ensure(Decimal(cost["conservativeExpectedCAD"]) * Decimal("1.5") <= Decimal("3"), "CAD3_COST_GATE")
        fresh("AUTHORITY_CONSUMED.json", {
            "BOOTSTRAP_PROOF_AUTHORITY_CONSUMED": "YES", "sha256": self.authority["sha256"],
            "UTC": datetime.now(timezone.utc).isoformat(), "firstMutation": "SUBSCRIPTION_TRANSPORT_DEPLOYMENT",
            "maximumCSEExecutions": 1, "resourceGroup": self.rg, "hardCeilingCAD": "3.00"})
        self.start = time.monotonic()

    def receipt(self):
        operations = self.cli(["deployment", "operation", "sub", "list", "--name", self.subdeployment],
                              "SUB_DEPLOYMENT_OPERATIONS")
        rg_creates = [item for item in operations if
                      (item.get("properties", {}).get("targetResource") or {}).get("id", "").lower() == self.rgid.lower() and
                      item["properties"]["provisioningState"] == "Succeeded"]
        ensure(len(rg_creates) == 1, "POSITIVE_RG_CREATION_RECEIPT_MISSING")
        group = self.cli(["group", "show", "--name", self.rg], "OWNED_GROUP_RECEIPT")
        ensure(group["tags"]["authority_sha256"] == self.authority["sha256"], "RG_OWNERSHIP_TAG_MISMATCH")
        self.owned_rg = True
        fresh("RESOURCE_GROUP_CREATION_RECEIPT.json", {
            "id": group["id"], "operation": rg_creates[0],
            "baselineAbsent": True, "authoritySha256": self.authority["sha256"]})

    def transport(self):
        result = self.cli(["deployment", "sub", "create", "--name", self.subdeployment, "--location", "canadacentral",
                           "--template-file", str(HERE / "infra" / "main.json"),
                           "--parameters", "@" + str(HERE / "PROOF_PARAMETERS.json")],
                          "CREATE_TRANSPORT", mutation=True)
        self.receipt()
        self.bindings = result["properties"]["outputs"]["transportBindings"]["value"]
        ensure(all(self.bindings[name].lower().startswith(self.rgid.lower() + "/") for name in
                   ("storageId", "identityId", "producerRoleId", "readerRoleId", "containerId", "endpointId",
                    "vnetId", "subnetId", "nsgId", "zoneId")), "TRANSPORT_OUTPUT_ESCAPE")
        self.identity = self.bindings["identityPrincipalId"]
        fresh("TRANSPORT_BINDINGS.json", self.bindings)
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-transport-" + self.suffix], "TRANSPORT_RESOURCE_CREATION_OPERATIONS")
        self.cli(["identity", "show", "--ids", self.bindings["identityId"]], "PROOF_UAMI")
        self.cli(["resource", "list", "--resource-group", self.rg], "TRANSPORT_RESOURCE_INVENTORY")

    def storage_token(self):
        result = subprocess.run([AZ, "account", "get-access-token", "--resource", "https://storage.azure.com/",
                                 "--subscription", SUB, "--output", "json", "--only-show-errors"],
                                capture_output=True, text=True, env=ENV, timeout=60)
        ensure(result.returncode == 0, "PRODUCER_TOKEN_ACQUISITION_FAILED")
        token = json.loads(result.stdout)["accessToken"]
        ensure(bool(token), "PRODUCER_TOKEN_EMPTY")
        return token

    def blob(self, method, token, body=None, version=None, container=False):
        self.budget()
        host = self.bindings["blobHost"]
        ensure(host == self.bindings["storageName"] + ".blob.core.windows.net", "UNEXPECTED_BLOB_HOST")
        url = "https://" + host + "/bootstrap-proof" + ("" if container else "/g3a-bootstrap-proof")
        query = {"restype": "container"} if container else {}
        if version:
            query["versionid"] = version
        if query:
            url += "?" + urlencode(query)
        headers = {"Authorization": "Bearer " + token, "x-ms-version": "2023-11-03"}
        if body is not None:
            headers.update({"x-ms-blob-type": "BlockBlob", "Content-Type": "application/octet-stream"})
        request = Request(url, data=body, headers=headers, method=method)
        try:
            with build_opener(NoRedirect).open(request, timeout=120) as response:
                raw = response.read()
                metadata = {key: response.headers.get(key) for key in
                            ("x-ms-version-id", "x-ms-request-id", "Content-Length", "ETag", "Content-Type")}
                status = response.status
        except HTTPError as error:
            raw_error = error.read()
            try:
                code = ET.fromstring(raw_error).findtext("Code") or "UNKNOWN"
            except ET.ParseError:
                code = "NON_XML_RESPONSE"
            self.event("BLOB_RESPONSE_ERROR", method=method, httpStatus=error.code, errorCode=code)
            return error.code, {"errorCode": code}, b""
        self.event("BLOB_RESPONSE", method=method, httpStatus=status, versionId=metadata["x-ms-version-id"],
                   responseBytes=len(raw), responseSha256=hashlib.sha256(raw).hexdigest() if raw else None,
                   mutation=method == "PUT")
        return status, metadata, raw

    def stage(self):
        token = self.storage_token()
        try:
            deadline = time.monotonic() + 600
            while True:
                status, metadata, _ = self.blob("HEAD", token, container=True)
                if status == 200:
                    break
                ensure(status == 403 and time.monotonic() < deadline, "PRODUCER_CONTAINER_READ_PRECONDITION_FAILED")
                time.sleep(20)
            bins = load("PROBE_BINARIES.json")["binaries"]
            versions = {}
            for name in ("V1", "V2"):
                raw = Path(bins[name]["path"]).read_bytes()
                ensure(hashlib.sha256(raw).hexdigest() == bins[name]["sha256"], "PROBE_BYTES_CHANGED")
                self.event("MUTATION_DISPATCH", label="BLOB_PUT_" + name, blob="bootstrap-proof/g3a-bootstrap-proof")
                status, metadata, _ = self.blob("PUT", token, raw)
                ensure(status == 201 and metadata["x-ms-version-id"], "BLOB_SINGLE_PUT_FAILED_" + name)
                versions[name] = metadata["x-ms-version-id"]
                status, _, downloaded = self.blob("GET", token, version=versions[name])
                ensure(status == 200 and downloaded == raw, "VERSIONED_PRODUCER_READBACK_FAILED_" + name)
            ensure(versions["V1"] != versions["V2"], "BLOB_VERSIONS_NOT_DISTINCT")
            status, metadata, current = self.blob("GET", token)
            ensure(status == 200 and metadata["x-ms-version-id"] == versions["V2"] and
                   hashlib.sha256(current).hexdigest() == bins["V2"]["sha256"], "CURRENT_BLOB_NOT_V2")
            self.v1_version = versions["V1"]
            fresh("BLOB_VERSION_DISCRIMINATOR.json", {
                "V1": dict(bins["V1"], versionId=versions["V1"]),
                "V2": dict(bins["V2"], versionId=versions["V2"]), "unversionedCurrentIsV2": True,
                "producerWindow": "TEMPORARY", "auth": "ENTRA_BEARER_MEMORY_ONLY",
                "singlePUTCalls": 2, "autoMutationRetries": False})
        finally:
            token = None

    def lock(self):
        self.cli(["role", "assignment", "delete", "--ids", self.bindings["producerRoleId"]],
                 "REMOVE_PRODUCER_ROLE", mutation=True)
        self.writer_deleted = True
        fresh("STORAGE_LOCKDOWN_REQUEST.json", {"properties": {
            "publicNetworkAccess": "Disabled", "networkAcls": {
                "bypass": "None", "defaultAction": "Deny", "ipRules": [], "virtualNetworkRules": []}}})
        self.cli(["rest", "--method", "patch", "--url", "https://management.azure.com" +
                  self.bindings["storageId"] + "?api-version=2023-05-01", "--body",
                  "@" + str(HERE / "STORAGE_LOCKDOWN_REQUEST.json")], "LOCK_STORAGE", mutation=True)
        storage = self.cli(["storage", "account", "show", "--ids", self.bindings["storageId"]], "LOCKDOWN_STORAGE_READ")
        acls = storage["networkRuleSet"]
        ensure(storage["publicNetworkAccess"] == "Disabled" and not storage["allowBlobPublicAccess"] and
               storage["allowSharedKeyAccess"] is False and acls["defaultAction"] == "Deny" and
               not acls["ipRules"] and acls["bypass"] == "None", "STORAGE_LOCKDOWN_FAILED")
        roles = self.cli(["role", "assignment", "list", "--all", "--fill-principal-name", "false",
                          "--query", "[?starts_with(scope, '" + self.rgid + "') || principalId=='" +
                          self.identity + "']"], "LOCKDOWN_ROLES")
        ensure(len(roles) == 1 and roles[0]["principalId"] == self.identity and
               roles[0]["scope"].lower() == self.bindings["containerId"].lower() and
               roles[0]["roleDefinitionId"].endswith("2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"),
               "BUILDER_ROLE_NOT_EXACT_READ_ONLY")
        endpoint = self.cli(["network", "private-endpoint", "show", "--ids", self.bindings["endpointId"]],
                            "LOCKDOWN_PRIVATE_ENDPOINT")
        ensure(endpoint["privateLinkServiceConnections"][0]["privateLinkServiceConnectionState"]["status"] ==
               "Approved", "PRIVATE_ENDPOINT_NOT_APPROVED")
        links = self.cli(["network", "private-dns", "link", "vnet", "list", "--resource-group", self.rg,
                          "--zone-name", "privatelink.blob.core.windows.net"], "LOCKDOWN_DNS_LINK")
        ensure(len(links) == 1 and links[0]["virtualNetwork"]["id"].lower() ==
               self.bindings["vnetId"].lower(), "PRIVATE_DNS_LINK_FAILED")
        records = self.cli(["network", "private-dns", "record-set", "a", "show", "--resource-group", self.rg,
                            "--zone-name", "privatelink.blob.core.windows.net",
                            "--name", self.bindings["storageName"]], "LOCKDOWN_BLOB_DNS")
        import ipaddress
        pe_network = ipaddress.ip_network(load("CIDR_SELECTION.json")["chosen"])
        ensure(records["aRecords"] and all(ipaddress.ip_address(item["ipv4Address"]) in pe_network
                                          for item in records["aRecords"]), "PRIVATE_BLOB_DNS_NOT_PROOF_SUBNET")
        self.lockdown = "PASS"
        fresh("STORAGE_LOCKDOWN.json", {"status": "PASS", "publicNetworkDisabled": True,
              "producerRoleAbsent": True, "producerIPRulesRemoved": True,
              "builderReadOnlyExactContainer": True, "privateEndpointApproved": True,
              "privateDnsRecordAndLinkBound": True, "guestDNSObserved": "CSE_CONSUMPTION_NOT_RUN_YET"})

    def execute(self):
        fresh("CONCURRENCY_VM_CSE_WRITE.json", baseline())
        params = load("PROOF_PARAMETERS.json")["parameters"]
        vmparams = {name: {"value": value} for name, value in {
            "suffix": self.suffix, "provisioningSshPublicKey": load("INTERACTIVE_ACCESS_CONTRACT.json")["publicKey"],
            "identityId": self.bindings["identityId"], "subnetId": self.bindings["subnetId"],
            "nsgId": self.bindings["nsgId"], "tags": params["tags"]["value"]}.items()}
        fresh("VM_PARAMETERS.json", {"parameters": vmparams})
        self.vm_start = time.monotonic()
        self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-vm",
                  "--template-file", str(HERE / "infra" / "vm.json"),
                  "--parameters", "@" + str(HERE / "VM_PARAMETERS.json")], "CREATE_VM", mutation=True)
        self.cli(["deployment", "operation", "group", "list", "--resource-group", self.rg,
                  "--name", "g3-firstbyte-vm"], "VM_CREATION_OPERATIONS")
        vm = self.cli(["vm", "show", "--resource-group", self.rg, "--name", self.prefix + "-vm"], "PROOF_VM_MODEL")
        ensure(vm["identity"]["type"] == "UserAssigned" and
               list(vm["identity"]["userAssignedIdentities"]) == [self.bindings["identityId"]],
               "VM_IDENTITY_BOUNDARY")
        nic = self.cli(["network", "nic", "show", "--resource-group", self.rg,
                       "--name", self.prefix + "-vm-nic"], "PROOF_VM_NIC")
        ensure(all(not item.get("publicIPAddress") for item in nic["ipConfigurations"]), "VM_PUBLIC_IP")
        url = "https://" + self.bindings["blobHost"] + "/bootstrap-proof/g3a-bootstrap-proof?" + urlencode({"versionid": self.v1_version})
        cseparams = {name: {"value": value} for name, value in {
            "vmName": self.prefix + "-vm", "blobVersionUri": url,
            "readerClientId": self.bindings["identityClientId"], "tags": params["tags"]["value"]}.items()}
        fresh("CSE_PARAMETERS.json", {"parameters": cseparams})
        fresh("CSE_SETTINGS_EVIDENCE.json", {
            "publicSettings": {"skipDos2Unix": True},
            "protectedSettings": {"fileUris": ["<proof-blob-host>/bootstrap-proof/g3a-bootstrap-proof?versionid=" +
                                              self.v1_version], "managedIdentity": {"clientId": "<bound-proof-uami>"},
                                  "commandToExecute": "./g3a-bootstrap-proof"},
            "actualParameterHash": sha(HERE / "CSE_PARAMETERS.json"), "handler": "2.1.10",
            "sensitiveLiterals": "NONE", "timestamp": "NOT_USED"})
        ensure(self.lockdown == "PASS" and self.cse_count == 0, "CSE_NOT_ALLOWED")
        fresh("CSE_EXECUTION_CONSUMED.json", {"maxExecutions": 1, "authoritySha256": self.authority["sha256"]})
        self.cse_count += 1
        try:
            self.cli(["deployment", "group", "create", "--resource-group", self.rg, "--name", "g3-firstbyte-once",
                      "--template-file", str(HERE / "infra" / "cse.json"),
                      "--parameters", "@" + str(HERE / "CSE_PARAMETERS.json")],
                     "ONE_CSE_EXECUTION", mutation=True, timeout=1200)
        except RuntimeError:
            self.event("CSE_DEPLOYMENT_NONZERO_OBSERVE_TERMINAL_NO_RETRY")
        view = self.cli(["vm", "extension", "show", "--resource-group", self.rg, "--vm-name", self.prefix + "-vm",
                         "--name", "g3-firstbyte-once", "--instance-view"], "CSE_TERMINAL_INSTANCE_VIEW")
        instance = view["instanceView"]
        ensure(instance["typeHandlerVersion"] == "2.1.10", "INSTALLED_HANDLER_VERSION_MISMATCH")
        statuses = instance["statuses"]
        terminal = [item for item in statuses if item["code"] in ("ProvisioningState/succeeded", "ProvisioningState/failed")]
        ensure(len(terminal) == 1, "CSE_NOT_TERMINAL_NO_RETRY")
        message = terminal[0].get("message", "")
        bins = load("PROBE_BINARIES.json")["binaries"]
        self.terminal = classify_status(message, bins["V1"]["sha256"], bins["V2"]["sha256"],
                                        terminal[0]["code"] == "ProvisioningState/succeeded")
        ensure(self.terminal != "PROVEN" or self.lockdown == "PASS", "FALSE_PRIVATE_CONSUMPTION_PASS")
        fresh("CSE_VERSION_SELECTION_RESULT.json", {
            "classification": self.terminal, "CSE_VERSIONID_SELECTION": self.terminal,
            "handler": instance["typeHandlerVersion"], "terminalCode": terminal[0]["code"],
            "requestedV1MarkerObserved": "G3A_BOOTSTRAP_REQUESTED_V1" in message,
            "currentV2MarkerObserved": "G3A_BOOTSTRAP_CURRENT_V2" in message,
            "reportedSelfHashes": re.findall(r"SELF_SHA256=([0-9a-f]{64})", message),
            "publicStorageDisabledDuringConsumption": True, "requestedVersionId": self.v1_version,
            "retryCount": 0, "CSEExecutions": self.cse_count})

    def cleanup(self):
        fresh("CONCURRENCY_CLEANUP.json", baseline())
        if not self.owned_rg:
            self.receipt()
        ensure(self.owned_rg, "CLEANUP_WITHOUT_POSITIVE_OWNERSHIP")
        inventory = self.cli(["resource", "list", "--resource-group", self.rg], "PRECLEANUP_RESOURCES")
        group = self.cli(["group", "show", "--name", self.rg], "PRECLEANUP_RG_OWNER")
        ensure(group["tags"]["authority_sha256"] == self.authority["sha256"], "CLEANUP_OWNERSHIP_CHANGED")
        allowed_types = {
            "microsoft.network/networksecuritygroups", "microsoft.network/virtualnetworks",
            "microsoft.storage/storageaccounts", "microsoft.managedidentity/userassignedidentities",
            "microsoft.network/privatednszones", "microsoft.network/privatednszones/virtualnetworklinks",
            "microsoft.network/privateendpoints", "microsoft.network/networkinterfaces",
            "microsoft.compute/virtualmachines", "microsoft.compute/disks",
            "microsoft.compute/virtualmachines/extensions"}
        ensure(all(item["id"].lower().startswith(self.rgid.lower() + "/") and
                   item["type"].lower() in allowed_types for item in inventory), "FOREIGN_RESOURCE_CLEANUP_STOP")
        expected_names = {
            self.prefix + "-nsg", self.prefix + "-vnet", "nzilag3fb" + self.suffix, self.prefix + "-reader",
            "privatelink.blob.core.windows.net", "privatelink.blob.core.windows.net/" + self.prefix + "-link",
            self.prefix + "-blob-pe", self.prefix + "-vm-nic", self.prefix + "-vm", self.prefix + "-osdisk",
            self.prefix + "-vm/g3-firstbyte-once"}
        endpoint = self.cli(["network", "private-endpoint", "show", "--resource-group", self.rg,
                             "--name", self.prefix + "-blob-pe"], "CLEANUP_PE_CHILD_BINDING", allow_absent=True)
        implicit_nics = {item["id"].lower() for item in (endpoint or {}).get("networkInterfaces", [])}
        ensure(all(item["name"] in expected_names or item["id"].lower() in implicit_nics
                   for item in inventory), "UNPLANNED_RESOURCE_NAME_CLEANUP_STOP")
        fresh("EXACT_CLEANUP_OWNERSHIP_LEDGER.json", {
            "baselineRGAbsent": True, "positiveRGCreationReceipt": "RESOURCE_GROUP_CREATION_RECEIPT.json",
            "explicitPlannedNames": sorted(expected_names), "PECreatedImplicitNICs": sorted(implicit_nics),
            "exactResourceInventory": inventory, "scope": self.rgid, "foreignCleanup": "PROHIBITED"})
        if self.bindings:
            if not self.writer_deleted:
                self.cli(["role", "assignment", "delete", "--ids", self.bindings["producerRoleId"]],
                         "CLEANUP_PRODUCER_ROLE", mutation=True)
                self.writer_deleted = True
            self.cli(["role", "assignment", "delete", "--ids", self.bindings["readerRoleId"]],
                     "CLEANUP_BUILDER_ROLE", mutation=True)
            self.reader_deleted = True
        self.cli(["group", "delete", "--name", self.rg, "--yes"], "DELETE_PROOF_RG_CASCADE", mutation=True, timeout=1200)
        self.cli(["deployment", "sub", "delete", "--name", self.subdeployment],
                 "DELETE_PROOF_SUB_DEPLOYMENT_RECORD", mutation=True)
        absent = self.cli(["group", "exists", "--name", self.rg], "FINAL_RG_ABSENCE")
        ensure(absent is False, "RESIDUAL_RG")
        roles = self.cli(["role", "assignment", "list", "--all", "--fill-principal-name", "false",
                          "--query", "[?starts_with(scope, '" + self.rgid + "')"
                          + (" || principalId=='" + self.identity + "'" if self.identity else "") + "]"],
                         "FINAL_PROOF_ROLES")
        ensure(not roles, "RESIDUAL_PROOF_ROLE_ASSIGNMENTS")
        resources = self.cli(["resource", "list", "--query", "[?starts_with(id, '" + self.rgid + "/')]"],
                             "FINAL_PROOF_RESOURCE_CENSUS")
        ensure(not resources, "RESIDUAL_PROOF_RESOURCES")
        g2 = self.cli(["resource", "list", "--resource-group", G2_RG], "FINAL_G2_RESOURCES")
        ensure(canonical(sorted(g2, key=lambda item: item["id"])) ==
               canonical(sorted(load("G2_RESOURCE_BASELINE.json")["value"], key=lambda item: item["id"])),
               "G2_RESOURCE_DRIFT_OBSERVED_NOT_DISPOSITIONED")
        g2roles = self.cli(["role", "assignment", "list", "--all", "--include-inherited",
                            "--fill-principal-name", "false", "--query", G2_ROLE_QUERY], "FINAL_G2_ROLES")
        ensure(canonical(sorted(g2roles, key=lambda item: item["id"])) ==
               canonical(sorted(load("G2_ROLE_BASELINE_CORRECTED.json")["value"], key=lambda item: item["id"])),
               "G2_ROLE_DRIFT_OBSERVED_NOT_DISPOSITIONED")
        ensure(sha(Path(load("PROTECTED_ROOT_BINDING.json")["g2Path"])) ==
               load("PROTECTED_ROOT_BINDING.json")["g2Sha256"], "G2_TERMINAL_ROOT_CHANGED")
        fresh("CLEANUP_RECONCILIATION.json", {
            "status": "PASS_ZERO_PROOF_RESIDUALS", "proofRGAbsent": True, "resourceCensus": resources,
            "proofRoleCensus": roles, "G2ResourcesAndRolesUnchanged": True, "g2TerminalRootUnchanged": True,
            "UAMIDeletedViaARM": bool(self.identity), "directoryLifecycleIsNotZeroEntraMutation": True,
            "durationSeconds": time.monotonic() - self.start})

    def run(self):
        self.consume()
        failure = None
        cleanup_failure = None
        try:
            self.transport()
            self.stage()
            self.lock()
            self.execute()
        except Exception as error:
            failure = str(error)
            self.event("PROOF_FAILED_NO_RETRY", reason=failure, terminalClassification=self.terminal)
        finally:
            try:
                self.cleanup()
            except Exception as error:
                cleanup_failure = str(error)
                self.event("CLEANUP_FAILED_EXPLICIT_RECONCILIATION_REQUIRED", reason=cleanup_failure)
        fresh("LIVE_PROOF_RESULT.json", {
            "classification": self.terminal, "failure": failure, "cleanupFailure": cleanup_failure,
            "authorityConsumed": True, "resourceGroup": self.rg,
            "residualState": "ZERO" if cleanup_failure is None else "NONZERO",
            "CSEExecutions": self.cse_count, "storageLockdown": self.lockdown,
            "V1_VERSION_ID": self.v1_version, "registryMutations": 0,
            "portableBuilderOrUploaderExecuted": False,
            "events": len(self.events), "elapsedSeconds": time.monotonic() - self.start})
        print("LIVE_PROOF_TERMINAL=" + self.terminal, flush=True)
        ensure(cleanup_failure is None, "CLEANUP_NONZERO_" + str(cleanup_failure))
        ensure(failure is None, "PROOF_FAILURE_" + str(failure))


if __name__ == "__main__":
    Proof().run()
